from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.logging import logger
from app.db.session import engine, Base, SessionLocal
from app.api.routes import auth, dashboard, conversations, reports, settings as settings_routes, webhooks, whatsapp, logs, backup, users as users_routes, leads as leads_routes
from app.api.permissions import PermissionMiddleware
from app.tasks import start_scheduler


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(f"Starting {settings.APP_NAME}")
    Base.metadata.create_all(bind=engine)
    if settings.DEMO_MODE:
        logger.info("DEMO_MODE enabled - seeding demo data")
        db = SessionLocal()
        try:
            from app.services.demo import seed_demo_data
            seed_demo_data(db)
        finally:
            db.close()
    start_scheduler()
    yield
    logger.info("Shutting down...")


app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

api_prefix = "/api/v1"
app.include_router(auth.router, prefix=api_prefix)
app.include_router(dashboard.router, prefix=api_prefix)
app.include_router(conversations.router, prefix=api_prefix)
app.include_router(reports.router, prefix=api_prefix)
app.include_router(settings_routes.router, prefix=api_prefix)
app.include_router(webhooks.router, prefix=api_prefix)
app.include_router(whatsapp.router, prefix=api_prefix)
app.include_router(logs.router, prefix=api_prefix)
app.include_router(backup.router, prefix=api_prefix)
app.include_router(users_routes.router, prefix=api_prefix)
app.include_router(leads_routes.router, prefix=api_prefix)

app.add_middleware(PermissionMiddleware)


@app.get("/health")
def health_check():
    return {"status": "healthy", "app": settings.APP_NAME}


@app.get("/api/v1/demo/status")
@app.get("/demo/status")
def demo_status():
    return {"demo_mode": settings.DEMO_MODE}
