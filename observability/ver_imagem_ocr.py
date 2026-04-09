"""
ver_imagem_ocr.py — Extrai e abre imagens OCR diretamente do banco.

Uso:
    # Abrir a primeira imagem de um documento
    python observability/ver_imagem_ocr.py --source "Beyond Nearest"

    # Abrir por asset_id
    python observability/ver_imagem_ocr.py --id 55b8a40a-c592-4cc9-bfa7-c8da6c3efa36

    # Listar imagens de um documento sem abrir
    python observability/ver_imagem_ocr.py --source "Beyond Nearest" --list

    # Salvar todas as imagens de um documento em um diretório
    python observability/ver_imagem_ocr.py --source "Beyond Nearest" --save ./imagens_extraidas
"""

from __future__ import annotations

import argparse
import io
import os
import sys
from pathlib import Path

import psycopg
from dotenv import load_dotenv
from PIL import Image

load_dotenv()


def _dsn() -> str:
    return (
        f"host={os.environ.get('POSTGRES_HOST', '127.0.0.1')} "
        f"port={os.environ.get('POSTGRES_PORT', '5433')} "
        f"dbname={os.environ.get('POSTGRES_DB', 'ragsys')} "
        f"user={os.environ.get('POSTGRES_USER', 'postgres')} "
        f"password={os.environ.get('POSTGRES_PASSWORD', 'postgres')}"
    )


def list_assets(source: str) -> None:
    with psycopg.connect(_dsn()) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT asset_id, asset_name, page_number, asset_index,
                       ocr_engine, LENGTH(image_bytes) AS bytes,
                       LEFT(ocr_text, 120) AS ocr_preview
                FROM rag_document_image_asset
                WHERE source_key ILIKE %s
                ORDER BY page_number, asset_index
                """,
                (f"%{source}%",),
            )
            rows = cur.fetchall()

    if not rows:
        print(f"Nenhuma imagem encontrada para: {source!r}")
        return

    print(f"\n{'asset_id':<38} {'asset_name':<20} {'pag':>4} {'idx':>4} {'engine':<10} {'bytes':>8}  ocr_preview")
    print("-" * 120)
    for asset_id, name, page, idx, engine, size, preview in rows:
        preview_clean = (preview or "").replace("\n", " ")
        print(f"{str(asset_id):<38} {name:<20} {str(page or '?'):>4} {str(idx):>4} {engine or '?':<10} {size or 0:>8}  {preview_clean}")
    print(f"\nTotal: {len(rows)} imagem(ns)")


def open_asset(asset_id: str) -> None:
    with psycopg.connect(_dsn()) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT asset_name, mime_type, image_bytes, ocr_engine,
                       page_number, source_key, ocr_text
                FROM rag_document_image_asset
                WHERE asset_id = %s
                """,
                (asset_id,),
            )
            row = cur.fetchone()

    if not row:
        print(f"asset_id não encontrado: {asset_id}")
        sys.exit(1)

    name, mime, data, engine, page, source, ocr_text = row
    print(f"\nArquivo : {source}")
    print(f"Imagem  : {name}  (página {page})")
    print(f"Engine  : {engine}  |  Mime: {mime}  |  Tamanho: {len(data):,} bytes")
    print(f"\n--- Texto OCR ---\n{ocr_text or '(vazio)'}\n")

    img = Image.open(io.BytesIO(bytes(data)))
    img.show(title=f"{name} — {engine}")


def save_assets(source: str, dest: str) -> None:
    out = Path(dest)
    out.mkdir(parents=True, exist_ok=True)

    with psycopg.connect(_dsn()) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT asset_id, asset_name, page_number, asset_index,
                       mime_type, image_bytes, ocr_engine, ocr_text
                FROM rag_document_image_asset
                WHERE source_key ILIKE %s
                ORDER BY page_number, asset_index
                """,
                (f"%{source}%",),
            )
            rows = cur.fetchall()

    if not rows:
        print(f"Nenhuma imagem encontrada para: {source!r}")
        return

    for asset_id, name, page, idx, mime, data, engine, ocr_text in rows:
        suffix = Path(name).suffix or (".png" if "png" in (mime or "") else ".jpg")
        filename = f"p{page:03d}_i{idx:02d}_{engine}_{name}"
        filepath = out / filename
        filepath.write_bytes(bytes(data))

        txt_path = filepath.with_suffix(".txt")
        txt_path.write_text(ocr_text or "", encoding="utf-8")

        print(f"  Salvo: {filepath}  ({len(data):,} bytes)  OCR: {len(ocr_text or '')} chars")

    print(f"\nTotal: {len(rows)} imagem(ns) salvas em {out.resolve()}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Extrai imagens OCR do banco PostgreSQL")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--source", metavar="NOME", help="Parte do nome do documento (case-insensitive)")
    group.add_argument("--id", metavar="UUID", help="asset_id exato")
    parser.add_argument("--list", action="store_true", help="Apenas listar, não abrir")
    parser.add_argument("--save", metavar="DIR", help="Salvar imagens num diretório")
    args = parser.parse_args()

    if args.id:
        open_asset(args.id)
    elif args.save:
        save_assets(args.source, args.save)
    elif args.list:
        list_assets(args.source)
    else:
        # sem --list e sem --save: listar e abrir a primeira
        list_assets(args.source)
        with psycopg.connect(_dsn()) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT asset_id FROM rag_document_image_asset WHERE source_key ILIKE %s ORDER BY page_number, asset_index LIMIT 1",
                    (f"%{args.source}%",),
                )
                row = cur.fetchone()
        if row:
            print("\nAbrindo primeira imagem...")
            open_asset(str(row[0]))


if __name__ == "__main__":
    main()
