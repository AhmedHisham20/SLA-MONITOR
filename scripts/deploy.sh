#!/bin/bash
set -e

echo "=================================="
echo "Messenger SLA Monitor - Deployment"
echo "=================================="

# Prerequisites check
command -v docker >/dev/null 2>&1 || { echo "Docker is required but not installed."; exit 1; }
command -v docker-compose >/dev/null 2>&1 || { echo "Docker Compose is required but not installed."; exit 1; }

echo "1. Setting up environment files..."
if [ ! -f backend/.env ]; then
    cp backend/.env.example backend/.env
    echo "   Created backend/.env from example. PLEASE UPDATE SECRETS!"
fi

echo "2. Building and starting containers..."
docker-compose build
docker-compose up -d db redis

echo "   Waiting for database to be ready..."
sleep 10

echo "3. Running database migrations..."
docker-compose run --rm backend alembic upgrade head 2>/dev/null || echo "   (Tables created by SQLAlchemy on first run)"

echo "4. Seeding database..."
docker-compose run --rm backend python seed.py

echo "5. Starting all services..."
docker-compose up -d

echo ""
echo "=================================="
echo "Deployment complete!"
echo "Frontend: http://localhost"
echo "Backend API: http://localhost:8000"
echo "API Docs: http://localhost:8000/docs"
echo ""
echo "Default login: ahmed.hisham191220@gmail.com / 01015177863@@E"
echo "=================================="
echo ""
echo "IMPORTANT: Update these secrets in backend/.env:"
echo "  - JWT_SECRET_KEY"
echo "  - FACEBOOK_*"
echo "  - WHATSAPP_*"
