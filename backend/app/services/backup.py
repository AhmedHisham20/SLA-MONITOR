import os
import io
import gzip
import zipfile
import subprocess
from datetime import datetime
from urllib.parse import urlparse
from fastapi import HTTPException
from app.core.config import settings
from app.core.logging import logger


def _parse_db_url():
    result = urlparse(settings.DATABASE_URL)
    return {
        "host": result.hostname or "localhost",
        "port": result.port or 5432,
        "user": result.username or "postgres",
        "password": result.password or "postgres",
        "dbname": result.path.lstrip("/") or "messenger_sla",
    }


async def create_database_dump() -> bytes:
    db = _parse_db_url()
    env = os.environ.copy()
    env["PGPASSWORD"] = db["password"]

    cmd = [
        "pg_dump",
        "-h", db["host"],
        "-p", str(db["port"]),
        "-U", db["user"],
        "-d", db["dbname"],
        "--no-owner",
        "--no-acl",
    ]

    try:
        result = subprocess.run(cmd, capture_output=True, text=True, env=env, timeout=60)
        if result.returncode != 0:
            logger.error(f"pg_dump failed (code {result.returncode}): {result.stderr}")
            raise HTTPException(status_code=500, detail=f"Database dump failed: {result.stderr}")
        compressed = gzip.compress(result.stdout.encode())
        return compressed
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=500, detail="Database dump timed out")
    except FileNotFoundError:
        raise HTTPException(status_code=500, detail="pg_dump not found. Ensure postgresql-client is installed in the container.")


async def create_full_backup() -> bytes:
    db_dump = await create_database_dump()

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("database.sql.gz", db_dump)

        env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
        if os.path.exists(env_path):
            zf.write(env_path, "config/.env")

        uploads_path = settings.UPLOAD_DIR
        if os.path.isdir(uploads_path):
            for root, _dirs, files in os.walk(uploads_path):
                for file in files:
                    file_path = os.path.join(root, file)
                    arcname = os.path.join("uploads", os.path.relpath(file_path, uploads_path))
                    zf.write(file_path, arcname)

    buf.seek(0)
    return buf.getvalue()


async def restore_from_file(content: bytes, filename: str) -> dict:
    db = _parse_db_url()
    env = os.environ.copy()
    env["PGPASSWORD"] = db["password"]

    sql_content = None

    if filename.endswith(".zip"):
        with zipfile.ZipFile(io.BytesIO(content)) as zf:
            sql_files = [n for n in zf.namelist() if n.endswith(".sql") or n.endswith(".sql.gz")]
            if not sql_files:
                raise HTTPException(status_code=400, detail="No SQL file found in the uploaded ZIP archive.")
            sql_data = zf.read(sql_files[0])
            if sql_files[0].endswith(".gz"):
                sql_content = gzip.decompress(sql_data).decode("utf-8")
            else:
                sql_content = sql_data.decode("utf-8")
    elif filename.endswith(".sql.gz"):
        sql_content = gzip.decompress(content).decode("utf-8")
    elif filename.endswith(".sql"):
        sql_content = content.decode("utf-8")
    else:
        raise HTTPException(status_code=400, detail="Unsupported file format. Use .zip, .sql, or .sql.gz")

    cmd = [
        "psql",
        "-h", db["host"],
        "-p", str(db["port"]),
        "-U", db["user"],
        "-d", db["dbname"],
    ]

    try:
        result = subprocess.run(cmd, input=sql_content, capture_output=True, text=True, env=env, timeout=120)
        if result.returncode != 0:
            logger.error(f"Restore failed (code {result.returncode}): {result.stderr}")
            raise HTTPException(status_code=500, detail=f"Database restore failed: {result.stderr}")
        return {"success": True, "message": "Database restored successfully."}
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=500, detail="Database restore timed out")
    except FileNotFoundError:
        raise HTTPException(status_code=500, detail="psql not found. Ensure postgresql-client is installed in the container.")
