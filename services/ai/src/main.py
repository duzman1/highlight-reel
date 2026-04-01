from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routers.analyze import router as analyze_router

app = FastAPI(
    title="HighlightReel AI Service",
    description="Video analysis microservice for detecting sports highlights",
    version="0.1.0",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "ai-analyzer"}


app.include_router(analyze_router, prefix="/api", tags=["Analysis"])
