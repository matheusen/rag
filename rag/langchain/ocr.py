from __future__ import annotations

import base64
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
    """Backend Chandra2 — usa RapidOCR + ONNX Runtime internamente."""

    name = "chandra2"
    _engine: Any = None

    def enabled(self) -> bool:
        return _env_bool("RAG_OCR_CHANDRA_ENABLED", True)

    def _engine_instance(self) -> Any:
        if self._engine is not None:
            return self._engine
        from rapidocr_onnxruntime import RapidOCR
        self._engine = RapidOCR()
        return self._engine

    def parse(self, asset: VisualAsset) -> OCRAsset | None:
        engine = self._engine_instance()
        result, _ = engine(asset.image_bytes)
        if not result:
            return None
        lines = [item[1] for item in result if item and len(item) > 1 and item[1]]
        text = "\n".join(lines).strip()
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
            metadata={**asset.metadata, "backend": self.name},
        )


class HuggingFaceGLMOCRBackend:
    """Backend TrOCR/VisionEncoderDecoder via HuggingFace Transformers.

    Usa AutoProcessor + VisionEncoderDecoderModel diretamente (compatível com
    transformers >=5.x onde o pipeline 'image-to-text' foi removido).
    Modelo padrão: microsoft/trocr-base-printed
    """

    name = "glm"
    _processor: Any = None
    _model: Any = None

    def enabled(self) -> bool:
        return _env_bool("RAG_OCR_GLM_ENABLED", True) and bool(os.environ.get("RAG_OCR_GLM_MODEL_ID", "").strip())

    def _load(self) -> tuple[Any, Any]:
        if self._model is not None:
            return self._processor, self._model

        from transformers import TrOCRProcessor, VisionEncoderDecoderModel

        model_id = os.environ["RAG_OCR_GLM_MODEL_ID"]
        local_files_only = _env_bool("RAG_OCR_LOCAL_FILES_ONLY", False)

        self._processor = TrOCRProcessor.from_pretrained(model_id, local_files_only=local_files_only)
        self._model = VisionEncoderDecoderModel.from_pretrained(model_id, local_files_only=local_files_only)
        return self._processor, self._model

    def parse(self, asset: VisualAsset) -> OCRAsset | None:
        from PIL import Image

        processor, model = self._load()
        image = Image.open(io.BytesIO(asset.image_bytes)).convert("RGB")
        pixel_values = processor(images=image, return_tensors="pt").pixel_values
        generated_ids = model.generate(pixel_values)
        text = processor.batch_decode(generated_ids, skip_special_tokens=True)[0].strip()

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
            metadata={**asset.metadata, "backend": self.name},
        )


class RapidOCRBackend:
    """OCR puro Python usando RapidOCR + ONNX Runtime. Sem dependências de sistema."""

    name = "rapid"
    _engine: Any = None

    def enabled(self) -> bool:
        return _env_bool("RAG_OCR_RAPID_ENABLED", True)

    def _engine_instance(self) -> Any:
        if self._engine is not None:
            return self._engine
        from rapidocr_onnxruntime import RapidOCR
        self._engine = RapidOCR()
        return self._engine

    def parse(self, asset: VisualAsset) -> OCRAsset | None:
        engine = self._engine_instance()
        result, _ = engine(asset.image_bytes)
        if not result:
            return None

        lines = [item[1] for item in result if item and len(item) > 1 and item[1]]
        text = "\n".join(lines).strip()
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
            metadata={**asset.metadata, "backend": self.name},
        )


class OllamaVisionOCRBackend:
    """Uses an Ollama vision model (e.g. moondream) for image OCR."""

    name = "ollama_vision"

    def enabled(self) -> bool:
        return _env_bool("RAG_OCR_OLLAMA_ENABLED", True) and bool(
            os.environ.get("RAG_OCR_OLLAMA_MODEL", "").strip()
        )

    def parse(self, asset: VisualAsset) -> OCRAsset | None:
        import ollama as _ollama

        model = os.environ["RAG_OCR_OLLAMA_MODEL"].strip()
        base_url = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434").rstrip("/")
        prompt = os.environ.get(
            "RAG_OCR_OLLAMA_PROMPT",
            "Extract every piece of text visible in this image. "
            "Return only the extracted text, preserving line breaks. "
            "If there is no text, respond with an empty string.",
        )

        b64 = base64.b64encode(asset.image_bytes).decode()
        client = _ollama.Client(host=base_url)
        response = client.chat(
            model=model,
            messages=[{"role": "user", "content": prompt, "images": [b64]}],
        )
        text = (response.message.content or "").strip()
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
            metadata={**asset.metadata, "backend": self.name, "model": model},
        )


def _build_backends() -> list[Any]:
    names = [
        name.strip().lower()
        for name in os.environ.get("RAG_OCR_BACKENDS", "rapid,ollama_vision,chandra2,glm").split(",")
        if name.strip()
    ]
    registry = {
        "chandra2": ChandraOCRBackend,
        "glm": HuggingFaceGLMOCRBackend,
        "ollama_vision": OllamaVisionOCRBackend,
        "rapid": RapidOCRBackend,
    }
    backends: list[Any] = []
    for name in names:
        backend_cls = registry.get(name)
        if backend_cls is not None:
            backends.append(backend_cls())
    return backends


_BACKENDS_CACHE: list[Any] | None = None


def _get_backends() -> list[Any]:
    global _BACKENDS_CACHE
    if _BACKENDS_CACHE is None:
        _BACKENDS_CACHE = _build_backends()
    return _BACKENDS_CACHE


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
        for backend in _get_backends()
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