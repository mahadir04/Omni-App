"""Async SQLAlchemy engine, session factory, and declarative base."""

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.config import settings

db_url = settings.database_url
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql+asyncpg://", 1)
elif db_url.startswith("postgresql://"):
    db_url = db_url.replace("postgresql://", "postgresql+asyncpg://", 1)

# Remove incompatible query parameters if present for asyncpg
if "?" in db_url and "sslmode=" in db_url:
    base_part, query_part = db_url.split("?", 1)
    params = [p for p in query_part.split("&") if not p.startswith("sslmode=")]
    db_url = f"{base_part}?{'&'.join(params)}" if params else base_part

engine = create_async_engine(
    db_url,
    echo=settings.debug,
    pool_size=10,
    max_overflow=20,
)

async_session_factory = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    """Base class for all ORM models."""
    pass
