from pydantic import BaseModel, EmailStr
from typing import List, Optional
from datetime import datetime
from app.models.user_permission import ALL_PERMISSIONS


class UserPermissionCreate(BaseModel):
    full_name: str
    email: EmailStr
    password: str
    permissions: List[str] = []


class UserPermissionUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None
    is_active: Optional[bool] = None
    permissions: Optional[List[str]] = None


class UserPermissionResetPassword(BaseModel):
    new_password: str


class UserPermissionResponse(BaseModel):
    id: str
    email: str
    full_name: str
    role: str
    is_active: bool
    permissions: List[str] = []
    created_at: datetime

    class Config:
        from_attributes = True
