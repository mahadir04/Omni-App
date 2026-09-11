"""Async SQLAlchemy engine, session factory, and declarative base."""

import ssl

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.config import settings

db_url = settings.database_url.strip()

# Normalize URL scheme to postgresql+asyncpg://
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql+asyncpg://", 1)
elif db_url.startswith("postgresql://"):
    db_url = db_url.replace("postgresql://", "postgresql+asyncpg://", 1)

# Strip sslmode query param (asyncpg uses connect_args instead)
if "?" in db_url:
    base_part, query_part = db_url.split("?", 1)
    params = [p for p in query_part.split("&") if not p.startswith("sslmode=")]
    db_url = f"{base_part}?{'&'.join(params)}" if params else base_part

# Supabase / any cloud Postgres requires SSL — pass via connect_args
ssl_ctx = ssl.create_default_context()
ssl_ctx.check_hostname = False
ssl_ctx.verify_mode = ssl.CERT_NONE  # disable cert verification for Supabase pooler

engine = create_async_engine(
    db_url,
    echo=settings.debug,
    pool_size=5,
    max_overflow=10,
    connect_args={
        "ssl": ssl_ctx,
        "statement_cache_size": 0,
        "prepared_statement_cache_size": 0,
    },
)

async_session_factory = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    """Base class for all ORM models."""
    pass
