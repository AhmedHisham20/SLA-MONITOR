from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.security import decode_token
from app.models.user import User, UserRole
from app.core.config import settings
from app.core.logging import logger

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)

_demo_user_cache = None


def _get_or_create_demo_user(db: Session) -> User:
    global _demo_user_cache
    if _demo_user_cache:
        return _demo_user_cache
    user = db.query(User).filter(User.email == "demo@slamonitor.local").first()
    if not user:
        from app.core.security import get_password_hash
        user = User(
            email="demo@slamonitor.local",
            hashed_password=get_password_hash("demo"),
            full_name="Demo Admin",
            role=UserRole.ADMIN,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        logger.info("Created demo user for DEMO_MODE")
    _demo_user_cache = user
    return user


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    if settings.DEMO_MODE:
        return _get_or_create_demo_user(db)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


def require_admin(user: User = Depends(get_current_user)) -> User:
    if settings.DEMO_MODE:
        return user
    if user.role != UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return user


def get_optional_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    if settings.DEMO_MODE:
        return _get_or_create_demo_user(db)
    if not token:
        return None
    payload = decode_token(token)
    if not payload:
        return None
    user_id = payload.get("sub")
    if not user_id:
        return None
    return db.query(User).filter(User.id == user_id).first()
