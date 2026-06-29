"""
Backend API tests for Fısıltı Gazetesi
Covers: health, categories, auth (register/login/me/logout), whispers CRUD,
voting, comments, profile/stats. Turkish-friendly error checks.
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@fisilti.com"
ADMIN_PASSWORD = "Admin1234!"


# -------- Fixtures --------
@pytest.fixture(scope="session")
def admin_session():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=20)
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    return s


@pytest.fixture(scope="session")
def test_user():
    """Register a fresh test user."""
    s = requests.Session()
    email = f"TEST_user_{uuid.uuid4().hex[:8]}@fisilti.com"
    payload = {"email": email, "password": "Test1234!", "name": "Test Muhabir"}
    r = s.post(f"{API}/auth/register", json=payload, timeout=20)
    assert r.status_code == 200, f"Register failed: {r.status_code} {r.text}"
    return {"session": s, "email": email, "data": r.json()}


@pytest.fixture(scope="session")
def second_user():
    s = requests.Session()
    email = f"TEST_user2_{uuid.uuid4().hex[:8]}@fisilti.com"
    r = s.post(f"{API}/auth/register",
               json={"email": email, "password": "Test1234!", "name": "Diğer Muhabir"},
               timeout=20)
    assert r.status_code == 200
    return {"session": s, "email": email, "data": r.json()}


# -------- Health & categories --------
class TestHealth:
    def test_root(self):
        r = requests.get(f"{API}/", timeout=20)
        assert r.status_code == 200
        data = r.json()
        assert data.get("app") == "Fısıltı Gazetesi"
        assert data.get("status") == "ok"

    def test_categories(self):
        r = requests.get(f"{API}/categories", timeout=20)
        assert r.status_code == 200
        cats = r.json()
        assert isinstance(cats, list)
        assert len(cats) == 10
        ids = {c["id"] for c in cats}
        for required in ["kahvehane", "berber", "taksi", "dolmus", "market", "caybahcesi", "lokanta", "kuafor", "park", "diger"]:
            assert required in ids, f"Missing category {required}"


# -------- Auth --------
class TestAuth:
    def test_register_creates_user_and_sets_cookie(self):
        s = requests.Session()
        email = f"TEST_reg_{uuid.uuid4().hex[:8]}@fisilti.com"
        r = s.post(f"{API}/auth/register",
                   json={"email": email, "password": "Test1234!", "name": "Yeni Kullanıcı"},
                   timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "user" in data
        assert data["user"]["email"] == email.lower()
        assert data["user"]["name"] == "Yeni Kullanıcı"
        assert data["user"]["auth_provider"] == "email"
        assert "session_token" in s.cookies.get_dict()

    def test_register_duplicate_email(self, test_user):
        r = requests.post(f"{API}/auth/register",
                          json={"email": test_user["email"], "password": "Test1234!", "name": "Dup"},
                          timeout=20)
        assert r.status_code == 400
        assert "zaten" in r.json().get("detail", "").lower() or "kayıtlı" in r.json().get("detail", "")

    def test_login_admin(self):
        s = requests.Session()
        r = s.post(f"{API}/auth/login",
                   json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["user"]["email"] == ADMIN_EMAIL
        assert data["user"]["role"] == "admin"
        assert "session_token" in s.cookies.get_dict()

    def test_login_wrong_password(self):
        r = requests.post(f"{API}/auth/login",
                          json={"email": ADMIN_EMAIL, "password": "WrongPass!!"}, timeout=20)
        assert r.status_code == 401
        detail = r.json().get("detail", "")
        assert "Email" in detail or "şifre" in detail or "hatalı" in detail

    def test_me_with_cookie(self, admin_session):
        r = admin_session.get(f"{API}/auth/me", timeout=20)
        assert r.status_code == 200
        assert r.json()["email"] == ADMIN_EMAIL

    def test_me_without_cookie(self):
        r = requests.get(f"{API}/auth/me", timeout=20)
        assert r.status_code == 401

    def test_logout_clears_session(self):
        s = requests.Session()
        s.post(f"{API}/auth/login",
               json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=20)
        assert "session_token" in s.cookies.get_dict()
        r = s.post(f"{API}/auth/logout", timeout=20)
        assert r.status_code == 200
        # After logout the session should no longer be valid
        r2 = s.get(f"{API}/auth/me", timeout=20)
        assert r2.status_code == 401


# -------- Whispers CRUD --------
class TestWhispers:
    def test_create_whisper_unauth(self):
        r = requests.post(f"{API}/whispers",
                          json={"content": "Kahvede duyduğum bir şey vardı, çok ilginç.", "category": "kahvehane"},
                          timeout=20)
        assert r.status_code == 401

    def test_create_whisper_invalid_category(self, test_user):
        s = test_user["session"]
        r = s.post(f"{API}/whispers",
                   json={"content": "Bir yerde duydum...", "category": "nonsense"},
                   timeout=20)
        assert r.status_code == 400

    def test_create_and_get_whisper(self, test_user):
        s = test_user["session"]
        payload = {
            "content": "Berberde duyduğuma göre Boğaz'a tüp geçit yapılacakmış.",
            "category": "berber",
            "location": "Kadıköy",
            "overheard_from": "Müdavim Müşteri",
        }
        r = s.post(f"{API}/whispers", json=payload, timeout=20)
        assert r.status_code == 200, r.text
        w = r.json()
        assert w["content"].startswith("Berberde")
        assert w["category"] == "berber"
        assert w["upvotes"] == 0 and w["downvotes"] == 0
        wid = w["whisper_id"]

        # GET single
        r2 = s.get(f"{API}/whispers/{wid}", timeout=20)
        assert r2.status_code == 200
        assert r2.json()["whisper_id"] == wid

    def test_get_whisper_not_found(self):
        r = requests.get(f"{API}/whispers/does-not-exist", timeout=20)
        assert r.status_code == 404

    def test_list_with_filter_and_sort(self, test_user):
        s = test_user["session"]
        # Create one in 'taksi'
        s.post(f"{API}/whispers",
               json={"content": "Takside duyduğuma göre futbolcular değişiyormuş.", "category": "taksi"},
               timeout=20)
        for sort in ["new", "top", "trending"]:
            r = requests.get(f"{API}/whispers", params={"sort": sort}, timeout=20)
            assert r.status_code == 200
            assert isinstance(r.json(), list)
        r = requests.get(f"{API}/whispers", params={"category": "taksi"}, timeout=20)
        assert r.status_code == 200
        assert all(w["category"] == "taksi" for w in r.json())

        r = requests.get(f"{API}/whispers", params={"category": "invalid_cat"}, timeout=20)
        assert r.status_code == 400

    def test_delete_non_owner_forbidden(self, test_user, second_user):
        s1 = test_user["session"]
        r = s1.post(f"{API}/whispers",
                    json={"content": "Park'ta duyduklarımdan biri çok şaşırtıcıydı.", "category": "park"},
                    timeout=20)
        wid = r.json()["whisper_id"]
        # Try delete with second user
        r2 = second_user["session"].delete(f"{API}/whispers/{wid}", timeout=20)
        assert r2.status_code == 403

    def test_delete_owner(self, test_user):
        s = test_user["session"]
        r = s.post(f"{API}/whispers",
                   json={"content": "Lokantada bir komşumun söylediği şey çok dikkat çekiciydi.", "category": "lokanta"},
                   timeout=20)
        wid = r.json()["whisper_id"]
        r2 = s.delete(f"{API}/whispers/{wid}", timeout=20)
        assert r2.status_code == 200
        r3 = requests.get(f"{API}/whispers/{wid}", timeout=20)
        assert r3.status_code == 404

    def test_admin_can_delete_any(self, test_user, admin_session):
        r = test_user["session"].post(f"{API}/whispers",
            json={"content": "Markette bir teyzeden duyduklarım.", "category": "market"}, timeout=20)
        wid = r.json()["whisper_id"]
        r2 = admin_session.delete(f"{API}/whispers/{wid}", timeout=20)
        assert r2.status_code == 200


# -------- Voting --------
class TestVote:
    def test_vote_flow(self, test_user, second_user):
        s1 = test_user["session"]
        s2 = second_user["session"]
        r = s1.post(f"{API}/whispers",
                    json={"content": "Çay bahçesinde duyduğum dedikodu var.", "category": "caybahcesi"},
                    timeout=20)
        wid = r.json()["whisper_id"]

        # second user upvotes
        r1 = s2.post(f"{API}/whispers/{wid}/vote", json={"value": 1}, timeout=20)
        assert r1.status_code == 200
        d = r1.json()
        assert d["upvotes"] == 1 and d["downvotes"] == 0 and d["my_vote"] == 1

        # same vote toggles off
        r2 = s2.post(f"{API}/whispers/{wid}/vote", json={"value": 1}, timeout=20)
        assert r2.status_code == 200
        d2 = r2.json()
        assert d2["upvotes"] == 0 and d2["my_vote"] == 0

        # upvote then switch to downvote
        s2.post(f"{API}/whispers/{wid}/vote", json={"value": 1}, timeout=20)
        r3 = s2.post(f"{API}/whispers/{wid}/vote", json={"value": -1}, timeout=20)
        d3 = r3.json()
        assert d3["upvotes"] == 0 and d3["downvotes"] == 1 and d3["my_vote"] == -1

    def test_vote_unauth(self):
        # need an existing whisper id from list
        items = requests.get(f"{API}/whispers", timeout=20).json()
        if not items:
            pytest.skip("No whispers to test unauth vote")
        wid = items[0]["whisper_id"]
        r = requests.post(f"{API}/whispers/{wid}/vote", json={"value": 1}, timeout=20)
        assert r.status_code == 401


# -------- Comments --------
class TestComments:
    def test_create_and_list_comments(self, test_user):
        s = test_user["session"]
        r = s.post(f"{API}/whispers",
                   json={"content": "Kuaförde duyduğum gizemli bir bilgi.", "category": "kuafor"},
                   timeout=20)
        wid = r.json()["whisper_id"]

        for txt in ["İlk yorum", "İkinci yorum", "Üçüncü yorum"]:
            rc = s.post(f"{API}/whispers/{wid}/comments", json={"content": txt}, timeout=20)
            assert rc.status_code == 200, rc.text
            assert rc.json()["content"] == txt

        rl = requests.get(f"{API}/whispers/{wid}/comments", timeout=20)
        assert rl.status_code == 200
        comments = rl.json()
        assert len(comments) == 3
        # chronological order
        ts = [c["created_at"] for c in comments]
        assert ts == sorted(ts)

    def test_create_comment_unauth(self, test_user):
        items = requests.get(f"{API}/whispers", timeout=20).json()
        if not items:
            pytest.skip("no whispers")
        wid = items[0]["whisper_id"]
        r = requests.post(f"{API}/whispers/{wid}/comments", json={"content": "hi"}, timeout=20)
        assert r.status_code == 401


# -------- Profile --------
class TestProfile:
    def test_user_stats(self, test_user):
        s = test_user["session"]
        r = s.get(f"{API}/users/me/stats", timeout=20)
        assert r.status_code == 200
        data = r.json()
        for key in ["whisper_count", "total_upvotes", "total_downvotes", "credibility"]:
            assert key in data
        assert isinstance(data["whisper_count"], int)

    def test_user_whispers(self, test_user):
        uid = test_user["data"]["user"]["user_id"]
        r = requests.get(f"{API}/users/{uid}/whispers", timeout=20)
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list)
        # we created several whispers for test_user
        assert all(w["author_id"] == uid for w in items)
