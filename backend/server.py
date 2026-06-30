from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import re
import uuid
import logging
import bcrypt
import stripe
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Literal

from fastapi import FastAPI, APIRouter, Request, Response, HTTPException, Depends, Query
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr

# ---------------------------------------------------------------------------
# Database
# ---------------------------------------------------------------------------
mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'fisilti')]


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
CATEGORIES = [
    {"id": "kahvehane", "label": "Kahvehane"},
    {"id": "berber", "label": "Berber"},
    {"id": "taksi", "label": "Taksi"},
    {"id": "dolmus", "label": "Dolmuş"},
    {"id": "market", "label": "Market / Bakkal"},
    {"id": "caybahcesi", "label": "Çay Bahçesi"},
    {"id": "lokanta", "label": "Lokanta"},
    {"id": "kuafor", "label": "Kuaför"},
    {"id": "park", "label": "Park"},
    {"id": "diger", "label": "Diğer"},
]
CATEGORY_IDS = {c["id"] for c in CATEGORIES}

SESSION_DAYS = 7

# Boost packages (server-side only — frontend cannot influence price)
BOOST_PACKAGES = {
    "boost_24h": {"amount": 25.0, "currency": "try", "hours": 24, "label": "24 Saat Manşete Sabit"},
}

HASHTAG_RE = re.compile(r"#([\wçğıöşüÇĞİÖŞÜ]{2,30})", re.UNICODE)


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------
class RegisterBody(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    name: str = Field(min_length=2, max_length=60)


class LoginBody(BaseModel):
    email: EmailStr
    password: str


class GoogleSessionBody(BaseModel):
    session_id: str


class WhisperCreate(BaseModel):
    content: str = Field(min_length=10, max_length=600)
    category: str
    location: Optional[str] = Field(default=None, max_length=80)
    overheard_from: Optional[str] = Field(default=None, max_length=80)


class SponsoredWhisperCreate(BaseModel):
    content: str = Field(min_length=10, max_length=600)
    category: str
    sponsor_name: str = Field(min_length=2, max_length=80)
    sponsor_url: Optional[str] = Field(default=None, max_length=200)
    overheard_from: Optional[str] = Field(default=None, max_length=80)
    location: Optional[str] = Field(default=None, max_length=80)


class ReportBody(BaseModel):
    reason: str = Field(min_length=3, max_length=200)


class ModerateBody(BaseModel):
    action: Literal["hide", "approve", "delete"]


class BoostCheckoutBody(BaseModel):
    whisper_id: str
    package_id: str = "boost_24h"
    origin_url: str


class CommentCreate(BaseModel):
    content: str = Field(min_length=1, max_length=400)


class MessageCreate(BaseModel):
    content: str = Field(min_length=1, max_length=1000)


class VoteBody(BaseModel):
    value: Literal[1, -1]


class ProfileUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=60)
    username: Optional[str] = Field(default=None, min_length=3, max_length=24)
    bio: Optional[str] = Field(default=None, max_length=160)
    neighborhood: Optional[str] = Field(default=None, max_length=60)
    picture: Optional[str] = Field(default=None, max_length=700_000)
    profile_visibility: Optional[Literal["public", "followers"]] = None
    allow_messages: Optional[Literal["everyone", "followers"]] = None
    notify_messages: Optional[bool] = None
    notify_follows: Optional[bool] = None
    notify_comments: Optional[bool] = None


class DeleteAccountBody(BaseModel):
    confirm: Literal["HESABIMI SIL"]


