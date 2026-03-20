"""
Auth endpoints: register, login, refresh token, logout.
JWT access token (15 min) + Refresh token rotation (7 days).
"""
from fastapi import APIRouter, Depends, HTTPException, status, Response, Cookie
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId
from datetime import datetime
from typing import Optional

from app.core.database import get_db
from app.core.security import (
    hash_password, verify_password,
    create_access_token, create_refresh_token, decode_token
)
from app.core.config import settings
from app.schemas.auth import (
    UserRegisterRequest, UserLoginRequest, TokenResponse,
    RefreshTokenRequest, UserResponse
)
from app.api.seed_categories import seed_default_categories
from app.api.deps import get_current_user


router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse, status_code=201)
async def register(
    body: UserRegisterRequest,
    response: Response,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Register a new user. Seeds default categories on success."""
    # Check duplicate email
    existing = await db.users.find_one({"email": body.email})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    # Create user document
    user_doc = {
        "email": body.email,
        "hashed_password": hash_password(body.password),
        "full_name": body.full_name,
        "base_currency": body.base_currency,
        "is_active": True,
        "created_at": datetime.utcnow(),
    }
    result = await db.users.insert_one(user_doc)
    user_id = str(result.inserted_id)

    # Seed default categories + user preferences
    await seed_default_categories(db, user_id)
    await db.user_preferences.insert_one({
        "user_id": user_id,
        "base_currency": body.base_currency,
        "ai_calls_today": 0,
        "theme": "dark",
        "sidebar_collapsed": False,
        "ml_features_enabled": True,
        "created_at": datetime.utcnow(),
    })

    # Issue tokens
    access_token = create_access_token(user_id)
    refresh_token = create_refresh_token(user_id)

    # Set refresh token as httpOnly cookie
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=not settings.DEBUG,
        samesite="none",
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400,
        path="/",
    )

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
    )


@router.post("/login", response_model=TokenResponse)
async def login(
    body: UserLoginRequest,
    response: Response,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Authenticate user and return access + refresh tokens."""
    user = await db.users.find_one({"email": body.email})
    if not user or not verify_password(body.password, user["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if not user.get("is_active", True):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled",
        )

    user_id = str(user["_id"])
    access_token = create_access_token(user_id)
    refresh_token = create_refresh_token(user_id)

    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=not settings.DEBUG,
        samesite="lax",
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400,
    )

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(
    response: Response,
    body: Optional[RefreshTokenRequest] = None,
    refresh_token_cookie: Optional[str] = Cookie(None, alias="refresh_token"),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """
    Rotate refresh token.
    Accepts token from httpOnly cookie OR request body (client flexibility).
    """
    token = None
    if refresh_token_cookie:
        token = refresh_token_cookie
    elif body and body.refresh_token:
        token = body.refresh_token

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token required",
        )

    payload = decode_token(token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )

    user_id = payload.get("sub")
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user or not user.get("is_active", True):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
        )

    # Issue new token pair (rotation)
    new_access = create_access_token(user_id)
    new_refresh = create_refresh_token(user_id)

    response.set_cookie(
        key="refresh_token",
        value=new_refresh,
        httponly=True,
        secure=not settings.DEBUG,
        samesite="lax",
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400,
    )

    return TokenResponse(
        access_token=new_access,
        refresh_token=new_refresh,
    )


@router.post("/logout", status_code=204)
async def logout(response: Response):
    """Clear the httpOnly refresh token cookie."""
    response.delete_cookie("refresh_token")
    return None


@router.get("/me", response_model=UserResponse)
async def get_me(
    current_user: dict = Depends(get_current_user),
):
    """Return the current authenticated user's profile."""
    return UserResponse(
        id=current_user["id"],
        email=current_user["email"],
        full_name=current_user.get("full_name"),
        base_currency=current_user.get("base_currency", "INR"),
        is_active=current_user.get("is_active", True),
    )
