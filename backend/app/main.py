from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .config import settings
from .database import init_db, client, db, serialize_doc
from .routers import reviews, moderation, analytics, metadata

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: initialize MongoDB collections and indexes (zero seed reviews)
    init_db()
    yield
    # Shutdown
    client.close()

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Scalable Production-Ready MongoDB Review & Moderation Telemetry Backend",
    version="1.0.0",
    lifespan=lifespan
)

# Enable CORS for frontend Vite development and production
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API routers
app.include_router(metadata.router, prefix=settings.API_V1_STR)
app.include_router(reviews.router, prefix=settings.API_V1_STR)
app.include_router(moderation.router, prefix=settings.API_V1_STR)
app.include_router(analytics.router, prefix=settings.API_V1_STR)

@app.get("/api/health")
def healthcheck():
    try:
        # Ping MongoDB
        client.admin.command('ping')
        mongo_status = "connected"
    except Exception as e:
        mongo_status = f"error: {str(e)}"

    return {
        "status": "healthy" if mongo_status == "connected" else "degraded",
        "service": "PulseReview Enterprise API",
        "database": "MongoDB",
        "database_status": mongo_status,
        "database_name": settings.DATABASE_NAME,
        "version": "1.0.0"
    }

@app.get("/")
def root():
    return {
        "message": "Welcome to PulseReview API backed by MongoDB. Explore /docs for OpenAPI specs."
    }