class UserOut(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    role: str = "user"
    auth_provider: str
    created_at: str


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except Exception:
        return False


def new_id(prefix: str = "") -> str:
    return f"{prefix}{uuid.uuid4().hex[:16]}"


def iso(dt: datetime) -> str:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat()


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def extract_hashtags(text: str) -> List[str]:
    """Extract #tags from text, normalized lowercase, unique, preserve order."""
    seen = set()
    out = []
    for m in HASHTAG_RE.finditer(text):
        tag = m.group(1).lower()
        if tag not in seen:
            seen.add(tag)
            out.append(tag)
    return out


async def moderate_content(text: str) -> dict:
    """Local moderation placeholder; keep content flowing without a hosted AI dependency."""
    blocked_terms = [
        term.strip().lower()
        for term in os.environ.get("BLOCKED_TERMS", "").split(",")
        if term.strip()
    ]
    lowered = text.lower()
    for term in blocked_terms:
        if term in lowered:
            return {"allowed": False, "reason": "Bu içerik yayın kurallarına takıldı"}
    return {"allowed": True, "reason": ""}


async def create_notification(user_id: str, ntype: str, data: dict) -> None:
    """Create an in-app notification. ntype: comment | follow | upvote_milestone | mention | moderation."""
    if not user_id:
        return
    target = await db.users.find_one({"user_id": user_id}, {"_id": 0, "notification_preferences": 1})
    prefs = (target or {}).get("notification_preferences") or {}
    pref_key = {
        "message": "messages",
        "follow": "follows",
        "comment": "comments",
    }.get(ntype)
    if pref_key and prefs.get(pref_key, True) is False:
        return
    await db.notifications.insert_one({
        "notification_id": new_id("n_"),
        "user_id": user_id,
        "type": ntype,
        "data": data,
        "read": False,
        "created_at": iso(now_utc()),
    })


def public_user(doc: dict) -> dict:
    return {
        "user_id": doc["user_id"],
        "email": doc["email"],
        "name": doc.get("name", ""),
        "username": doc.get("username"),
        "bio": doc.get("bio"),
        "neighborhood": doc.get("neighborhood"),
        "picture": doc.get("picture"),
        "profile_visibility": doc.get("profile_visibility", "public"),
        "allow_messages": doc.get("allow_messages", "everyone"),
        "notification_preferences": doc.get("notification_preferences", {
            "messages": True,
            "follows": True,
            "comments": True,
        }),
        "role": doc.get("role", "user"),
        "auth_provider": doc.get("auth_provider", "email"),
        "created_at": doc.get("created_at"),
    }


def public_user_brief(doc: Optional[dict]) -> Optional[dict]:
    if not doc:
        return None
    return {
        "user_id": doc["user_id"],
        "name": doc.get("name", "Anonim"),
        "username": doc.get("username"),
        "picture": doc.get("picture"),
    }


def conversation_id_for(user_a: str, user_b: str) -> str:
    return "dm_" + "_".join(sorted([user_a, user_b]))


def normalize_username(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    username = value.strip().lower()
    if not username:
        return None
    if not re.fullmatch(r"[a-z0-9_]{3,24}", username):
        raise HTTPException(status_code=400, detail="Kullanıcı adı 3-24 karakter, harf/rakam/alt çizgi olmalı")
    return username


def validate_profile_picture(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    allowed_prefixes = (
        "data:image/jpeg;base64,",
        "data:image/jpg;base64,",
        "data:image/png;base64,",
        "data:image/webp;base64,",
    )
    if not value.startswith(allowed_prefixes):
        raise HTTPException(status_code=400, detail="Profil fotoğrafı JPG, PNG veya WEBP olmalı")
    if len(value) > 700_000:
        raise HTTPException(status_code=400, detail="Profil fotoğrafı çok büyük")
    return value


async def create_session(user_id: str) -> str:
    token = uuid.uuid4().hex + uuid.uuid4().hex
    await db.user_sessions.insert_one({
        "session_token": token,
        "user_id": user_id,
        "expires_at": iso(now_utc() + timedelta(days=SESSION_DAYS)),
        "created_at": iso(now_utc()),
    })
    return token


def set_session_cookie(response: Response, token: str) -> None:
    secure_cookie = os.environ.get("COOKIE_SECURE", "false").lower() == "true"
    response.set_cookie(
        key="session_token",
        value=token,
        httponly=True,
        secure=secure_cookie,
        samesite="none" if secure_cookie else "lax",
        max_age=SESSION_DAYS * 24 * 60 * 60,
        path="/",
    )


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(key="session_token", path="/")


async def get_user_from_token(token: str) -> Optional[dict]:
    sess = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not sess:
        return None
    expires_at = sess["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < now_utc():
        return None
    user = await db.users.find_one({"user_id": sess["user_id"]}, {"_id": 0, "password_hash": 0})
    return user


async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("session_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Giriş yapmanız gerekiyor")
    user = await get_user_from_token(token)
    if not user:
        raise HTTPException(status_code=401, detail="Oturum geçersiz veya süresi dolmuş")
    return user


async def get_optional_user(request: Request) -> Optional[dict]:
    token = request.cookies.get("session_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        return None
    return await get_user_from_token(token)


# ---------------------------------------------------------------------------
# App + Router
# ---------------------------------------------------------------------------
app = FastAPI(title="Fısıltı Gazetesi API")
api_router = APIRouter(prefix="/api")


# ---------------------------------------------------------------------------
# Auth endpoints
# ---------------------------------------------------------------------------
@api_router.post("/auth/register")
async def register(body: RegisterBody, response: Response):
    email = body.email.lower().strip()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Bu email zaten kayıtlı")

    user_id = new_id("u_")
    doc = {
        "user_id": user_id,
        "email": email,
        "name": body.name.strip(),
        "bio": "",
        "neighborhood": "",
        "password_hash": hash_password(body.password),
        "picture": None,
        "role": "user",
        "auth_provider": "email",
        "created_at": iso(now_utc()),
    }
    await db.users.insert_one(doc)

    token = await create_session(user_id)
    set_session_cookie(response, token)
    return {"user": public_user(doc), "session_token": token}


@api_router.post("/auth/login")
async def login(body: LoginBody, response: Response):
    email = body.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if not user or not user.get("password_hash"):
        raise HTTPException(status_code=401, detail="Email veya şifre hatalı")
    if not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Email veya şifre hatalı")

    token = await create_session(user["user_id"])
    set_session_cookie(response, token)
    return {"user": public_user(user), "session_token": token}


@api_router.post("/auth/google-session")
async def google_session(body: GoogleSessionBody, response: Response):
    raise HTTPException(
        status_code=501,
        detail="Google login is not configured in this independent build. Use email/password login.",
    )


@api_router.get("/auth/me")
async def me(user=Depends(get_current_user)):
    return public_user(user)


@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    token = request.cookies.get("session_token")
    if token:
        await db.user_sessions.delete_one({"session_token": token})
    clear_session_cookie(response)
    return {"ok": True}


# ---------------------------------------------------------------------------
# Whispers
# ---------------------------------------------------------------------------
async def serialize_whisper(w: dict, current_user: Optional[dict]) -> dict:
    my_vote = 0
    if current_user:
        v = await db.votes.find_one({
            "whisper_id": w["whisper_id"],
            "user_id": current_user["user_id"],
        }, {"_id": 0})
        if v:
            my_vote = v["value"]
    comment_count = await db.comments.count_documents({"whisper_id": w["whisper_id"]})

    # Check boost validity
    boost_expires_at = w.get("boost_expires_at")
    is_boosted = False
    if boost_expires_at:
        be = boost_expires_at
        if isinstance(be, str):
            be = datetime.fromisoformat(be)
        if be.tzinfo is None:
            be = be.replace(tzinfo=timezone.utc)
        is_boosted = be > now_utc()

    return {
        "whisper_id": w["whisper_id"],
        "content": w["content"],
        "category": w["category"],
        "location": w.get("location"),
        "overheard_from": w.get("overheard_from"),
        "hashtags": w.get("hashtags", []),
        "author_id": w["user_id"],
        "author_name": w.get("author_name", "Anonim"),
        "author_picture": w.get("author_picture"),
        "upvotes": w.get("upvotes", 0),
        "downvotes": w.get("downvotes", 0),
        "score": w.get("upvotes", 0) - w.get("downvotes", 0),
        "my_vote": my_vote,
        "comment_count": comment_count,
        "is_boosted": is_boosted,
        "is_sponsored": bool(w.get("is_sponsored", False)),
        "sponsor_name": w.get("sponsor_name"),
        "sponsor_url": w.get("sponsor_url"),
        "moderation_status": w.get("moderation_status", "approved"),
        "created_at": w["created_at"],
    }


@api_router.get("/categories")
async def list_categories():
    return CATEGORIES


@api_router.get("/whispers")
async def list_whispers(
    request: Request,
    category: Optional[str] = Query(default=None),
    hashtag: Optional[str] = Query(default=None),
    search: Optional[str] = Query(default=None, min_length=2, max_length=80),
    sort: Literal["new", "top", "trending"] = Query(default="new"),
    limit: int = Query(default=30, ge=1, le=100),
    offset: int = Query(default=0, ge=0, le=1000),
):
    q = {"moderation_status": {"$ne": "hidden"}}
    if category and category != "all":
        if category not in CATEGORY_IDS:
            raise HTTPException(status_code=400, detail="Geçersiz kategori")
        q["category"] = category
    if hashtag:
        q["hashtags"] = hashtag.lower().lstrip("#")
    if search:
        term = search.strip()
        if term:
            q["$or"] = [
                {"content": {"$regex": re.escape(term), "$options": "i"}},
                {"location": {"$regex": re.escape(term), "$options": "i"}},
                {"overheard_from": {"$regex": re.escape(term), "$options": "i"}},
                {"author_name": {"$regex": re.escape(term), "$options": "i"}},
                {"hashtags": term.lower().lstrip("#")},
            ]

    cursor = db.whispers.find(q, {"_id": 0})
    cursor = cursor.sort("created_at", -1)
    docs = await cursor.to_list(length=300)

    # Separate sponsored & boosted from organic — keep sponsored/boosted always on top
    now = now_utc()

    def is_active_boost(d):
        be = d.get("boost_expires_at")
        if not be:
            return False
        if isinstance(be, str):
            be = datetime.fromisoformat(be)
        if be.tzinfo is None:
            be = be.replace(tzinfo=timezone.utc)
        return be > now

    pinned = [d for d in docs if d.get("is_sponsored") or is_active_boost(d)]
    organic = [d for d in docs if not (d.get("is_sponsored") or is_active_boost(d))]

    if sort == "top":
        organic.sort(key=lambda d: (d.get("upvotes", 0) - d.get("downvotes", 0)), reverse=True)
    elif sort == "trending":
        def trending_key(d):
            score = d.get("upvotes", 0) - d.get("downvotes", 0)
            created = d["created_at"]
            if isinstance(created, str):
                created_dt = datetime.fromisoformat(created)
            else:
                created_dt = created
            if created_dt.tzinfo is None:
                created_dt = created_dt.replace(tzinfo=timezone.utc)
            hours = (now_utc() - created_dt).total_seconds() / 3600.0
            return score - hours / 6.0
        organic.sort(key=trending_key, reverse=True)
    # else "new": already sorted by created_at desc

    docs = pinned + organic

    docs = docs[offset:offset + limit]
    current = await get_optional_user(request)
    return [await serialize_whisper(d, current) for d in docs]


@api_router.post("/whispers")
async def create_whisper(body: WhisperCreate, user=Depends(get_current_user)):
    if body.category not in CATEGORY_IDS:
        raise HTTPException(status_code=400, detail="Geçersiz kategori")

    content = body.content.strip()
    hashtags = extract_hashtags(content)
    moderation = await moderate_content(content)
    moderation_status = "approved" if moderation["allowed"] else "hidden"

    doc = {
        "whisper_id": new_id("w_"),
        "user_id": user["user_id"],
        "author_name": user.get("name", "Anonim"),
        "author_picture": user.get("picture"),
        "content": content,
        "category": body.category,
        "location": (body.location or "").strip() or None,
        "overheard_from": (body.overheard_from or "").strip() or None,
        "hashtags": hashtags,
        "upvotes": 0,
        "downvotes": 0,
        "is_sponsored": False,
        "is_boosted": False,
        "boost_expires_at": None,
        "moderation_status": moderation_status,
        "moderation_reason": moderation.get("reason", ""),
        "created_at": iso(now_utc()),
    }
    await db.whispers.insert_one(doc)

    if moderation_status == "hidden":
        # Notify the author that their post was hidden
        await create_notification(
            user["user_id"],
            "moderation",
            {"whisper_id": doc["whisper_id"], "reason": moderation.get("reason") or "İçerik kurallarına uygun değil."},
        )

    return await serialize_whisper(doc, user)


@api_router.get("/whispers/following")
async def following_feed(
    request: Request,
    limit: int = Query(default=30, ge=1, le=100),
):
    user = await get_optional_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Giriş yapmanız gerekiyor")
    follows = await db.follows.find(
        {"follower_id": user["user_id"]}, {"_id": 0, "followee_id": 1}
    ).to_list(length=2000)
    followee_ids = [f["followee_id"] for f in follows]
    if not followee_ids:
        return []
    cursor = db.whispers.find({"user_id": {"$in": followee_ids}}, {"_id": 0}).sort("created_at", -1).limit(limit)
    docs = await cursor.to_list(length=limit)
    return [await serialize_whisper(d, user) for d in docs]


@api_router.get("/whispers/{whisper_id}")
async def get_whisper(whisper_id: str, request: Request):
    w = await db.whispers.find_one({"whisper_id": whisper_id}, {"_id": 0})
    if not w:
        raise HTTPException(status_code=404, detail="Fısıltı bulunamadı")
    current = await get_optional_user(request)
    return await serialize_whisper(w, current)


@api_router.delete("/whispers/{whisper_id}")
async def delete_whisper(whisper_id: str, user=Depends(get_current_user)):
    w = await db.whispers.find_one({"whisper_id": whisper_id})
    if not w:
        raise HTTPException(status_code=404, detail="Fısıltı bulunamadı")
    if w["user_id"] != user["user_id"] and user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Bu fısıltıyı silemezsiniz")
    await db.whispers.delete_one({"whisper_id": whisper_id})
    await db.votes.delete_many({"whisper_id": whisper_id})
    await db.comments.delete_many({"whisper_id": whisper_id})
    return {"ok": True}


@api_router.post("/whispers/{whisper_id}/vote")
async def vote_whisper(whisper_id: str, body: VoteBody, user=Depends(get_current_user)):
    w = await db.whispers.find_one({"whisper_id": whisper_id})
    if not w:
        raise HTTPException(status_code=404, detail="Fısıltı bulunamadı")

    existing = await db.votes.find_one({
        "whisper_id": whisper_id,
        "user_id": user["user_id"],
    })

    if existing and existing["value"] == body.value:
        # toggle off
        await db.votes.delete_one({"_id": existing["_id"]})
        field = "upvotes" if body.value == 1 else "downvotes"
        await db.whispers.update_one({"whisper_id": whisper_id}, {"$inc": {field: -1}})
    elif existing:
        # switch vote
        await db.votes.update_one({"_id": existing["_id"]}, {"$set": {"value": body.value}})
        if body.value == 1:
            await db.whispers.update_one({"whisper_id": whisper_id}, {"$inc": {"upvotes": 1, "downvotes": -1}})
        else:
            await db.whispers.update_one({"whisper_id": whisper_id}, {"$inc": {"downvotes": 1, "upvotes": -1}})
    else:
        # new vote
        await db.votes.insert_one({
            "vote_id": new_id("v_"),
            "whisper_id": whisper_id,
            "user_id": user["user_id"],
            "value": body.value,
            "created_at": iso(now_utc()),
        })
        field = "upvotes" if body.value == 1 else "downvotes"
        await db.whispers.update_one({"whisper_id": whisper_id}, {"$inc": {field: 1}})

    updated = await db.whispers.find_one({"whisper_id": whisper_id}, {"_id": 0})
    return await serialize_whisper(updated, user)


@api_router.get("/whispers/{whisper_id}/comments")
async def list_comments(whisper_id: str):
    w = await db.whispers.find_one({"whisper_id": whisper_id})
    if not w:
        raise HTTPException(status_code=404, detail="Fısıltı bulunamadı")
    cursor = db.comments.find({"whisper_id": whisper_id}, {"_id": 0}).sort("created_at", 1)
    items = await cursor.to_list(length=500)
    return items


@api_router.post("/whispers/{whisper_id}/comments")
async def create_comment(whisper_id: str, body: CommentCreate, user=Depends(get_current_user)):
    w = await db.whispers.find_one({"whisper_id": whisper_id})
    if not w:
        raise HTTPException(status_code=404, detail="Fısıltı bulunamadı")
    doc = {
        "comment_id": new_id("c_"),
        "whisper_id": whisper_id,
        "user_id": user["user_id"],
        "author_name": user.get("name", "Anonim"),
        "author_picture": user.get("picture"),
        "content": body.content.strip(),
        "created_at": iso(now_utc()),
    }
    await db.comments.insert_one(doc)
    doc.pop("_id", None)
    # Notify whisper author (if not self)
    if w["user_id"] != user["user_id"]:
        await create_notification(
            w["user_id"],
            "comment",
            {
                "whisper_id": whisper_id,
                "from_user_id": user["user_id"],
                "from_name": user.get("name", "Anonim"),
                "preview": body.content.strip()[:120],
            },
        )
    return doc


# ---------------------------------------------------------------------------
# Profile
# ---------------------------------------------------------------------------
@api_router.get("/users/search")
async def search_users(
    q: str = Query(default="", max_length=60),
    limit: int = Query(default=20, ge=1, le=50),
    user=Depends(get_current_user),
):
    term = q.strip()
    if len(term) < 2:
        return []

    pattern = re.escape(term)
    cursor = db.users.find(
        {
            "user_id": {"$ne": user["user_id"]},
            "$or": [
                {"name": {"$regex": pattern, "$options": "i"}},
                {"username": {"$regex": pattern, "$options": "i"}},
                {"user_id": {"$regex": pattern, "$options": "i"}},
            ],
        },
        {"_id": 0, "password_hash": 0, "email": 0},
    ).limit(limit)
    docs = await cursor.to_list(length=limit)

    follows = await db.follows.find(
        {"follower_id": user["user_id"]},
        {"_id": 0, "followee_id": 1},
    ).to_list(length=1000)
    following_ids = {f["followee_id"] for f in follows}
    blocks = await db.blocks.find(
        {"$or": [{"blocker_id": user["user_id"]}, {"blocked_id": user["user_id"]}]},
        {"_id": 0, "blocker_id": 1, "blocked_id": 1},
    ).to_list(length=1000)
    blocked_ids = {
        b["blocked_id"] if b["blocker_id"] == user["user_id"] else b["blocker_id"]
        for b in blocks
    }

    results = []
    for doc in docs:
        uid = doc["user_id"]
        if uid in blocked_ids:
            continue
        results.append({
            "user_id": uid,
            "name": doc.get("name", "Anonim"),
            "username": doc.get("username"),
            "picture": doc.get("picture"),
            "is_following": uid in following_ids,
            "stats": {
                "follower_count": await db.follows.count_documents({"followee_id": uid}),
                "whisper_count": await db.whispers.count_documents({"user_id": uid}),
            },
        })
    return results


@api_router.get("/users/{user_id}")
async def get_user_public(user_id: str, request: Request):
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0, "email": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Muhabir bulunamadı")
    whisper_count = await db.whispers.count_documents({"user_id": user_id})
    pipeline = [
        {"$match": {"user_id": user_id}},
        {"$group": {"_id": None, "up": {"$sum": "$upvotes"}, "down": {"$sum": "$downvotes"}}}
    ]
    agg = await db.whispers.aggregate(pipeline).to_list(length=1)
    total_up = agg[0]["up"] if agg else 0
    total_down = agg[0]["down"] if agg else 0
    follower_count = await db.follows.count_documents({"followee_id": user_id})
    following_count = await db.follows.count_documents({"follower_id": user_id})

    is_following = False
    is_self = False
    current = await get_optional_user(request)
    if current:
        is_self = current["user_id"] == user_id
        if not is_self:
            f = await db.follows.find_one({"follower_id": current["user_id"], "followee_id": user_id})
            is_following = f is not None
            blocked = await db.blocks.find_one({
                "blocker_id": current["user_id"],
                "blocked_id": user_id,
            })
            is_blocked = blocked is not None
        else:
            is_blocked = False
    else:
        is_blocked = False
    private_profile = user.get("profile_visibility", "public") == "followers" and not is_self and not is_following

    return {
        "user_id": user["user_id"],
        "name": user.get("name", "Anonim"),
        "username": user.get("username"),
        "bio": None if private_profile else user.get("bio"),
        "neighborhood": None if private_profile else user.get("neighborhood"),
        "picture": user.get("picture"),
        "created_at": user.get("created_at"),
        "is_following": is_following,
        "is_self": is_self,
        "is_blocked": is_blocked,
        "private_profile": private_profile,
        "stats": {
            "whisper_count": whisper_count,
            "total_upvotes": total_up,
            "total_downvotes": total_down,
            "credibility": total_up - total_down,
            "follower_count": follower_count,
            "following_count": following_count,
        },
    }


@api_router.post("/users/{user_id}/follow")
async def follow_user(user_id: str, user=Depends(get_current_user)):
    if user_id == user["user_id"]:
        raise HTTPException(status_code=400, detail="Kendini takip edemezsin")
    target = await db.users.find_one({"user_id": user_id}, {"_id": 0, "user_id": 1})
    if not target:
        raise HTTPException(status_code=404, detail="Muhabir bulunamadı")

    blocked = await db.blocks.find_one({
        "$or": [
            {"blocker_id": user["user_id"], "blocked_id": user_id},
            {"blocker_id": user_id, "blocked_id": user["user_id"]},
        ]
    })
    if blocked:
        raise HTTPException(status_code=403, detail="Engellenen muhabir takip edilemez")

    existing = await db.follows.find_one({"follower_id": user["user_id"], "followee_id": user_id})
    if existing:
        await db.follows.delete_one({"_id": existing["_id"]})
        is_following = False
    else:
        await db.follows.insert_one({
            "follower_id": user["user_id"],
            "followee_id": user_id,
            "created_at": iso(now_utc()),
        })
        is_following = True
        # Notify followed user
        await create_notification(
            user_id,
            "follow",
            {"from_user_id": user["user_id"], "from_name": user.get("name", "Anonim")},
        )

    follower_count = await db.follows.count_documents({"followee_id": user_id})
    return {"is_following": is_following, "follower_count": follower_count}


@api_router.post("/users/{user_id}/block")
async def block_user(user_id: str, user=Depends(get_current_user)):
    if user_id == user["user_id"]:
        raise HTTPException(status_code=400, detail="Kendini engelleyemezsin")
    target = await db.users.find_one({"user_id": user_id}, {"_id": 0, "user_id": 1})
    if not target:
        raise HTTPException(status_code=404, detail="Muhabir bulunamadı")

    existing = await db.blocks.find_one({"blocker_id": user["user_id"], "blocked_id": user_id})
    if existing:
        await db.blocks.delete_one({"_id": existing["_id"]})
        is_blocked = False
    else:
        await db.blocks.insert_one({
            "blocker_id": user["user_id"],
            "blocked_id": user_id,
            "created_at": iso(now_utc()),
        })
        await db.follows.delete_many({
            "$or": [
                {"follower_id": user["user_id"], "followee_id": user_id},
                {"follower_id": user_id, "followee_id": user["user_id"]},
            ]
        })
        is_blocked = True
    return {"is_blocked": is_blocked}


@api_router.get("/users/{user_id}/followers")
async def user_followers(user_id: str, limit: int = Query(default=80, ge=1, le=200)):
    follows = await db.follows.find({"followee_id": user_id}, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(length=limit)
    ids = [f["follower_id"] for f in follows]
    docs = await db.users.find({"user_id": {"$in": ids}}, {"_id": 0, "password_hash": 0, "email": 0}).to_list(length=limit)
    by_id = {u["user_id"]: public_user_brief(u) for u in docs}
    return [by_id[uid] for uid in ids if uid in by_id]


@api_router.get("/users/{user_id}/following")
async def user_following(user_id: str, limit: int = Query(default=80, ge=1, le=200)):
    follows = await db.follows.find({"follower_id": user_id}, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(length=limit)
    ids = [f["followee_id"] for f in follows]
    docs = await db.users.find({"user_id": {"$in": ids}}, {"_id": 0, "password_hash": 0, "email": 0}).to_list(length=limit)
    by_id = {u["user_id"]: public_user_brief(u) for u in docs}
    return [by_id[uid] for uid in ids if uid in by_id]


@api_router.get("/users/{user_id}/whispers")
async def user_whispers(user_id: str, request: Request):
    cursor = db.whispers.find({"user_id": user_id}, {"_id": 0}).sort("created_at", -1)
    docs = await cursor.to_list(length=200)
    current = await get_optional_user(request)
    return [await serialize_whisper(d, current) for d in docs]


@api_router.get("/users/me/stats")
async def my_stats(user=Depends(get_current_user)):
    whisper_count = await db.whispers.count_documents({"user_id": user["user_id"]})
    pipeline = [
        {"$match": {"user_id": user["user_id"]}},
        {"$group": {"_id": None, "up": {"$sum": "$upvotes"}, "down": {"$sum": "$downvotes"}}}
    ]
    agg = await db.whispers.aggregate(pipeline).to_list(length=1)
    total_up = agg[0]["up"] if agg else 0
    total_down = agg[0]["down"] if agg else 0
    follower_count = await db.follows.count_documents({"followee_id": user["user_id"]})
    following_count = await db.follows.count_documents({"follower_id": user["user_id"]})
    return {
        "whisper_count": whisper_count,
        "total_upvotes": total_up,
        "total_downvotes": total_down,
        "credibility": total_up - total_down,
        "follower_count": follower_count,
        "following_count": following_count,
    }


@api_router.put("/users/me")
async def update_my_profile(body: ProfileUpdate, user=Depends(get_current_user)):
    update = {}
    unset = {}
    if body.name is not None:
        update["name"] = body.name.strip()
    if body.username is not None:
        username = normalize_username(body.username)
        if username:
            existing = await db.users.find_one({"username": username, "user_id": {"$ne": user["user_id"]}})
            if existing:
                raise HTTPException(status_code=400, detail="Bu kullanıcı adı alınmış")
        if username:
            update["username"] = username
        else:
            unset["username"] = ""
    if body.bio is not None:
        update["bio"] = body.bio.strip()
    if body.neighborhood is not None:
        update["neighborhood"] = body.neighborhood.strip()
    if body.picture is not None:
        update["picture"] = validate_profile_picture(body.picture)
    if body.profile_visibility is not None:
        update["profile_visibility"] = body.profile_visibility
    if body.allow_messages is not None:
        update["allow_messages"] = body.allow_messages
    notification_updates = {}
    if body.notify_messages is not None:
        notification_updates["messages"] = body.notify_messages
    if body.notify_follows is not None:
        notification_updates["follows"] = body.notify_follows
    if body.notify_comments is not None:
        notification_updates["comments"] = body.notify_comments
    if notification_updates:
        current_prefs = user.get("notification_preferences") or {}
        update["notification_preferences"] = {
            "messages": current_prefs.get("messages", True),
            "follows": current_prefs.get("follows", True),
            "comments": current_prefs.get("comments", True),
            **notification_updates,
        }

    if not update and not unset:
        return public_user(user)

    op = {}
    if update:
        op["$set"] = update
    if unset:
        op["$unset"] = unset
    await db.users.update_one({"user_id": user["user_id"]}, op)

    whisper_update = {}
    if "name" in update:
        whisper_update["author_name"] = update["name"]
    if "picture" in update:
        whisper_update["author_picture"] = update["picture"]
    if whisper_update:
        await db.whispers.update_many({"user_id": user["user_id"]}, {"$set": whisper_update})

    user.update(update)
    for key in unset:
        user.pop(key, None)
    return public_user(user)


@api_router.delete("/users/me")
async def delete_my_account(body: DeleteAccountBody, response: Response, user=Depends(get_current_user)):
    uid = user["user_id"]
    await db.users.delete_one({"user_id": uid})
    await db.user_sessions.delete_many({"user_id": uid})
    await db.follows.delete_many({"$or": [{"follower_id": uid}, {"followee_id": uid}]})
    await db.blocks.delete_many({"$or": [{"blocker_id": uid}, {"blocked_id": uid}]})
    await db.notifications.delete_many({"user_id": uid})
    await db.messages.delete_many({"$or": [{"sender_id": uid}, {"recipient_id": uid}]})
    await db.comments.delete_many({"user_id": uid})
    await db.votes.delete_many({"user_id": uid})
    await db.reports.delete_many({"reporter_id": uid})
    await db.whispers.update_many(
        {"user_id": uid},
        {"$set": {"author_name": "Silinmiş Muhabir", "author_picture": None}},
    )
    clear_session_cookie(response)
    return {"ok": True}


@api_router.get("/")
async def root():
    return {"app": "Fısıltı Gazetesi", "status": "ok"}


# ---------------------------------------------------------------------------
# Notifications
# ---------------------------------------------------------------------------
@api_router.get("/notifications")
async def list_notifications(user=Depends(get_current_user), limit: int = Query(default=30, ge=1, le=100)):
    cursor = db.notifications.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).limit(limit)
    items = await cursor.to_list(length=limit)
    unread = await db.notifications.count_documents({"user_id": user["user_id"], "read": False})
    return {"items": items, "unread_count": unread}


@api_router.post("/notifications/read")
async def mark_notifications_read(user=Depends(get_current_user)):
    await db.notifications.update_many(
        {"user_id": user["user_id"], "read": False},
        {"$set": {"read": True}},
    )
    return {"ok": True}


@api_router.get("/notifications/unread_count")
async def notifications_unread_count(user=Depends(get_current_user)):
    count = await db.notifications.count_documents({"user_id": user["user_id"], "read": False})
    return {"unread_count": count}


# ---------------------------------------------------------------------------
# Direct Messages
# ---------------------------------------------------------------------------
@api_router.get("/messages/conversations")
async def list_conversations(user=Depends(get_current_user), limit: int = Query(default=50, ge=1, le=100)):
    uid = user["user_id"]
    cursor = db.messages.find(
        {"$or": [{"sender_id": uid}, {"recipient_id": uid}]},
        {"_id": 0},
    ).sort("created_at", -1).limit(500)
    messages = await cursor.to_list(length=500)

    seen = set()
    conversations = []
    for message in messages:
        cid = message["conversation_id"]
        if cid in seen:
            continue
        seen.add(cid)
        other_id = message["recipient_id"] if message["sender_id"] == uid else message["sender_id"]
        other = await db.users.find_one({"user_id": other_id}, {"_id": 0, "password_hash": 0, "email": 0})
        unread = await db.messages.count_documents({
            "conversation_id": cid,
            "recipient_id": uid,
            "read": False,
        })
        conversations.append({
            "conversation_id": cid,
            "user": public_user_brief(other),
            "last_message": message,
            "unread": unread,
        })
        if len(conversations) >= limit:
            break
    return conversations


@api_router.get("/messages/unread_count")
async def messages_unread_count(user=Depends(get_current_user)):
    count = await db.messages.count_documents({"recipient_id": user["user_id"], "read": False})
    return {"unread_count": count}


@api_router.get("/messages/{user_id}")
async def list_messages(user_id: str, user=Depends(get_current_user), limit: int = Query(default=100, ge=1, le=200)):
    if user_id == user["user_id"]:
        raise HTTPException(status_code=400, detail="Kendine mesaj gönderemezsin")
    other = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0, "email": 0})
    if not other:
        raise HTTPException(status_code=404, detail="Muhabir bulunamadı")
    blocked = await db.blocks.find_one({
        "$or": [
            {"blocker_id": user["user_id"], "blocked_id": user_id},
            {"blocker_id": user_id, "blocked_id": user["user_id"]},
        ]
    })
    if blocked:
        raise HTTPException(status_code=403, detail="Bu konuşma engellenmiş")

    cid = conversation_id_for(user["user_id"], user_id)
    cursor = db.messages.find({"conversation_id": cid}, {"_id": 0}).sort("created_at", -1).limit(limit)
    docs = await cursor.to_list(length=limit)
    docs.reverse()
    await db.messages.update_many(
        {"conversation_id": cid, "recipient_id": user["user_id"], "read": False},
        {"$set": {"read": True}},
    )
    return {"user": public_user_brief(other), "messages": docs}


@api_router.post("/messages/{user_id}")
async def send_message(user_id: str, body: MessageCreate, user=Depends(get_current_user)):
    if user_id == user["user_id"]:
        raise HTTPException(status_code=400, detail="Kendine mesaj gönderemezsin")
    other = await db.users.find_one({"user_id": user_id}, {"_id": 0, "user_id": 1, "allow_messages": 1})
    if not other:
        raise HTTPException(status_code=404, detail="Muhabir bulunamadı")
    blocked = await db.blocks.find_one({
        "$or": [
            {"blocker_id": user["user_id"], "blocked_id": user_id},
            {"blocker_id": user_id, "blocked_id": user["user_id"]},
        ]
    })
    if blocked:
        raise HTTPException(status_code=403, detail="Bu muhabire mesaj gönderilemez")

    if other.get("allow_messages", "everyone") == "followers":
        is_followed = await db.follows.find_one({"follower_id": user_id, "followee_id": user["user_id"]})
        if not is_followed:
            raise HTTPException(status_code=403, detail="Bu muhabir sadece takip ettigi kisilerden mesaj aliyor")

    content = body.content.strip()
    if not content:
        raise HTTPException(status_code=400, detail="Mesaj boş olamaz")

    doc = {
        "message_id": new_id("m_"),
        "conversation_id": conversation_id_for(user["user_id"], user_id),
        "sender_id": user["user_id"],
        "recipient_id": user_id,
        "sender_name": user.get("name", "Anonim"),
        "sender_picture": user.get("picture"),
        "content": content,
        "read": False,
        "created_at": iso(now_utc()),
    }
    await db.messages.insert_one(doc)
    doc.pop("_id", None)
    await create_notification(
        user_id,
        "message",
        {
            "from_user_id": user["user_id"],
            "from_name": user.get("name", "Anonim"),
            "preview": content[:120],
        },
    )
    return doc


# ---------------------------------------------------------------------------
# Hashtags
# ---------------------------------------------------------------------------
@api_router.get("/hashtags/trending")
async def trending_hashtags(limit: int = Query(default=10, ge=1, le=50)):
    # last 7 days
    cutoff = iso(now_utc() - timedelta(days=7))
    pipeline = [
        {"$match": {"created_at": {"$gte": cutoff}, "moderation_status": {"$ne": "hidden"}, "hashtags": {"$exists": True, "$ne": []}}},
        {"$unwind": "$hashtags"},
        {"$group": {"_id": "$hashtags", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": limit},
    ]
    rows = await db.whispers.aggregate(pipeline).to_list(length=limit)
    return [{"hashtag": r["_id"], "count": r["count"]} for r in rows]


# ---------------------------------------------------------------------------
# Reports
# ---------------------------------------------------------------------------
@api_router.post("/whispers/{whisper_id}/report")
async def report_whisper(whisper_id: str, body: ReportBody, user=Depends(get_current_user)):
    w = await db.whispers.find_one({"whisper_id": whisper_id})
    if not w:
        raise HTTPException(status_code=404, detail="Fısıltı bulunamadı")
    # Avoid duplicate reports from same user
    existing = await db.reports.find_one({"whisper_id": whisper_id, "reporter_id": user["user_id"]})
    if existing:
        return {"ok": True, "duplicate": True}
    await db.reports.insert_one({
        "report_id": new_id("r_"),
        "whisper_id": whisper_id,
        "reporter_id": user["user_id"],
        "reporter_name": user.get("name", "Anonim"),
        "reason": body.reason.strip(),
        "status": "open",
        "created_at": iso(now_utc()),
    })
    return {"ok": True}


# ---------------------------------------------------------------------------
# Admin (Editör)
# ---------------------------------------------------------------------------
def require_admin(user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Sadece Editör erişebilir")
    return user


@api_router.get("/admin/reports")
async def admin_list_reports(user=Depends(require_admin), status: str = Query(default="open")):
    q = {"status": status} if status != "all" else {}
    cursor = db.reports.find(q, {"_id": 0}).sort("created_at", -1).limit(100)
    items = await cursor.to_list(length=100)
    # Enrich with whisper preview
    enriched = []
    for r in items:
        w = await db.whispers.find_one({"whisper_id": r["whisper_id"]}, {"_id": 0, "content": 1, "user_id": 1, "author_name": 1, "moderation_status": 1, "category": 1})
        r["whisper"] = w
        enriched.append(r)
    return enriched


@api_router.post("/admin/whispers/{whisper_id}/moderate")
async def admin_moderate_whisper(whisper_id: str, body: ModerateBody, user=Depends(require_admin)):
    w = await db.whispers.find_one({"whisper_id": whisper_id})
    if not w:
        raise HTTPException(status_code=404, detail="Fısıltı bulunamadı")
    if body.action == "delete":
        await db.whispers.delete_one({"whisper_id": whisper_id})
        await db.votes.delete_many({"whisper_id": whisper_id})
        await db.comments.delete_many({"whisper_id": whisper_id})
        await db.reports.update_many({"whisper_id": whisper_id}, {"$set": {"status": "resolved"}})
        return {"ok": True, "action": "deleted"}
    new_status = "hidden" if body.action == "hide" else "approved"
    await db.whispers.update_one({"whisper_id": whisper_id}, {"$set": {"moderation_status": new_status}})
    await db.reports.update_many({"whisper_id": whisper_id}, {"$set": {"status": "resolved"}})
    return {"ok": True, "action": body.action, "moderation_status": new_status}


@api_router.post("/admin/whispers/sponsored")
async def admin_create_sponsored(body: SponsoredWhisperCreate, user=Depends(require_admin)):
    if body.category not in CATEGORY_IDS:
        raise HTTPException(status_code=400, detail="Geçersiz kategori")
    content = body.content.strip()
    doc = {
        "whisper_id": new_id("w_"),
        "user_id": user["user_id"],
        "author_name": body.sponsor_name.strip(),
        "author_picture": None,
        "content": content,
        "category": body.category,
        "location": (body.location or "").strip() or None,
        "overheard_from": (body.overheard_from or "").strip() or None,
        "hashtags": extract_hashtags(content),
        "upvotes": 0,
        "downvotes": 0,
        "is_sponsored": True,
        "sponsor_name": body.sponsor_name.strip(),
        "sponsor_url": (body.sponsor_url or "").strip() or None,
        "is_boosted": False,
        "boost_expires_at": None,
        "moderation_status": "approved",
        "created_at": iso(now_utc()),
    }
    await db.whispers.insert_one(doc)
    return await serialize_whisper(doc, user)


# ---------------------------------------------------------------------------
# Boost / Stripe Checkout
# ---------------------------------------------------------------------------
@api_router.get("/boost/packages")
async def boost_packages():
    return [{"id": k, **v} for k, v in BOOST_PACKAGES.items()]


@api_router.post("/boost/checkout")
async def boost_checkout(body: BoostCheckoutBody, http_request: Request, user=Depends(get_current_user)):
    if body.package_id not in BOOST_PACKAGES:
        raise HTTPException(status_code=400, detail="Geçersiz paket")
    pkg = BOOST_PACKAGES[body.package_id]

    w = await db.whispers.find_one({"whisper_id": body.whisper_id})
    if not w:
        raise HTTPException(status_code=404, detail="Fısıltı bulunamadı")
    if w["user_id"] != user["user_id"]:
        raise HTTPException(status_code=403, detail="Sadece kendi fısıltını boost edebilirsin")

    api_key = os.environ.get("STRIPE_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="Ödeme servisi yapılandırılmamış")

    origin = body.origin_url.rstrip("/")
    success_url = f"{origin}/odeme/basarili?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin}/fisilti/{body.whisper_id}"

    metadata = {
        "kind": "boost",
        "user_id": user["user_id"],
        "whisper_id": body.whisper_id,
        "package_id": body.package_id,
        "hours": str(pkg["hours"]),
    }
    stripe.api_key = api_key
    session = stripe.checkout.Session.create(
        mode="payment",
        payment_method_types=["card"],
        line_items=[{
            "price_data": {
                "currency": pkg["currency"],
                "unit_amount": int(round(float(pkg["amount"]) * 100)),
                "product_data": {"name": pkg["label"]},
            },
            "quantity": 1,
        }],
        success_url=success_url,
        cancel_url=cancel_url,
        metadata=metadata,
    )

    await db.payment_transactions.insert_one({
        "transaction_id": new_id("pt_"),
        "session_id": session.id,
        "user_id": user["user_id"],
        "whisper_id": body.whisper_id,
        "package_id": body.package_id,
        "amount": float(pkg["amount"]),
        "currency": pkg["currency"],
        "payment_status": "pending",
        "status": "initiated",
        "metadata": metadata,
        "boost_applied": False,
        "created_at": iso(now_utc()),
    })
    return {"url": session.url, "session_id": session.id}


@api_router.get("/boost/status/{session_id}")
async def boost_status(session_id: str, http_request: Request):
    tx = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
    if not tx:
        raise HTTPException(status_code=404, detail="İşlem bulunamadı")

    api_key = os.environ.get("STRIPE_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="Ödeme servisi yapılandırılmamış")
    stripe.api_key = api_key
    status = stripe.checkout.Session.retrieve(session_id)

    # Update transaction (idempotent — only apply boost once)
    update = {
        "payment_status": status.payment_status,
        "status": status.status,
        "updated_at": iso(now_utc()),
    }
    await db.payment_transactions.update_one({"session_id": session_id}, {"$set": update})

    if status.payment_status == "paid" and not tx.get("boost_applied"):
        hours = int(tx.get("metadata", {}).get("hours", "24"))
        expires = iso(now_utc() + timedelta(hours=hours))
        await db.whispers.update_one(
            {"whisper_id": tx["whisper_id"]},
            {"$set": {"is_boosted": True, "boost_expires_at": expires}},
        )
        await db.payment_transactions.update_one(
            {"session_id": session_id},
            {"$set": {"boost_applied": True, "boost_expires_at": expires}},
        )

    return {
        "session_id": session_id,
        "payment_status": status.payment_status,
        "status": status.status,
        "amount_total": status.amount_total,
        "currency": status.currency,
        "whisper_id": tx["whisper_id"],
    }


@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    api_key = os.environ.get("STRIPE_API_KEY")
    webhook_secret = os.environ.get("STRIPE_WEBHOOK_SECRET")
    if not api_key:
        raise HTTPException(status_code=500, detail="Ödeme servisi yapılandırılmamış")
    stripe.api_key = api_key
    body = await request.body()
    signature = request.headers.get("Stripe-Signature", "")
    try:
        if webhook_secret:
            event = stripe.Webhook.construct_event(body, signature, webhook_secret)
        else:
            event = stripe.Event.construct_from(__import__("json").loads(body), stripe.api_key)
    except Exception as e:
        logging.warning(f"Stripe webhook verification failed: {e}")
        raise HTTPException(status_code=400, detail="invalid webhook")

    if event.get("type") != "checkout.session.completed":
        return {"ok": True}
    checkout_session = event["data"]["object"]
    session_id = checkout_session.get("id")
    if not session_id:
        return {"ok": True}

    tx = await db.payment_transactions.find_one({"session_id": session_id})
    if not tx:
        return {"ok": True}

    await db.payment_transactions.update_one(
        {"session_id": session_id},
        {"$set": {"payment_status": checkout_session.get("payment_status"), "updated_at": iso(now_utc())}},
    )

    if checkout_session.get("payment_status") == "paid" and not tx.get("boost_applied"):
        hours = int(tx.get("metadata", {}).get("hours", "24"))
        expires = iso(now_utc() + timedelta(hours=hours))
        await db.whispers.update_one(
            {"whisper_id": tx["whisper_id"]},
            {"$set": {"is_boosted": True, "boost_expires_at": expires}},
        )
        await db.payment_transactions.update_one(
            {"session_id": session_id},
            {"$set": {"boost_applied": True, "boost_expires_at": expires}},
        )
    return {"ok": True}


# ---------------------------------------------------------------------------
# Wiring
# ---------------------------------------------------------------------------
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', 'http://localhost:3000').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


async def seed_admin():
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@fisilti.com").lower().strip()
    admin_password = os.environ.get("ADMIN_PASSWORD", "Admin1234!")
    existing = await db.users.find_one({"email": admin_email})
    if existing is None:
        await db.users.insert_one({
            "user_id": new_id("u_"),
            "email": admin_email,
            "name": "Editör",
            "password_hash": hash_password(admin_password),
            "picture": None,
            "role": "admin",
            "auth_provider": "email",
            "created_at": iso(now_utc()),
        })
        logger.info(f"Admin seeded: {admin_email}")
    elif existing.get("password_hash") and not verify_password(admin_password, existing["password_hash"]):
        await db.users.update_one(
            {"email": admin_email},
            {"$set": {"password_hash": hash_password(admin_password), "role": "admin"}},
        )
        logger.info(f"Admin password updated: {admin_email}")


@app.on_event("startup")
async def on_startup():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("user_id", unique=True)
    try:
        await db.users.drop_index("username_1")
    except Exception:
        pass
    await db.users.create_index(
        "username",
        name="username_unique_string",
        unique=True,
        partialFilterExpression={"username": {"$type": "string"}},
    )
    await db.user_sessions.create_index("session_token", unique=True)
    await db.user_sessions.create_index("user_id")
    await db.whispers.create_index("whisper_id", unique=True)
    await db.whispers.create_index("created_at")
    await db.whispers.create_index("category")
    await db.whispers.create_index("user_id")
    await db.whispers.create_index("hashtags")
    await db.votes.create_index([("whisper_id", 1), ("user_id", 1)], unique=True)
    await db.comments.create_index("whisper_id")
    await db.follows.create_index([("follower_id", 1), ("followee_id", 1)], unique=True)
    await db.follows.create_index("followee_id")
    await db.blocks.create_index([("blocker_id", 1), ("blocked_id", 1)], unique=True)
    await db.blocks.create_index("blocked_id")
    await db.notifications.create_index([("user_id", 1), ("created_at", -1)])
    await db.notifications.create_index([("user_id", 1), ("read", 1)])
    await db.messages.create_index([("conversation_id", 1), ("created_at", -1)])
    await db.messages.create_index([("sender_id", 1), ("created_at", -1)])
    await db.messages.create_index([("recipient_id", 1), ("created_at", -1)])
    await db.reports.create_index([("whisper_id", 1), ("reporter_id", 1)])
    await db.reports.create_index("status")
    await db.payment_transactions.create_index("session_id", unique=True)
    await seed_admin()


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
