from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import uuid
import logging
import bcrypt
import httpx
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Literal

from fastapi import FastAPI, APIRouter, Request, Response, HTTPException, Depends, Query
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr


# ---------------------------------------------------------------------------
# Database
# ---------------------------------------------------------------------------
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]


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
EMERGENT_SESSION_URL = "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"


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


class CommentCreate(BaseModel):
    content: str = Field(min_length=1, max_length=400)


class VoteBody(BaseModel):
    value: Literal[1, -1]


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


def public_user(doc: dict) -> dict:
    return {
        "user_id": doc["user_id"],
        "email": doc["email"],
        "name": doc.get("name", ""),
        "picture": doc.get("picture"),
        "role": doc.get("role", "user"),
        "auth_provider": doc.get("auth_provider", "email"),
        "created_at": doc.get("created_at"),
    }


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
    response.set_cookie(
        key="session_token",
        value=token,
        httponly=True,
        secure=True,
        samesite="none",
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
    async with httpx.AsyncClient(timeout=15.0) as http_client:
        try:
            r = await http_client.get(
                EMERGENT_SESSION_URL,
                headers={"X-Session-ID": body.session_id},
            )
        except httpx.HTTPError:
            raise HTTPException(status_code=502, detail="Auth servisine ulaşılamadı")

    if r.status_code != 200:
        raise HTTPException(status_code=401, detail="Geçersiz session_id")
    data = r.json()
    email = data.get("email", "").lower().strip()
    if not email:
        raise HTTPException(status_code=400, detail="Email alınamadı")

    user = await db.users.find_one({"email": email})
    if user is None:
        user_id = new_id("u_")
        user = {
            "user_id": user_id,
            "email": email,
            "name": data.get("name", email.split("@")[0]),
            "password_hash": None,
            "picture": data.get("picture"),
            "role": "user",
            "auth_provider": "google",
            "created_at": iso(now_utc()),
        }
        await db.users.insert_one(user)
    else:
        update = {}
        if not user.get("picture") and data.get("picture"):
            update["picture"] = data.get("picture")
        if user.get("auth_provider") != "google" and not user.get("password_hash"):
            update["auth_provider"] = "google"
        if update:
            await db.users.update_one({"user_id": user["user_id"]}, {"$set": update})
            user.update(update)

    # Use emergent session_token if provided, else create our own
    session_token = data.get("session_token") or uuid.uuid4().hex + uuid.uuid4().hex
    await db.user_sessions.insert_one({
        "session_token": session_token,
        "user_id": user["user_id"],
        "expires_at": iso(now_utc() + timedelta(days=SESSION_DAYS)),
        "created_at": iso(now_utc()),
    })
    set_session_cookie(response, session_token)
    return {"user": public_user(user)}


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
    return {
        "whisper_id": w["whisper_id"],
        "content": w["content"],
        "category": w["category"],
        "location": w.get("location"),
        "overheard_from": w.get("overheard_from"),
        "author_id": w["user_id"],
        "author_name": w.get("author_name", "Anonim"),
        "author_picture": w.get("author_picture"),
        "upvotes": w.get("upvotes", 0),
        "downvotes": w.get("downvotes", 0),
        "score": w.get("upvotes", 0) - w.get("downvotes", 0),
        "my_vote": my_vote,
        "comment_count": comment_count,
        "created_at": w["created_at"],
    }


@api_router.get("/categories")
async def list_categories():
    return CATEGORIES


@api_router.get("/whispers")
async def list_whispers(
    request: Request,
    category: Optional[str] = Query(default=None),
    sort: Literal["new", "top", "trending"] = Query(default="new"),
    limit: int = Query(default=30, ge=1, le=100),
):
    q = {}
    if category and category != "all":
        if category not in CATEGORY_IDS:
            raise HTTPException(status_code=400, detail="Geçersiz kategori")
        q["category"] = category

    cursor = db.whispers.find(q, {"_id": 0})
    if sort == "new":
        cursor = cursor.sort("created_at", -1)
    else:
        # for "top" and "trending" we'll sort in python by score (and recency for trending)
        cursor = cursor.sort("created_at", -1)

    docs = await cursor.to_list(length=200)

    if sort == "top":
        docs.sort(key=lambda d: (d.get("upvotes", 0) - d.get("downvotes", 0)), reverse=True)
    elif sort == "trending":
        # weighted: score - hours_since/4
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
        docs.sort(key=trending_key, reverse=True)

    docs = docs[:limit]
    current = await get_optional_user(request)
    return [await serialize_whisper(d, current) for d in docs]


@api_router.post("/whispers")
async def create_whisper(body: WhisperCreate, user=Depends(get_current_user)):
    if body.category not in CATEGORY_IDS:
        raise HTTPException(status_code=400, detail="Geçersiz kategori")

    doc = {
        "whisper_id": new_id("w_"),
        "user_id": user["user_id"],
        "author_name": user.get("name", "Anonim"),
        "author_picture": user.get("picture"),
        "content": body.content.strip(),
        "category": body.category,
        "location": (body.location or "").strip() or None,
        "overheard_from": (body.overheard_from or "").strip() or None,
        "upvotes": 0,
        "downvotes": 0,
        "created_at": iso(now_utc()),
    }
    await db.whispers.insert_one(doc)
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
    return doc


# ---------------------------------------------------------------------------
# Profile
# ---------------------------------------------------------------------------
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

    return {
        "user_id": user["user_id"],
        "name": user.get("name", "Anonim"),
        "picture": user.get("picture"),
        "created_at": user.get("created_at"),
        "is_following": is_following,
        "is_self": is_self,
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

    follower_count = await db.follows.count_documents({"followee_id": user_id})
    return {"is_following": is_following, "follower_count": follower_count}


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


@api_router.get("/")
async def root():
    return {"app": "Fısıltı Gazetesi", "status": "ok"}


# ---------------------------------------------------------------------------
# Wiring
# ---------------------------------------------------------------------------
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
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
    await db.user_sessions.create_index("session_token", unique=True)
    await db.user_sessions.create_index("user_id")
    await db.whispers.create_index("whisper_id", unique=True)
    await db.whispers.create_index("created_at")
    await db.whispers.create_index("category")
    await db.whispers.create_index("user_id")
    await db.votes.create_index([("whisper_id", 1), ("user_id", 1)], unique=True)
    await db.comments.create_index("whisper_id")
    await db.follows.create_index([("follower_id", 1), ("followee_id", 1)], unique=True)
    await db.follows.create_index("followee_id")
    await seed_admin()


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
