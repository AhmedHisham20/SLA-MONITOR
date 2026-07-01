from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.api.deps import require_admin, get_current_user
from app.models.user import User, UserRole
from app.models.user_permission import UserPermission, ALL_PERMISSIONS
from app.schemas.user_permission import (
    UserPermissionCreate,
    UserPermissionUpdate,
    UserPermissionResetPassword,
    UserPermissionResponse,
)
from app.core.security import get_password_hash
from app.api.permissions import invalidate_permission_cache

router = APIRouter(prefix="/users", tags=["User Management"])


@router.get("/me/permissions")
def my_permissions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _user_to_response(current_user, db)


def _user_to_response(user: User, db: Session) -> UserPermissionResponse:
    perms = [
        r.permission
        for r in db.query(UserPermission).filter(UserPermission.user_id == user.id).all()
    ]
    return UserPermissionResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role.value,
        is_active=user.is_active,
        permissions=perms,
        created_at=user.created_at,
    )


@router.get("", response_model=list[UserPermissionResponse])
def list_users(db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    users = db.query(User).order_by(User.created_at.desc()).all()
    return [_user_to_response(u, db) for u in users]


@router.post("", response_model=UserPermissionResponse, status_code=status.HTTP_201_CREATED)
def create_user(
    body: UserPermissionCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    existing = db.query(User).filter(User.email == body.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    for p in body.permissions:
        if p not in ALL_PERMISSIONS:
            raise HTTPException(status_code=400, detail=f"Invalid permission: {p}")

    user = User(
        email=body.email,
        hashed_password=get_password_hash(body.password),
        full_name=body.full_name,
        role=UserRole.MANAGER,
    )
    db.add(user)
    db.flush()

    for p in body.permissions:
        db.add(UserPermission(user_id=user.id, permission=p))

    db.commit()
    db.refresh(user)
    invalidate_permission_cache()
    return _user_to_response(user, db)


@router.get("/{user_id}", response_model=UserPermissionResponse)
def get_user(
    user_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return _user_to_response(user, db)


@router.put("/{user_id}", response_model=UserPermissionResponse)
def update_user(
    user_id: str,
    body: UserPermissionUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    if user_id == admin.id and body.is_active is False:
        raise HTTPException(status_code=400, detail="Cannot disable your own account")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if body.email is not None and body.email != user.email:
        existing = db.query(User).filter(User.email == body.email).first()
        if existing:
            raise HTTPException(status_code=400, detail="Email already in use")
        user.email = body.email
    if body.full_name is not None:
        user.full_name = body.full_name
    if body.is_active is not None:
        user.is_active = body.is_active

    if body.permissions is not None:
        for p in body.permissions:
            if p not in ALL_PERMISSIONS:
                raise HTTPException(status_code=400, detail=f"Invalid permission: {p}")
        db.query(UserPermission).filter(UserPermission.user_id == user_id).delete()
        for p in body.permissions:
            db.add(UserPermission(user_id=user_id, permission=p))

    db.commit()
    db.refresh(user)
    invalidate_permission_cache()
    return _user_to_response(user, db)


@router.delete("/{user_id}")
def delete_user(
    user_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    if user_id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    db.query(UserPermission).filter(UserPermission.user_id == user_id).delete()
    db.delete(user)
    db.commit()
    invalidate_permission_cache()
    return {"success": True, "message": "User deleted."}


@router.post("/{user_id}/reset-password")
def reset_password(
    user_id: str,
    body: UserPermissionResetPassword,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.hashed_password = get_password_hash(body.new_password)
    db.commit()
    return {"success": True, "message": "Password reset."}
