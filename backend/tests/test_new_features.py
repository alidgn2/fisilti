"""
Tests for the new feature set in Fısıltı Gazetesi:
- Notifications (comment + follow + read)
- Hashtags (extraction + filter + trending)
- AI moderation (lenient via Claude / fallback)
- Reports + Admin moderation + Sponsored
- Boost packages / checkout / status (Stripe TEST mode, no real payment)
"""
import os
import uuid
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@fisilti.com"
ADMIN_PASSWORD = "Admin1234!"


# ---------- Fixtures ----------
@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=20)
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    return s


def _register(name_prefix: str):
    s = requests.Session()
    email = f"TEST_{name_prefix}_{uuid.uuid4().hex[:8]}@fisilti.com"
    r = s.post(f"{API}/auth/register",
               json={"email": email, "password": "Test1234!", "name": f"{name_prefix} Test"},
               timeout=20)
    assert r.status_code == 200, f"register: {r.status_code} {r.text}"
    data = r.json()
    return {"session": s, "email": email, "user_id": data["user"]["user_id"]}


@pytest.fixture(scope="module")
def user_a():
    return _register("A")


@pytest.fixture(scope="module")
def user_b():
    return _register("B")


# ---------- Hashtags ----------
class TestHashtags:
    def test_trending_returns_array(self):
        r = requests.get(f"{API}/hashtags/trending", timeout=20)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_create_whisper_extracts_hashtags(self, user_a):
        s = user_a["session"]
        unique = uuid.uuid4().hex[:6]
        tag1 = f"foo{unique}"
        tag2 = f"bar{unique}"
        body = {
            "content": f"Kahvede duyduğum: #{tag1} #{tag2} #{tag1.upper()} işleri",
            "category": "kahvehane",
        }
        r = s.post(f"{API}/whispers", json=body, timeout=20)
        assert r.status_code == 200, r.text
        w = r.json()
        assert "hashtags" in w
        # lowercase + deduplicated, order preserved
        assert w["hashtags"] == [tag1, tag2], f"got {w['hashtags']}"

    def test_filter_whispers_by_hashtag(self, user_a):
        s = user_a["session"]
        unique = uuid.uuid4().hex[:6]
        tag = f"dolar{unique}"
        # create 2 whispers with the tag
        for i in range(2):
            s.post(f"{API}/whispers",
                   json={"content": f"haber {i} #{tag}", "category": "kahvehane"}, timeout=20)
        r = requests.get(f"{API}/whispers", params={"hashtag": tag}, timeout=20)
        assert r.status_code == 200
        items = r.json()
        assert len(items) >= 2
        for w in items:
            assert tag in w.get("hashtags", [])


# ---------- AI moderation ----------
class TestModeration:
    def test_benign_gossip_approved(self, user_a):
        s = user_a["session"]
        r = s.post(f"{API}/whispers",
                   json={"content": "Berberde duydum, mahalle muhtarı yeni bir kafe açıyormuş.",
                         "category": "berber"}, timeout=30)
        assert r.status_code == 200, r.text
        w = r.json()
        # lenient → expect approved (or, in the worst-case LLM fail, fallback also approves)
        assert w.get("moderation_status") == "approved", f"got {w.get('moderation_status')} / {w.get('moderation_reason')}"


