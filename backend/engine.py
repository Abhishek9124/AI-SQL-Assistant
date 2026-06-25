"""SQL generation + safe execution.

This app runs **entirely locally** — no external API calls. Generation is a
two-stage cascade, in order of preference:

    1. the per-dataset fine-tuned model (if trained)        -> "fine-tuned"
    2. the deterministic schema-aware generator (always)    -> "deterministic"

Every candidate is validated (single read-only SELECT that SQLite can parse
against the real table); anything that fails validation falls through to the
next engine, so a bad model guess never reaches the user.
"""
from __future__ import annotations

import re
import sqlite3
from contextlib import closing
from typing import Any, Optional

from . import heuristic, storage, trainer

_FORBIDDEN = re.compile(
    r"\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|REPLACE|ATTACH|DETACH|PRAGMA|VACUUM)\b",
    re.IGNORECASE,
)


# --------------------------------------------------------------------------- #
# Cleaning / validation
# --------------------------------------------------------------------------- #
def _clean_sql(raw: str) -> str:
    if not raw:
        return ""
    raw = raw.strip()
    # strip markdown fences ```sql ... ```
    fence = re.search(r"```(?:sql)?\s*(.+?)```", raw, re.DOTALL | re.IGNORECASE)
    if fence:
        raw = fence.group(1).strip()
    # keep only the first statement
    raw = raw.split(";")[0].strip()
    return raw + ";" if raw else ""


def validate_sql(dataset_id: str, sql: str) -> tuple[bool, str]:
    sql = (sql or "").strip()
    if not sql:
        return False, "empty"
    body = sql.rstrip(";").strip()
    if ";" in body:
        return False, "multiple statements"
    if not re.match(r"^\s*(SELECT|WITH)\b", body, re.IGNORECASE):
        return False, "not a SELECT"
    if _FORBIDDEN.search(body):
        return False, "write operation"
    db = storage.db_path(dataset_id)
    if not db.exists():
        return False, "database missing"
    try:
        with closing(sqlite3.connect(str(db))) as conn:
            conn.execute("EXPLAIN " + body)  # parses + binds columns without running
        return True, "ok"
    except sqlite3.Error as exc:
        return False, str(exc)


# --------------------------------------------------------------------------- #
# Orchestration
# --------------------------------------------------------------------------- #
def generate(meta: dict[str, Any], question: str) -> tuple[str, str]:
    """Return (sql, engine_label). Always returns a validated SELECT."""
    from .ingest import schema_signature

    dataset_id = meta["id"]
    sig = schema_signature(meta)

    # 1) fine-tuned model (local)
    candidate = trainer.generate_sql(dataset_id, sig, question)
    if candidate:
        sql = _clean_sql(candidate)
        ok, _ = validate_sql(dataset_id, sql)
        if ok:
            return sql, "fine-tuned"

    # 2) deterministic fallback (also our safety net)
    sql = _clean_sql(heuristic.generate(meta, question))
    ok, _ = validate_sql(dataset_id, sql)
    if not ok:
        sql = f'SELECT * FROM "{meta["table"]}" LIMIT 20;'
    return sql, "deterministic"


# --------------------------------------------------------------------------- #
# Execution
# --------------------------------------------------------------------------- #
MAX_RESULT_ROWS = 1000


def run_sql(dataset_id: str, sql: str) -> tuple[list[str], list[list[Any]]]:
    ok, reason = validate_sql(dataset_id, sql)
    if not ok:
        raise ValueError(f"Refused to run query: {reason}")
    db = storage.db_path(dataset_id)
    with closing(sqlite3.connect(str(db))) as conn:
        cur = conn.execute(sql.rstrip(";") + f" LIMIT {MAX_RESULT_ROWS}"
                           if not re.search(r"\bLIMIT\b", sql, re.IGNORECASE) else sql)
        columns = [d[0] for d in cur.description] if cur.description else []
        rows = [list(r) for r in cur.fetchall()]
    return columns, rows
