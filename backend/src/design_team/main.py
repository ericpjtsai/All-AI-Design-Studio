"""FastAPI application entry point."""
from __future__ import annotations

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

from .api.routes import router  # noqa: E402 (import after load_dotenv)

app = FastAPI(
    title="AI Design Studio API",
    description="Multi-agent design team orchestration backend",
    version="0.1.0",
)

# Allow the Vite dev server to talk to us
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3001", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("design_team.main:app", host="0.0.0.0", port=8000, reload=True)
