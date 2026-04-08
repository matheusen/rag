from __future__ import annotations

import hashlib
import importlib
import io
import logging
import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from pypdf import PdfReader

LOGGER = logging.getLogger(__name__)
PROCESS_DISABLED_BACKENDS: set[str] = set()

IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tif", ".tiff"}
VISUAL_EXTENSIONS = IMAGE_EXTENSIONS | {".pdf"}


def _env_bool(name: str, default: bool) -> bool:
    raw = os.environ.get(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _hash_bytes(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


def _collapse_text(text: str, limit: int = 600) -> str:
    compact = " ".join(text.split()).strip()
    return compact[:limit]


def _guess_mime(name: str) -> str:
    suffix = Path(name).suffix.lower()
    if suffix in {".jpg", ".jpeg"}:
        return "image/jpeg"
    if suffix == ".png":
        return "image/png"
    if suffix == ".webp":
        return "image/webp"
    if suffix == ".bmp":
        return "image/bmp"
    if suffix in {".tif", ".tiff"}:
        return "image/tiff"
    return "application/octet-stream"


def _extract_text_payload(payload: Any) -> str:
    fragments: list[str] = []

    def walk(node: Any) -> None:
        if node is None:
            return
        if isinstance(node, str):
            text = node.strip()
            if text:
                fragments.append(text)
            return
        if isinstance(node, dict):
            for key, value in node.items():
                if str(key).lower() in {"image", "image_bytes", "data", "bytes", "base64"}:
                    continue
                walk(value)
            return
        if isinstance(node, (list, tuple, set)):
            for item in node:
                walk(item)

    walk(payload)
    return "\n".join(fragments).strip()


def _extract_pipeline_text(payload: Any) -> str:
    if isinstance(payload, list):
        for item in payload:
            if isinstance(item, dict):
                for key in ("generated_text", "text", "answer", "content"):
                    value = item.get(key)
                    if isinstance(value, str) and value.strip():
                        return value.strip()
    return _extract_text_payload(payload)


@dataclass(slots=True)
class VisualAsset:
    source_key: str
    asset_name: str
    asset_kind: str
    page_number: int | None
    mime_type: str
    image_bytes: bytes
    metadata: dict[str, Any] = field(default_factory=dict)

    @property
    def content_hash(self) -> str:
        return _hash_bytes(self.image_bytes)


@dataclass(slots=True)
class OCRAsset:
    source_key: str
    asset_name: str
    asset_kind: str
    page_number: int | None
    mime_type: str
    image_bytes: bytes
    content_hash: str
    ocr_engine: str
    text: str
    metadata: dict[str, Any] = field(default_factory=dict)

    @property
    def summary(self) -> str:
        return _collapse_text(self.text)


class ChandraOCRBackend:
    name = "chandra2"
    _client: Any = None

    def enabled(self) -> bool:
        return _env_bool("RAG_OCR_CHANDRA_ENABLED", True)

    def _client_instance(self) -> Any:
        if self._client is not None:
            return self._client

        module = importlib.import_module("chandra_ocr")
        client_cls = getattr(module, "ChandraOCR")
        model_name = os.environ.get("RAG_OCR_CHANDRA_MODEL", "").strip()
        if model_name:
            try:
                self._client = client_cls(model_name=model_name)
                return self._client
            except TypeError:
                LOGGER.debug("ChandraOCR nao aceita model_name no construtor; usando default.")
        self._client = client_cls()
        return self._client

    def parse(self, asset: VisualAsset) -> OCRAsset | None:
        client = self._client_instance()
        output_format = os.environ.get("RAG_OCR_CHANDRA_OUTPUT", "json")
        payload = client.parse(asset.image_bytes, output_format=output_format)
        text = _extract_text_payload(payload)
        if not text:
            return None
        return OCRAsset(
            source_key=asset.source_key,
            asset_name=asset.asset_name,
            asset_kind=asset.asset_kind,
            page_number=asset.page_number,
            mime_type=asset.mime_type,
            image_bytes=asset.image_bytes,
            content_hash=asset.content_hash,
            ocr_engine=self.name,
            text=text,
            metadata={**asset.metadata, "backend": self.name, "output_format": output_format},
        )


class HuggingFaceGLMOCRBackend:
    name = "glm"
    _pipeline: Any = None

    def enabled(self) -> bool:
        return _env_bool("RAG_OCR_GLM_ENABLED", True) and bool(os.environ.get("RAG_OCR_GLM_MODEL_ID", "").strip())

    def _pipeline_instance(self) -> Any:
        if self._pipeline is not None:
            return self._pipeline

        from transformers import pipeline

        kwargs: dict[str, Any] = {
            "task": os.environ.get("RAG_OCR_GLM_TASK", "image-text-to-text"),
            "model": os.environ["RAG_OCR_GLM_MODEL_ID"],
            "trust_remote_code": True,
            "local_files_only": _env_bool("RAG_OCR_LOCAL_FILES_ONLY", True),
        }
        device_map = os.environ.get("RAG_OCR_GLM_DEVICE_MAP", "auto").strip()
        if device_map:
            kwargs["device_map"] = device_map

        self._pipeline = pipeline(**kwargs)
        return self._pipeline

    def parse(self, asset: VisualAsset) -> OCRAsset | None:
        from PIL import Image

        generator = self._pipeline_instance()
        prompt = os.environ.get(
            "RAG_OCR_GLM_PROMPT",
            "Extract all visible text from this image. Return only grounded text and layout cues.",
        )
        max_new_tokens = int(os.environ.get("RAG_OCR_GLM_MAX_NEW_TOKENS", "1024"))
        image = Image.open(io.BytesIO(asset.image_bytes)).convert("RGB")

        try:
            payload = generator(image, prompt=prompt, max_new_tokens=max_new_tokens)
        except TypeError:
            payload = generator(image, max_new_tokens=max_new_tokens)

        text = _extract_pipeline_text(payload)
        if not text:
            return None
        return OCRAsset(
            source_key=asset.source_key,
            asset_name=asset.asset_name,
            asset_kind=asset.asset_kind,
            page_number=asset.page_number,
            mime_type=asset.mime_type,
            image_bytes=asset.image_bytes,
            content_hash=asset.content_hash,
            ocr_engine=self.name,
            text=text,
            metadata={**asset.metadata, "backend": self.name, "max_new_tokens": max_new_tokens},
        )


def _build_backends() -> list[Any]:
    names = [name.strip().lower() for name in os.environ.get("RAG_OCR_BACKENDS", "chandra2,glm").split(",") if name.strip()]
    registry = {
        "chandra2": ChandraOCRBackend,
        "glm": HuggingFaceGLMOCRBackend,
    }
    backends: list[Any] = []
    for name in names:
        backend_cls = registry.get(name)
        if backend_cls is not None:
            backends.append(backend_cls())
    return backends


def extract_visual_assets(file_path: str, source_key: str) -> list[VisualAsset]:
    path = Path(file_path)
    suffix = path.suffix.lower()

    if suffix in IMAGE_EXTENSIONS:
        return [
            VisualAsset(
                source_key=source_key,
                asset_name=path.name,
                asset_kind="standalone_image",
                page_number=1,
                mime_type=_guess_mime(path.name),
                image_bytes=path.read_bytes(),
                metadata={"source_suffix": suffix, "page_number": 1},
            )
        ]

    if suffix != ".pdf":
        return []

    reader = PdfReader(str(path))
    assets: list[VisualAsset] = []
    seen_hashes: set[str] = set()
    max_images_per_page = int(os.environ.get("RAG_OCR_MAX_IMAGES_PER_PAGE", "12"))

    for page_number, page in enumerate(reader.pages, start=1):
        page_images = list(getattr(page, "images", []) or [])
        for asset_index, image in enumerate(page_images[:max_images_per_page], start=1):
            image_bytes = getattr(image, "data", None)
            if not image_bytes:
                continue

            content_hash = _hash_bytes(image_bytes)
            if content_hash in seen_hashes:
                continue
            seen_hashes.add(content_hash)

            image_name = getattr(image, "name", f"{path.stem}-page-{page_number}-image-{asset_index}.bin")
            assets.append(
                VisualAsset(
                    source_key=source_key,
                    asset_name=image_name,
                    asset_kind="pdf_embedded_image",
                    page_number=page_number,
                    mime_type=_guess_mime(image_name),
                    image_bytes=image_bytes,
                    metadata={
                        "source_suffix": suffix,
                        "page_number": page_number,
                        "asset_index": asset_index,
                    },
                )
            )

    return assets


def extract_ocr_assets(file_path: str, source_key: str) -> list[OCRAsset]:
    if not _env_bool("RAG_OCR_ENABLED", True):
        return []

    visual_assets = extract_visual_assets(file_path, source_key)
    if not visual_assets:
        return []

    backends = [
        backend
        for backend in _build_backends()
        if backend.enabled() and getattr(backend, "name", "unknown") not in PROCESS_DISABLED_BACKENDS
    ]
    if not backends:
        LOGGER.info("OCR habilitado, mas nenhum backend local foi configurado.")
        return []

    max_assets = int(os.environ.get("RAG_OCR_MAX_ASSETS_PER_DOCUMENT", "32"))
    extracted: list[OCRAsset] = []
    disabled_backends: set[str] = set()

    for asset in visual_assets[:max_assets]:
        active_backends = [backend for backend in backends if getattr(backend, "name", "unknown") not in disabled_backends]
        if not active_backends:
            break

        for backend in active_backends:
            try:
                parsed = backend.parse(asset)
            except Exception as exc:
                backend_name = getattr(backend, "name", "unknown")
                disabled_backends.add(backend_name)
                PROCESS_DISABLED_BACKENDS.add(backend_name)
                LOGGER.warning(
                    "Falha no backend OCR; backend sera desabilitado para o restante deste processo.",
                    extra={"backend": backend_name, "asset": asset.asset_name, "error": str(exc)},
                )
                continue

            if parsed is None or not parsed.text.strip():
                continue

            extracted.append(parsed)
            break

    return extracted