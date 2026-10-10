"""Optional authenticated inference service for a separate, adequately sized host.

Install requirements-rag-local.txt first. Run as one process:
uvicorn app.rag_worker:app --host 127.0.0.1 --port 8001
Use HTTPS/reverse proxy if the API VM accesses this worker remotely.
No database is needed here. Model downloads require explicit opt-in.
"""

import secrets
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel, ConfigDict, Field

from app.config import settings
from app.services.retrieval_inference import Inference, InferenceUnavailable


@asynccontextmanager
async def lifespan(app):
    local_config = settings.model_copy(update={"rag_inference_mode": "local"})
    app.state.inference = Inference(local_config)
    try:
        yield
    finally:
        app.state.inference.close()


app = FastAPI(title="Fireflies optional inference worker", lifespan=lifespan)


def authorize(authorization: str = Header(default="")):
    key = settings.rag_worker_key.get_secret_value()
    if not key or not secrets.compare_digest(authorization.encode(), ("Bearer " + key).encode()):
        raise HTTPException(401, "Worker authentication required")


class EmbeddingRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    model: str
    revision: str
    texts: list[str] = Field(min_length=1, max_length=32)


class RerankRequest(EmbeddingRequest):
    query: str = Field(min_length=1, max_length=4000)


def bounded_texts(texts):
    if any(not value.strip() or len(value) > 4000 for value in texts):
        raise HTTPException(422, "Text must contain 1–4000 characters")


@app.post("/embed", dependencies=[Depends(authorize)])
def embed(body: EmbeddingRequest):
    bounded_texts(body.texts)
    if body.model != settings.rag_embedding_model or body.revision != settings.rag_embedding_revision:
        raise HTTPException(422, "Embedding model/version mismatch")
    try:
        values = app.state.inference.embed(body.texts)
    except InferenceUnavailable:
        raise HTTPException(503, "Embedding inference unavailable") from None
    return {"identity": app.state.inference.identity, "vectors": values}


@app.post("/rerank", dependencies=[Depends(authorize)])
def rerank(body: RerankRequest):
    bounded_texts(body.texts)
    if body.model != settings.rag_reranker_model or body.revision != settings.rag_reranker_revision:
        raise HTTPException(422, "Reranker model/version mismatch")
    try:
        scores = app.state.inference.rerank(body.query, body.texts)
    except InferenceUnavailable:
        raise HTTPException(503, "Reranking inference unavailable") from None
    identity = settings.rag_reranker_model + "@" + (settings.rag_reranker_revision or "default")
    return {"identity": identity, "scores": scores}
