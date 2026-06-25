"""Schema-driven synthetic NL->SQL generation.

Given the inferred schema of an uploaded CSV we template a corpus of
(question, SQL) pairs that exercise the common analytical intents — counts,
group-by, aggregates, filters, ranking. This serves two purposes:

  1. Training data for the per-dataset fine-tune (trainer.py).
  2. A pool of realistic example questions for the UI, using the dataset's own
     column labels and actual sample values.
"""
from __future__ import annotations

import random
from typing import Any, Optional


def _q(ident: str) -> str:
    return f'"{ident}"'


def _lit(value: Any, kind: str) -> str:
    if value is None:
        return "NULL"
    if kind in ("integer", "real"):
        return str(value)
    return "'" + str(value).replace("'", "''") + "'"


def _by_role(meta: dict[str, Any]) -> dict[str, list[dict]]:
    buckets: dict[str, list[dict]] = {"measure": [], "category": [], "text": [], "datetime": []}
    for col in meta["columns"]:
        buckets.setdefault(col["role"], []).append(col)
    return buckets


def _sample_value(col: dict) -> Optional[Any]:
    if col.get("top_values"):
        return col["top_values"][0]["value"]
    if col.get("examples"):
        return col["examples"][0]
    return None


def generate_pairs(meta: dict[str, Any], limit: int = 600) -> list[tuple[str, str]]:
    """Return a shuffled, de-duplicated list of (question, sql) training pairs."""
    t = meta["table"]
    tq = _q(t)
    roles = _by_role(meta)
    pairs: list[tuple[str, str]] = []

    def add(question: str, sql: str) -> None:
        pairs.append((question, sql.strip()))

    # --- whole-table counts ---
    add("How many rows are in the dataset?", f"SELECT COUNT(*) AS count FROM {tq};")
    add("How many records are there?", f"SELECT COUNT(*) AS count FROM {tq};")
    add("Show me the first 10 rows", f"SELECT * FROM {tq} LIMIT 10;")

    # --- categorical dimensions ---
    for c in roles["category"]:
        cn, lbl, kind = c["name"], c["label"], c["kind"]
        cq = _q(cn)
        add(f"How many distinct {lbl} are there?",
            f"SELECT COUNT(DISTINCT {cq}) AS count FROM {tq};")
        add(f"Show the number of records by {lbl}",
            f"SELECT {cq}, COUNT(*) AS count FROM {tq} GROUP BY {cq} ORDER BY count DESC;")
        add(f"Count records grouped by {lbl}",
            f"SELECT {cq}, COUNT(*) AS count FROM {tq} GROUP BY {cq} ORDER BY count DESC;")
        add(f"Which {lbl} has the most records?",
            f"SELECT {cq}, COUNT(*) AS count FROM {tq} GROUP BY {cq} ORDER BY count DESC LIMIT 1;")
        add(f"Top 5 {lbl} by number of records",
            f"SELECT {cq}, COUNT(*) AS count FROM {tq} GROUP BY {cq} ORDER BY count DESC LIMIT 5;")
        val = _sample_value(c)
        if val is not None:
            add(f"Show all records where {lbl} is {val}",
                f"SELECT * FROM {tq} WHERE {cq} = {_lit(val, kind)} LIMIT 100;")
            add(f"How many records have {lbl} equal to {val}?",
                f"SELECT COUNT(*) AS count FROM {tq} WHERE {cq} = {_lit(val, kind)};")

    # --- numeric measures ---
    for m in roles["measure"]:
        mn, lbl = m["name"], m["label"]
        mqn = _q(mn)
        add(f"What is the average {lbl}?", f"SELECT AVG({mqn}) AS avg_{mn} FROM {tq};")
        add(f"What is the total {lbl}?", f"SELECT SUM({mqn}) AS total_{mn} FROM {tq};")
        add(f"What is the highest {lbl}?", f"SELECT MAX({mqn}) AS max_{mn} FROM {tq};")
        add(f"What is the lowest {lbl}?", f"SELECT MIN({mqn}) AS min_{mn} FROM {tq};")
        add(f"Show the records with the highest {lbl}",
            f"SELECT * FROM {tq} ORDER BY {mqn} DESC LIMIT 5;")
        add(f"Show the records with the lowest {lbl}",
            f"SELECT * FROM {tq} ORDER BY {mqn} ASC LIMIT 5;")

        # measure x dimension crosses
        for c in roles["category"][:4]:
            cn, clbl = c["name"], c["label"]
            cq = _q(cn)
            add(f"What is the average {lbl} by {clbl}?",
                f"SELECT {cq}, AVG({mqn}) AS avg_{mn} FROM {tq} "
                f"GROUP BY {cq} ORDER BY avg_{mn} DESC;")
            add(f"What is the total {lbl} by {clbl}?",
                f"SELECT {cq}, SUM({mqn}) AS total_{mn} FROM {tq} "
                f"GROUP BY {cq} ORDER BY total_{mn} DESC;")
            add(f"Top 5 {clbl} by total {lbl}",
                f"SELECT {cq}, SUM({mqn}) AS total_{mn} FROM {tq} "
                f"GROUP BY {cq} ORDER BY total_{mn} DESC LIMIT 5;")

    # --- free-text columns: equality + LIKE filters ---
    for txt in roles["text"]:
        tn, lbl = txt["name"], txt["label"]
        tq2 = _q(tn)
        val = _sample_value(txt)
        if val is not None:
            add(f"Show all records for {val}",
                f"SELECT * FROM {tq} WHERE {tq2} LIKE '%{str(val).replace(chr(39), chr(39)*2)}%' LIMIT 100;")

    # --- datetime ranges ---
    for d in roles["datetime"]:
        dn, lbl = d["name"], d["label"]
        dq = _q(dn)
        add(f"What is the earliest {lbl}?", f"SELECT MIN({dq}) AS earliest FROM {tq};")
        add(f"What is the latest {lbl}?", f"SELECT MAX({dq}) AS latest FROM {tq};")

    # de-dupe preserving first occurrence
    seen: set[str] = set()
    unique: list[tuple[str, str]] = []
    for q, s in pairs:
        if q not in seen:
            seen.add(q)
            unique.append((q, s))

    rng = random.Random(42)
    rng.shuffle(unique)
    return unique[:limit]


def generate_examples(meta: dict[str, Any], k: int = 8) -> list[str]:
    """A short, diverse, human-readable set of starter questions for the UI."""
    roles = _by_role(meta)
    picks: list[str] = ["How many records are there?"]

    if roles["category"]:
        c = roles["category"][0]
        picks.append(f"Show the number of records by {c['label']}")
        picks.append(f"Which {c['label']} has the most records?")
        val = _sample_value(c)
        if val is not None:
            picks.append(f"How many records have {c['label']} equal to {val}?")
    if roles["measure"]:
        m = roles["measure"][0]
        picks.append(f"What is the average {m['label']}?")
        picks.append(f"Show the records with the highest {m['label']}")
        if roles["category"]:
            picks.append(f"Top 5 {roles['category'][0]['label']} by total {m['label']}")
    if roles["text"]:
        val = _sample_value(roles["text"][0])
        if val is not None:
            picks.append(f"Show all records for {val}")

    # pad with a couple more measure/category combos if short
    if len(picks) < k and len(roles["measure"]) > 1:
        picks.append(f"What is the total {roles['measure'][1]['label']}?")

    seen: set[str] = set()
    out = []
    for p in picks:
        if p not in seen:
            seen.add(p)
            out.append(p)
    return out[:k]
