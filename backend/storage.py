"""Filesystem-backed dataset registry for AI SQL Assistant.

Each uploaded CSV becomes a *dataset* stored under ``data/datasets/<id>/``:

    source.csv     the raw upload
    data.db        SQLite database built from the CSV (one table)
    meta.json      inferred schema, profiling, sample rows, example questions
    status.json    training job status (state/progress/loss)
    model/         fine-tuned model weights (written by trainer.py)

A small ``data/active.json`` pointer records which dataset the UI is using.
Everything here is plain JSON + files so the background trainer (a separate
process/thread) and the API can share state without a database server.
"""
from __future__ import annotations

import json
import os
import tempfile
import time
import uuid
from pathlib import Path
from typing import Any, Optional

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = Path(os.getenv("AISQL_DATA_DIR", str(BASE_DIR / "data")))
DATASETS_DIR = DATA_DIR / "datasets"
ACTIVE_PTR = DATA_DIR / "active.json"


def _ensure_dirs() -> None:
    DATASETS_DIR.mkdir(parents=True, exist_ok=True)


def new_dataset_id() -> str:
    """Short, time-sortable, collision-resistant id."""
    return f"{int(time.time()):x}-{uuid.uuid4().hex[:6]}"


def dataset_dir(dataset_id: str) -> Path:
    return DATASETS_DIR / dataset_id


def csv_path(dataset_id: str) -> Path:
    return dataset_dir(dataset_id) / "source.csv"


def db_path(dataset_id: str) -> Path:
    return dataset_dir(dataset_id) / "data.db"


def model_dir(dataset_id: str) -> Path:
    return dataset_dir(dataset_id) / "model"


def meta_path(dataset_id: str) -> Path:
    return dataset_dir(dataset_id) / "meta.json"


def status_path(dataset_id: str) -> Path:
    return dataset_dir(dataset_id) / "status.json"


# --------------------------------------------------------------------------- #
# Atomic JSON read/write (trainer writes status while API reads it)
# --------------------------------------------------------------------------- #
def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=str(path.parent), suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            json.dump(payload, fh, ensure_ascii=False, indent=2, default=str)
        os.replace(tmp, path)
    finally:
        if os.path.exists(tmp):
            os.remove(tmp)


def read_json(path: Path, default: Optional[dict] = None) -> Optional[dict]:
    try:
        with open(path, "r", encoding="utf-8") as fh:
            return json.load(fh)
    except (FileNotFoundError, json.JSONDecodeError):
        return default


# --------------------------------------------------------------------------- #
# Meta / status helpers
# --------------------------------------------------------------------------- #
def save_meta(dataset_id: str, meta: dict[str, Any]) -> None:
    write_json(meta_path(dataset_id), meta)


def load_meta(dataset_id: str) -> Optional[dict]:
    return read_json(meta_path(dataset_id))


def save_status(dataset_id: str, status: dict[str, Any]) -> None:
    write_json(status_path(dataset_id), status)


def load_status(dataset_id: str) -> dict[str, Any]:
    return read_json(status_path(dataset_id), default={"state": "none"}) or {"state": "none"}


# --------------------------------------------------------------------------- #
# Active-dataset pointer + listing
# --------------------------------------------------------------------------- #
def set_active(dataset_id: str) -> None:
    _ensure_dirs()
    write_json(ACTIVE_PTR, {"active_id": dataset_id})


def get_active_id() -> Optional[str]:
    data = read_json(ACTIVE_PTR)
    return data.get("active_id") if data else None


def list_datasets() -> list[dict[str, Any]]:
    """Lightweight summary of every stored dataset, newest first."""
    _ensure_dirs()
    out: list[dict[str, Any]] = []
    for d in DATASETS_DIR.iterdir():
        if not d.is_dir():
            continue
        meta = load_meta(d.name)
        if not meta:
            continue
        status = load_status(d.name)
        out.append(
            {
                "id": d.name,
                "name": meta.get("name", d.name),
                "table": meta.get("table"),
                "row_count": meta.get("row_count"),
                "column_count": len(meta.get("columns", [])),
                "created_at": meta.get("created_at"),
                "train_state": status.get("state", "none"),
                "engine": status.get("engine"),
            }
        )
    out.sort(key=lambda r: r.get("created_at") or "", reverse=True)
    return out
