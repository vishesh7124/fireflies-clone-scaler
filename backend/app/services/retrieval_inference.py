"""Opt-in inference adapters. No Torch import/model download in disabled mode."""

import json
import math
import threading

import httpx

from app.config import Settings


class InferenceUnavailable(Exception):
    def __init__(self, reason="inference_unavailable"):
        self.reason = reason
        super().__init__(reason)  # sanitized; do not expose provider bodies


def validate_vectors(vectors, count, dimensions):
    if not isinstance(vectors, list) or len(vectors) != count:
        raise InferenceUnavailable("invalid_vectors")
    normalized = []
    for vector in vectors:
        if not isinstance(vector, list) or len(vector) != dimensions or any(
            type(x) not in (int, float) or not math.isfinite(x) for x in vector
        ):
            raise InferenceUnavailable("invalid_vectors")
        norm = math.sqrt(sum(x * x for x in vector))
        if not norm or not math.isfinite(norm):
            raise InferenceUnavailable("invalid_vectors")
        normalized.append([float(x / norm) for x in vector])
    return normalized


def validate_scores(scores, count):
    if not isinstance(scores, list) or len(scores) != count or any(
        type(x) not in (int, float) or not math.isfinite(x) for x in scores
    ):
        raise InferenceUnavailable("invalid_scores")
    return [float(x) for x in scores]


class Inference:
    def __init__(self, config: Settings):
        self.config = config
        self.identity = config.rag_embedding_model + "@" + (config.rag_embedding_revision or "default")
        self.lock = threading.Lock()
        self.encoder = None
        self.ranker = None
        self.http = httpx.Client(trust_env=False, follow_redirects=False, timeout=config.rag_timeout_seconds,
                                 limits=httpx.Limits(max_connections=2, max_keepalive_connections=2))

    @property
    def enabled(self):
        return self.config.rag_inference_mode != "disabled"

    def close(self):
        self.http.close()

    def _remote(self, path, payload):
        if not self.config.rag_allow_external or not self.config.rag_worker_url or not self.config.rag_worker_key.get_secret_value():
            raise InferenceUnavailable("inference_disabled")
        try:
            with self.http.stream("POST", self.config.rag_worker_url + path, json=payload,
                                  headers={"Authorization": "Bearer " + self.config.rag_worker_key.get_secret_value()}) as response:
                if response.status_code != 200:
                    raise InferenceUnavailable("worker_unavailable")
                content = bytearray()
                for chunk in response.iter_bytes():
                    content.extend(chunk)
                    if len(content) > 1000000:
                        raise InferenceUnavailable("worker_response_limit")
                result = json.loads(content)
                if not isinstance(result, dict):
                    raise InferenceUnavailable("invalid_worker_output")
                return result
        except (httpx.RequestError, ValueError):
            raise InferenceUnavailable("worker_unavailable") from None

    def embed(self, texts):
        mode = self.config.rag_inference_mode
        if mode == "disabled":
            raise InferenceUnavailable("inference_disabled")
        if mode == "remote":
            result = self._remote("/embed", {"model": self.config.rag_embedding_model,
                "revision": self.config.rag_embedding_revision, "texts": texts})
            if result.get("identity") != self.identity:
                raise InferenceUnavailable("model_mismatch")
            vectors = result.get("vectors")
        else:
            with self.lock:
                try:
                    from sentence_transformers import SentenceTransformer
                    if self.encoder is None:
                        self.encoder = SentenceTransformer(self.config.rag_embedding_model, device="cpu",
                            revision=self.config.rag_embedding_revision or None,
                            local_files_only=not self.config.rag_allow_model_download)
                    if any(len(self.encoder.tokenizer.encode(t, truncation=False)) > self.encoder.max_seq_length for t in texts):
                        raise InferenceUnavailable("embedding_token_limit")
                    vectors = self.encoder.encode(texts, batch_size=self.config.rag_batch_size,
                        normalize_embeddings=True, convert_to_numpy=True).tolist()
                except InferenceUnavailable:
                    raise
                except Exception:
                    raise InferenceUnavailable("local_model_unavailable") from None
        return validate_vectors(vectors, len(texts), self.config.rag_embedding_dimensions)

    def rerank(self, query, texts):
        mode = self.config.rag_inference_mode
        if mode == "disabled":
            raise InferenceUnavailable("inference_disabled")
        if mode == "remote":
            result = self._remote("/rerank", {"model": self.config.rag_reranker_model,
                "revision": self.config.rag_reranker_revision, "query": query, "texts": texts})
            identity = self.config.rag_reranker_model + "@" + (self.config.rag_reranker_revision or "default")
            if result.get("identity") != identity:
                raise InferenceUnavailable("model_mismatch")
            scores = result.get("scores")
        else:
            with self.lock:
                try:
                    from sentence_transformers import CrossEncoder
                    if self.ranker is None:
                        self.ranker = CrossEncoder(self.config.rag_reranker_model, device="cpu",
                            revision=self.config.rag_reranker_revision or None,
                            local_files_only=not self.config.rag_allow_model_download)
                    token_limit = self.ranker.max_length or self.ranker.tokenizer.model_max_length
                    if any(len(self.ranker.tokenizer(query, value, truncation=False)["input_ids"]) > token_limit for value in texts):
                        raise InferenceUnavailable("reranker_token_limit")
                    scores = self.ranker.predict([(query, t) for t in texts],
                        batch_size=self.config.rag_batch_size).tolist()
                except InferenceUnavailable:
                    raise
                except Exception:
                    raise InferenceUnavailable("local_model_unavailable") from None
        return validate_scores(scores, len(texts))
