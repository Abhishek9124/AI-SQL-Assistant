"""CSV ingestion: load an arbitrary CSV into SQLite and infer a rich schema.

The schema produced here drives everything downstream — the deterministic SQL
generator, the synthetic training-data generator, the dashboard stats, and the
example questions. The goal is to understand each column well enough to know
whether it behaves like a *measure* (numeric, aggregatable), a *category*
(low-cardinality label to group/filter by), free *text*, or a *datetime*.
"""
from __future__ import annotations

import re
import sqlite3
from contextlib import closing
from datetime import datetime, date
from pathlib import Path
from typing import Any

import pandas as pd

from . import storage

# How many distinct values still counts as a "category" (groupable dimension).
MAX_CATEGORY_DISTINCT = 60
# Cap rows we load so a huge upload can't hang the demo.
MAX_ROWS = 500_000
RESERVED = {"index"}


def sanitize_identifier(name: str, fallback: str) -> str:
    ident = re.sub(r"\W+", "_", str(name).strip()).strip("_")
    if not ident or ident.lower() in RESERVED:
        ident = fallback
    if ident[0].isdigit():
        ident = f"c_{ident}"
    return ident


def _dedupe(names: list[str]) -> list[str]:
    seen: dict[str, int] = {}
    out = []
    for n in names:
        if n in seen:
            seen[n] += 1
            out.append(f"{n}_{seen[n]}")
        else:
            seen[n] = 0
            out.append(n)
    return out


def _table_name_from(name: str) -> str:
    return sanitize_identifier(name, "dataset").lower()[:40] or "dataset"


def _refine_object_column(series: pd.Series) -> tuple[pd.Series, str]:
    """Try to upgrade an object column to numeric or datetime when it clearly is."""
    non_null = series.dropna()
    if non_null.empty:
        return series, "text"

    numeric = pd.to_numeric(non_null, errors="coerce")
    if numeric.notna().mean() >= 0.95:
        full = pd.to_numeric(series, errors="coerce")
        kind = "integer" if (full.dropna() % 1 == 0).all() else "real"
        return full, kind

    # Only attempt datetime when values look date-ish (avoids turning ids into dates).
    sample = non_null.astype(str).head(50)
    if sample.str.contains(r"\d{4}|\d{1,2}[/-]\d{1,2}").mean() >= 0.6:
        parsed = pd.to_datetime(series, errors="coerce")
        if parsed.notna().mean() >= 0.9 * (series.notna().mean() or 1):
            return parsed, "datetime"

    return series, "text"


def _column_kind(series: pd.Series) -> tuple[pd.Series, str]:
    if pd.api.types.is_bool_dtype(series):
        return series.astype("Int64"), "integer"
    if pd.api.types.is_integer_dtype(series):
        return series, "integer"
    if pd.api.types.is_float_dtype(series):
        if series.dropna().mod(1).eq(0).all():
            return series, "integer"
        return series, "real"
    if pd.api.types.is_datetime64_any_dtype(series):
        return series, "datetime"
    return _refine_object_column(series)


def _sql_type(kind: str) -> str:
    return {"integer": "INTEGER", "real": "REAL", "datetime": "TEXT"}.get(kind, "TEXT")


_IDISH = re.compile(r"(?:^|[_\s])(id|uuid|guid|key|code|no|num|number)$", re.IGNORECASE)


def _decide_role(kind: str, distinct: int, n: int, name: str) -> str:
    """Classify a column as measure / category / text / datetime / id.

    Numeric columns default to *measure* (aggregatable); only small, repeating
    integer sets (e.g. Year, rating 1-5) become dimensions. Near-unique columns
    whose name looks like an identifier become *id* (filterable, never summed).
    """
    if kind == "datetime":
        return "datetime"
    nearly_unique = n > 0 and distinct >= max(0.9 * n, n - 1)
    is_idish = bool(_IDISH.search(str(name))) or str(name).lower() == "id"
    if is_idish and nearly_unique:
        return "id"
    if kind in ("integer", "real"):
        if kind == "real":
            return "measure" if distinct > 6 else "category"
        if distinct <= 12 and (n == 0 or distinct < 0.5 * n):
            return "category"
        return "measure"
    ratio = (distinct / n) if n else 1.0
    if distinct <= MAX_CATEGORY_DISTINCT and ratio < 0.6:
        return "category"
    return "text"