# ---------- Notifications ----------
class TestNotifications:
    def test_follow_creates_notification(self, user_a, user_b):
        # A follows B → B should get a 'follow' notification
        sa = user_a["session"]
        r = sa.post(f"{API}/users/{user_b['user_id']}/follow", timeout=20)
        assert r.status_code == 200
        # B fetches notifications
        rb = user_b["session"].get(f"{API}/notifications", timeout=20)
        assert rb.status_code == 200
        data = rb.json()
        assert "items" in data and "unread_count" in data
        types = [n["type"] for n in data["items"]]
        assert "follow" in types

    def test_comment_creates_notification(self, user_a, user_b):
        # B posts whisper, A comments → B should get a 'comment' notification
        rw = user_b["session"].post(f"{API}/whispers",
            json={"content": "Park'ta ilginç bir şey duydum.", "category": "park"}, timeout=20)
        assert rw.status_code == 200
        wid = rw.json()["whisper_id"]
        rc = user_a["session"].post(f"{API}/whispers/{wid}/comments",
                                    json={"content": "Bir kaynak söyledi mi?"}, timeout=20)
        assert rc.status_code == 200
        rb = user_b["session"].get(f"{API}/notifications", timeout=20)
        assert rb.status_code == 200
        items = rb.json()["items"]
        assert any(n["type"] == "comment" for n in items)

    def test_mark_read(self, user_b):
        # unread_count > 0 should be possible
        rb = user_b["session"].get(f"{API}/notifications", timeout=20)
        before = rb.json()["unread_count"]
        rp = user_b["session"].post(f"{API}/notifications/read", timeout=20)
        assert rp.status_code == 200
        rb2 = user_b["session"].get(f"{API}/notifications", timeout=20)
        assert rb2.json()["unread_count"] == 0
        # before may be 0 or larger, but afterwards it must be exactly 0
        assert before >= 0


# ---------- Reports ----------
class TestReports:
    def test_report_unauth(self, user_a):
        # need an existing whisper id
        rw = user_a["session"].post(f"{API}/whispers",
            json={"content": "Test report whisper.", "category": "diger"}, timeout=20)
        wid = rw.json()["whisper_id"]
        r = requests.post(f"{API}/whispers/{wid}/report",
                          json={"reason": "spam"}, timeout=20)
        assert r.status_code == 401

    def test_report_and_duplicate(self, user_a, user_b):
        # A creates whisper, B reports it twice
        rw = user_a["session"].post(f"{API}/whispers",
            json={"content": "Şikayet için içerik.", "category": "diger"}, timeout=20)
        wid = rw.json()["whisper_id"]
        r1 = user_b["session"].post(f"{API}/whispers/{wid}/report",
                                    json={"reason": "spam", "note": "tekrar"}, timeout=20)
        assert r1.status_code == 200, r1.text
        assert r1.json().get("duplicate") is not True
        r2 = user_b["session"].post(f"{API}/whispers/{wid}/report",
                                    json={"reason": "spam"}, timeout=20)
        assert r2.status_code == 200
        assert r2.json().get("duplicate") is True

    def test_admin_list_reports(self, admin_session):
        r = admin_session.get(f"{API}/admin/reports", timeout=20)
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list)
        if items:
            # should have whisper preview
            first = items[0]
            assert "whisper" in first or "whisper_id" in first

    def test_admin_reports_forbidden_for_normal_user(self, user_a):
        r = user_a["session"].get(f"{API}/admin/reports", timeout=20)
        assert r.status_code == 403


