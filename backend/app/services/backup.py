import os
import io
import gzip
import zipfile
import subprocess
from datetime import datetime
from urllib.parse import urlparse
from fastapi import HTTPException
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
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


def _run_pg_command(cmd: list, input_data: str = None, timeout: int = 120) -> subprocess.CompletedProcess:
    db = _parse_db_url()
    env = os.environ.copy()
    env["PGPASSWORD"] = db["password"]
    try:
        result = subprocess.run(
            cmd, input=input_data, capture_output=True, text=True, env=env, timeout=timeout
        )
        return result
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=500, detail="Database command timed out")
    except FileNotFoundError:
        raise HTTPException(status_code=500, detail="PostgreSQL client not found. Ensure postgresql-client is installed.")


# ---------------------------------------------------------------------------
# Extract SQL content from uploaded file
# ---------------------------------------------------------------------------

def _extract_sql(content: bytes, filename: str) -> str:
    if filename.endswith(".zip"):
        with zipfile.ZipFile(io.BytesIO(content)) as zf:
            sql_files = [n for n in zf.namelist() if n.endswith(".sql") or n.endswith(".sql.gz")]
            if not sql_files:
                raise HTTPException(status_code=400, detail="No SQL file found in the uploaded ZIP archive.")
            sql_data = zf.read(sql_files[0])
            if sql_files[0].endswith(".gz"):
                return gzip.decompress(sql_data).decode("utf-8")
            return sql_data.decode("utf-8")
    elif filename.endswith(".sql.gz"):
        return gzip.decompress(content).decode("utf-8")
    elif filename.endswith(".sql"):
        return content.decode("utf-8")
    raise HTTPException(status_code=400, detail="Unsupported file format. Use .zip, .sql, or .sql.gz")


# ---------------------------------------------------------------------------
# Step 1 — Close all active database sessions
# ---------------------------------------------------------------------------

def _close_db_connections():
    import app.db.session as db_session
    logger.info("Restore step 1/7: Closing all active database sessions...")
    db_session.engine.dispose()
    logger.info("All database connections closed.")


# ---------------------------------------------------------------------------
# Step 2 — Restore the database (existing implementation)
# ---------------------------------------------------------------------------

def _restore_database(sql_content: str):
    db = _parse_db_url()
    logger.info("Restore step 2/7: Restoring database...")
    cmd = [
        "psql",
        "-h", db["host"],
        "-p", str(db["port"]),
        "-U", db["user"],
        "-d", db["dbname"],
    ]
    result = _run_pg_command(cmd, input_data=sql_content, timeout=120)
    if result.returncode != 0:
        logger.error(f"Restore failed (code {result.returncode}): {result.stderr}")
        raise HTTPException(status_code=500, detail=f"Database restore failed: {result.stderr}")
    logger.info("Database restored successfully.")


# ---------------------------------------------------------------------------
# Step 3 — Clear application cache
# ---------------------------------------------------------------------------

async def _clear_cache():
    logger.info("Restore step 3/7: Clearing application cache...")
    try:
        from app.services.cache import get_redis
        r = await get_redis()
        if r is None:
            logger.info("Redis not configured — skipping cache clear.")
            return
        await r.flushdb()
        logger.info("Application cache cleared.")
    except Exception:
        logger.warning("Redis unavailable — skipping cache clear.")


# ---------------------------------------------------------------------------
# Step 4 — Recreate database connections
# ---------------------------------------------------------------------------

def _recreate_db_connections():
    logger.info("Restore step 4/7: Recreating database connections...")
    import app.db.session as db_session
    new_engine = create_engine(
        settings.DATABASE_URL,
        pool_pre_ping=True,
        pool_size=20,
        max_overflow=10,
    )
    new_session = sessionmaker(autocommit=False, autoflush=False, bind=new_engine)
    db_session.engine = new_engine
    db_session.SessionLocal = new_session
    logger.info("Database connections recreated.")


# ---------------------------------------------------------------------------
# Step 5 — Reload application configuration from restored database
# ---------------------------------------------------------------------------

async def _reload_config():
    logger.info("Restore step 5/7: Reloading application configuration...")
    from app.db.session import SessionLocal
    try:
        db = SessionLocal()
        from app.models.settings import SystemSettings
        settings_obj = db.query(SystemSettings).first()
        if settings_obj:
            logger.info(f"System settings loaded: company={settings_obj.company_name}")
        else:
            logger.warning("No SystemSettings found in restored database.")
        db.close()
    except Exception as e:
        logger.error(f"Failed to reload config: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to reload configuration: {str(e)}")


# ---------------------------------------------------------------------------
# Step 6 — Restart background scheduler
# ---------------------------------------------------------------------------

