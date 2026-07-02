"""Seed script to create initial admin user and default settings."""
from app.db.session import SessionLocal, engine, Base
from app.core.security import get_password_hash
from app.models.user import User, UserRole
from app.models.settings import SystemSettings


def seed():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        existing_admin = db.query(User).filter(User.email == "ahmed.hisham191220@gmail.com").first()
        if not existing_admin:
            admin = User(
                email="ahmed.hisham191220@gmail.com",
                hashed_password=get_password_hash("01015177863@@E"),
                full_name="Admin User",
                role=UserRole.ADMIN,
            )
            db.add(admin)
            print("Admin user created: ahmed.hisham191220@gmail.com / 01015177863@@E")
        else:
            print("Admin user already exists")

        existing_mgr = db.query(User).filter(User.email == "manager@example.com").first()
        if not existing_mgr:
            manager = User(
                email="manager@example.com",
                hashed_password=get_password_hash("manager123"),
                full_name="Manager User",
                role=UserRole.MANAGER,
            )
            db.add(manager)
            print("Manager user created: manager@example.com / manager123")

        settings = db.query(SystemSettings).first()
        if not settings:
            settings = SystemSettings()
            db.add(settings)
            print("Default settings created")

        db.commit()
        print("Seed completed successfully!")
    except Exception as e:
        print(f"Seed error: {e}")
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    seed()