def _profile_column(series: pd.Series, kind: str, name: str) -> dict[str, Any]:
    non_null = series.dropna()
    distinct = int(non_null.nunique())
    n = int(len(series))
    info: dict[str, Any] = {
        "distinct": distinct,
        "null_count": int(series.isna().sum()),
    }

    if kind in ("integer", "real"):
        nums = pd.to_numeric(non_null, errors="coerce").dropna()
        if not nums.empty:
            info["min"] = float(nums.min())
            info["max"] = float(nums.max())
            info["avg"] = round(float(nums.mean()), 3)
    elif kind == "datetime" and not non_null.empty:
        info["min"] = str(non_null.min())
        info["max"] = str(non_null.max())

    role = _decide_role(kind, distinct, n, name)

    # Categories/text expose their most common values (filters, UI, examples);
    # measures/ids/datetimes just expose a few raw examples.
    if role in ("category", "text"):
        vc = non_null.value_counts().head(8)
        info["top_values"] = [
            {"value": _json_safe(v), "count": int(c)} for v, c in vc.items()
        ]
    else:
        info["examples"] = [_json_safe(v) for v in non_null.head(5).tolist()]

    info["role"] = role
    return info


def _json_safe(v: Any) -> Any:
    if isinstance(v, (datetime, date, pd.Timestamp)):
        return str(v)
    if isinstance(v, float) and v.is_integer():
        return int(v)
    try:
        import numpy as np

        if isinstance(v, np.generic):
            return v.item()
    except Exception:  # noqa: BLE001
        pass
    return v


def ingest_csv(dataset_id: str, source_csv: Path, display_name: str) -> dict[str, Any]:
    """Load ``source_csv`` -> SQLite, infer schema, persist meta.json. Returns meta."""
    df = pd.read_csv(source_csv, nrows=MAX_ROWS)
    df = df.dropna(axis=1, how="all")
    if df.empty or df.shape[1] == 0:
        raise ValueError("The CSV has no usable columns or rows.")

    table = _table_name_from(display_name)
    originals = list(df.columns)
    idents = _dedupe(
        [sanitize_identifier(c, f"col_{i+1}") for i, c in enumerate(originals)]
    )

    columns: list[dict[str, Any]] = []
    clean = pd.DataFrame()
    for orig, ident in zip(originals, idents):
        series, kind = _column_kind(df[orig])
        if kind == "datetime":
            series = series.dt.strftime("%Y-%m-%d %H:%M:%S").where(series.notna(), None)
        clean[ident] = series
        prof = _profile_column(
            df[orig] if kind != "datetime" else series, kind, str(orig)
        )
        columns.append(
            {
                "name": ident,
                "label": str(orig),
                "type": _sql_type(kind),
                "kind": kind,
                "role": prof.pop("role"),
                **prof,
            }
        )

    # Write the SQLite table.
    db = storage.db_path(dataset_id)
    db.parent.mkdir(parents=True, exist_ok=True)
    if db.exists():
        db.unlink()
    with closing(sqlite3.connect(str(db))) as conn:
        clean.to_sql(table, conn, if_exists="replace", index=False)
        row_count = conn.execute(f'SELECT COUNT(*) FROM "{table}"').fetchone()[0]

    sample_rows = [
        [_json_safe(v) for v in row]
        for row in clean.head(8).itertuples(index=False, name=None)
    ]

    meta = {
        "id": dataset_id,
        "name": display_name,
        "table": table,
        "row_count": int(row_count),
        "columns": columns,
        "column_names": idents,
        "sample_rows": sample_rows,
        "created_at": datetime.utcnow().isoformat() + "Z",
    }
    storage.save_meta(dataset_id, meta)
    return meta


def schema_signature(meta: dict[str, Any]) -> str:
    """Compact ``table(col TYPE, ...)`` string used as model/prompt context."""
    cols = ", ".join(f'{c["name"]} {c["type"]}' for c in meta["columns"])
    return f'{meta["table"]}({cols})'