# ---------- Admin moderation ----------
class TestAdminModeration:
    def test_hide_then_approve_then_delete(self, user_a, admin_session):
        # Create a whisper to moderate
        rw = user_a["session"].post(f"{API}/whispers",
            json={"content": "Moderasyon testi içeriği.", "category": "diger"}, timeout=30)
        assert rw.status_code == 200
        wid = rw.json()["whisper_id"]

        # hide
        rh = admin_session.post(f"{API}/admin/whispers/{wid}/moderate",
                                json={"action": "hide"}, timeout=20)
        assert rh.status_code == 200, rh.text

        # not in main feed
        feed = requests.get(f"{API}/whispers", params={"limit": 100}, timeout=20).json()
        assert isinstance(feed, list), f"unexpected feed response: {feed}"
        assert all(w["whisper_id"] != wid for w in feed), "hidden whisper should not be in /api/whispers"

        # approve restores
        ra = admin_session.post(f"{API}/admin/whispers/{wid}/moderate",
                                json={"action": "approve"}, timeout=20)
        assert ra.status_code == 200
        # confirm visible via GET single
        rg = requests.get(f"{API}/whispers/{wid}", timeout=20)
        assert rg.status_code == 200
        assert rg.json().get("moderation_status") == "approved"

        # delete removes whisper
        rd = admin_session.post(f"{API}/admin/whispers/{wid}/moderate",
                                json={"action": "delete"}, timeout=20)
        assert rd.status_code == 200
        rg2 = requests.get(f"{API}/whispers/{wid}", timeout=20)
        assert rg2.status_code == 404

    def test_sponsored_create_and_visible(self, admin_session, user_a):
        # non-admin forbidden
        rf = user_a["session"].post(f"{API}/admin/whispers/sponsored",
            json={"content": "Sponsor içerik denemesi metni", "category": "diger",
                  "sponsor_name": "Test Sponsor"}, timeout=20)
        assert rf.status_code == 403

        # admin creates sponsored whisper
        rc = admin_session.post(f"{API}/admin/whispers/sponsored",
            json={"content": "Sponsorlu reklam fısıltısı içeriği uzunca", "category": "diger",
                  "sponsor_name": "Reklamveren A.Ş."}, timeout=20)
        assert rc.status_code == 200, rc.text
        w = rc.json()
        assert w.get("is_sponsored") is True
        # appears pinned in feed
        feed = requests.get(f"{API}/whispers", params={"limit": 50}, timeout=20).json()
        assert any(x["whisper_id"] == w["whisper_id"] and x.get("is_sponsored") for x in feed)


# ---------- Boost / Stripe ----------
class TestBoost:
    def test_packages(self):
        r = requests.get(f"{API}/boost/packages", timeout=20)
        assert r.status_code == 200
        pkgs = r.json()
        # Structure may be dict or list; accept either
        if isinstance(pkgs, dict):
            assert "boost_24h" in pkgs
            pkg = pkgs["boost_24h"]
        else:
            pkg = next((p for p in pkgs if p.get("id") == "boost_24h" or p.get("key") == "boost_24h"), None)
            assert pkg is not None
        # 25 TRY 24h
        amount = pkg.get("amount") or pkg.get("price")
        currency = (pkg.get("currency") or "").lower()
        assert float(amount) == 25.0
        assert currency == "try"
        duration = pkg.get("duration_hours") or pkg.get("hours") or 24
        assert int(duration) == 24

    def test_checkout_non_owner_forbidden(self, user_a, user_b):
        # A creates whisper, B tries to boost it
        rw = user_a["session"].post(f"{API}/whispers",
            json={"content": "Boost test içeriği.", "category": "diger"}, timeout=20)
        wid = rw.json()["whisper_id"]
        rb = user_b["session"].post(f"{API}/boost/checkout",
            json={"whisper_id": wid, "package_id": "boost_24h",
                  "origin_url": BASE_URL}, timeout=30)
        assert rb.status_code == 403

    def test_checkout_owner_creates_session_and_transaction(self, user_a):
        rw = user_a["session"].post(f"{API}/whispers",
            json={"content": "Kendi boost'um.", "category": "diger"}, timeout=20)
        wid = rw.json()["whisper_id"]
        rc = user_a["session"].post(f"{API}/boost/checkout",
            json={"whisper_id": wid, "package_id": "boost_24h",
                  "origin_url": BASE_URL}, timeout=45)
        assert rc.status_code == 200, rc.text
        data = rc.json()
        assert "url" in data and data["url"].startswith("https://checkout.stripe.com/")
        assert "session_id" in data and data["session_id"]
        sid = data["session_id"]

        # Poll status — non-completed
        rs = requests.get(f"{API}/boost/status/{sid}", timeout=20)
        assert rs.status_code == 200
        st = rs.json()
        # payment_status should NOT be 'paid'
        ps = (st.get("payment_status") or "").lower()
        assert ps != "paid", f"unexpected paid status without checkout: {st}"
        # boost not applied yet → whisper still not boosted
        rg = requests.get(f"{API}/whispers/{wid}", timeout=20)
        assert rg.status_code == 200
        assert not rg.json().get("is_boosted", False)
