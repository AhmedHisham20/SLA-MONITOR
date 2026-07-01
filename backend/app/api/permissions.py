import re
from fastapi import Request, HTTPException, status
from starlette.middleware.base import BaseHTTPMiddleware
from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.core.security import decode_token
from app.models.user import User, UserRole
from app.models.user_permission import UserPermission
from app.core.config import settings
from app.core.logging import logger


PERMISSION_MAP = [
    (re.compile(r"^/api/v1/dashboard"), "dashboard"),
    (re.compile(r"^/api/v1/conversations"), "conversations"),
    (re.compile(r"^/api/v1/reports"), "reports"),
    (re.compile(r"^/api/v1/settings/pages"), "facebook_pages"),
    (re.compile(r"^/api/v1/whatsapp"), "whatsapp"),
    (re.compile(r"^/api/v1/logs"), "logs"),
    (re.compile(r"^/api/v1/backup"), "backup"),
    (re.compile(r"^/api/v1/users"), "user_management"),
    (re.compile(r"^/api/v1/settings"), "settings"),
]

PUBLIC_PREFIXES = [
    "/api/v1/auth/login",
    "/api/v1/auth/register",
    "/api/v1/webhooks",
    "/health",
    "/api/v1/demo",
    "/demo",
]

# Cached permission lookup to reduce DB queries
_permission_cache: dict[str, set[str]] = {}
_permission_cache_version = 0


def invalidate_permission_cache():
    global _permission_cache_version
    _permission_cache_version += 1


def _get_cached_permissions(user_id: str, db: Session) -> set[str]:
    cache_key = f"{user_id}:{_permission_cache_version}"
    if cache_key in _permission_cache:
        return _permission_cache[cache_key]

    rows = db.query(UserPermission).filter(UserPermission.user_id == user_id).all()
    perms = {r.permission for r in rows}
    _permission_cache[cache_key] = perms
    return perms


class PermissionMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        path = request.url.path

        # Skip public paths
        if any(path.startswith(p) for p in PUBLIC_PREFIXES):
            return await call_next(request)

        # Skip non-API paths (static files, frontend routes)
        if not path.startswith("/api/v1/"):
            return await call_next(request)

        # Skip GET requests to /api/v1/settings/pages (needed for login page)
        if path == "/api/v1/settings/pages" and request.method == "GET":
            return await call_next(request)

        # DEMO_MODE bypass
        if settings.DEMO_MODE:
            return await call_next(request)

        # Extract token from Authorization header
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return await call_next(request)

        token = auth_header[7:]
        payload = decode_token(token)
        if not payload:
            return await call_next(request)

        user_id = payload.get("sub")
        if not user_id:
            return await call_next(request)

        # Check if user is admin — admins have full access
        user_role = payload.get("role")
        if user_role == UserRole.ADMIN.value:
            return await call_next(request)

        # Determine required permission for this path
        required_perm = None
        for pattern, perm in PERMISSION_MAP:
            if pattern.search(path):
                required_perm = perm
                break

        if required_perm is None:
            # No specific permission required for this path
            return await call_next(request)

        # Check user's permissions
        db = SessionLocal()
        try:
            user_perms = _get_cached_permissions(user_id, db)
            if required_perm not in user_perms:
                logger.info(f"Permission denied: user={user_id} path={path} required={required_perm}")
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You don't have permission to access this resource.",
                )
        finally:
            db.close()

        return await call_next(request)