def _restart_scheduler():
    logger.info("Restore step 6/7: Restarting background scheduler...")
    import app.tasks as tasks_module
    try:
        tasks_module.scheduler.shutdown(wait=False)
    except Exception:
        pass
    from apscheduler.schedulers.asyncio import AsyncIOScheduler
    new_scheduler = AsyncIOScheduler()
    tasks_module.scheduler = new_scheduler
    tasks_module.start_scheduler()
    logger.info("Scheduler restarted.")


# ---------------------------------------------------------------------------
# Step 7 — Verify the restore
# ---------------------------------------------------------------------------

async def _verify_restore() -> dict:
    logger.info("Restore step 7/7: Verifying system health...")
    results = {"database": False, "tables": False, "scheduler": False, "redis": False}

    # Database reachable
    try:
        from app.db.session import SessionLocal, engine
        db = SessionLocal()
        db.execute(text("SELECT 1"))
        results["database"] = True
        logger.info("  Database reachable: YES")

        # Tables exist
        table_count = db.execute(
            text("SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'")
        ).scalar()
        results["tables"] = table_count > 0
        logger.info(f"  Tables found: {table_count} ({'YES' if table_count > 0 else 'NO'})")
        db.close()
    except Exception as e:
        logger.error(f"  Database verification failed: {e}")
        raise HTTPException(status_code=500, detail=f"Database unreachable after restore: {str(e)}")

    # Scheduler running
    import app.tasks as tasks_module
    results["scheduler"] = getattr(tasks_module.scheduler, "running", False)
    logger.info(f"  Scheduler running: {'YES' if results['scheduler'] else 'NO'}")
    if not results["scheduler"]:
        raise HTTPException(status_code=500, detail="Scheduler failed to restart after restore.")

    # Redis connected
    try:
        from app.services.cache import get_redis
        r = await get_redis()
        if r:
            await r.ping()
            results["redis"] = True
            logger.info("  Redis connected: YES")
        else:
            logger.info("  Redis not configured — skipping.")
    except Exception:
        logger.info("  Redis unavailable — skipping.")

    return results


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

async def create_database_dump() -> bytes:
    db = _parse_db_url()
    cmd = [
        "pg_dump",
        "-h", db["host"],
        "-p", str(db["port"]),
        "-U", db["user"],
        "-d", db["dbname"],
        "--no-owner",
        "--no-acl",
    ]
    result = _run_pg_command(cmd, timeout=60)
    if result.returncode != 0:
        logger.error(f"pg_dump failed (code {result.returncode}): {result.stderr}")
        raise HTTPException(status_code=500, detail=f"Database dump failed: {result.stderr}")
    return gzip.compress(result.stdout.encode())


async def create_full_backup() -> bytes:
    db_dump = await create_database_dump()
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("database.sql.gz", db_dump)
        env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
        if os.path.exists(env_path):
            zf.write(env_path, "config/.env")
        if os.path.isdir(settings.UPLOAD_DIR):
            for root, _dirs, files in os.walk(settings.UPLOAD_DIR):
                for file in files:
                    file_path = os.path.join(root, file)
                    arcname = os.path.join("uploads", os.path.relpath(file_path, settings.UPLOAD_DIR))
                    zf.write(file_path, arcname)
    buf.seek(0)
    return buf.getvalue()


async def restore_from_file(content: bytes, filename: str) -> dict:
    sql_content = _extract_sql(content, filename)

    try:
        _close_db_connections()
    except Exception:
        logger.exception("Step 1 (close connections) failed")
        raise HTTPException(status_code=500, detail="Failed to close database connections before restore.")

    try:
        _restore_database(sql_content)
    except HTTPException:
        raise
    except Exception:
        logger.exception("Step 2 (database restore) failed")
        raise HTTPException(status_code=500, detail="Database restore failed. System may be in an inconsistent state.")

    try:
        await _clear_cache()
    except Exception:
        logger.exception("Step 3 (cache clear) failed — continuing")

    try:
        _recreate_db_connections()
    except Exception:
        logger.exception("Step 4 (recreate connections) failed")
        raise HTTPException(status_code=500, detail="Failed to recreate database connections after restore.")

    try:
        await _reload_config()
    except Exception:
        logger.exception("Step 5 (reload config) failed")
        raise HTTPException(status_code=500, detail="Failed to reload configuration after restore.")

    try:
        _restart_scheduler()
    except Exception:
        logger.exception("Step 6 (restart scheduler) failed")
        raise HTTPException(status_code=500, detail="Failed to restart scheduler after restore.")

    verification = await _verify_restore()

    return {
        "success": True,
        "message": "Database restored successfully.",
        "scheduler_restarted": True,
        "cache_cleared": True,
        "verification": verification,
    }
