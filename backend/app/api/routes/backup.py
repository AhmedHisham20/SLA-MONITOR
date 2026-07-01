from datetime import datetime
from fastapi import APIRouter, Depends, UploadFile, File
from fastapi.responses import Response
from app.api.deps import require_admin
from app.models.user import User
from app.services.backup import create_database_dump, create_full_backup, restore_from_file

router = APIRouter(prefix="/backup", tags=["Backup & Restore"])


@router.post("/database")
async def backup_database(admin: User = Depends(require_admin)):
    data = await create_database_dump()
    filename = f"backup-{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.sql.gz"
    return Response(
        content=data,
        media_type="application/gzip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/full")
async def backup_full(admin: User = Depends(require_admin)):
    data = await create_full_backup()
    filename = f"full-backup-{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.zip"
    return Response(
        content=data,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/restore")
async def backup_restore(
    file: UploadFile = File(...),
    admin: User = Depends(require_admin),
):
    content = await file.read()
    result = await restore_from_file(content, file.filename or "backup.sql")
    return result


@router.get("/info")
async def backup_info(admin: User = Depends(require_admin)):
    return {
        "types": ["database", "full"],
        "supported_restore_formats": [".zip", ".sql", ".sql.gz"],
    }
