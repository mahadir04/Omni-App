"""Auth service — password hashing, JWT creation, user registration/login."""

from datetime import datetime, timedelta, timezone

from jose import jwt
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.user import User
from app.models.automation_rule import AutomationRule

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(user_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.access_token_expire_minutes
    )
    to_encode = {"sub": user_id, "exp": expire}
    return jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)


async def register_user(
    db: AsyncSession, email: str, full_name: str, password: str
) -> User:
    """Create a new user + default automation rules (per Flow A onboarding defaults)."""
    # Check for existing user
    existing = await db.execute(select(User).where(User.email == email))
    if existing.scalar_one_or_none():
        raise ValueError("Email already registered")

    user = User(
        email=email,
        full_name=full_name,
        password_hash=hash_password(password),
    )
    db.add(user)
    await db.flush()  # get user.id

    # Create default automation rules per doc 3 Flow A step 7:
    # Human-in-the-Loop, 85% confidence, VIP bypass ON, negative sentiment alert ON
    default_rules = AutomationRule(
        user_id=user.id,
        master_switch_enabled=True,
        response_strategy="human_in_the_loop",
        confidence_threshold=85.00,
        notify_on_negative_sentiment=True,
        bypass_automation_for_vip=True,
        forward_financial_queries=True,
        status="approved",
    )
    db.add(default_rules)
    await db.commit()
    await db.refresh(user)
    return user


async def authenticate_user(
    db: AsyncSession, email: str, password: str
) -> User | None:
    """Verify credentials and return User, or None if invalid."""
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if user is None or user.password_hash is None:
        return None
    if not verify_password(password, user.password_hash):
        return None
    return user
