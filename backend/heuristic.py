"""Deterministic, schema-aware NL->SQL generator.

This is the always-available fallback (and safety net validating the fine-tuned
model's output). It is not a parser for arbitrary English — it recognises the
common analytical shapes: counts, distinct counts, group-by, aggregates
(avg/sum/min/max), value filters, and ranking (top-N / highest / lowest).

It works on *any* schema because it matches the question against the inferred
column labels and the dataset's own sample values.
"""
from __future__ import annotations

import re
from typing import Any, Optional

_STOP = {
    "the", "a", "an", "of", "in", "on", "for", "by", "per", "each", "with",
    "and", "or", "to", "is", "are", "was", "were", "show", "list", "give",
    "me", "all", "how", "many", "much", "what", "which", "who", "whose",
    "count", "number", "total", "average", "avg", "mean", "sum", "max",
    "maximum", "min", "minimum", "highest", "lowest", "most", "least",
    "top", "bottom", "records", "record", "rows", "row", "data", "there",
    "have", "has", "had", "do", "does", "value", "values", "across", "grouped",
    "group", "ordered", "order", "sorted", "sort", "where", "equal", "equals",
}


def _tokens(text: str) -> list[str]:
    return re.findall(r"[a-z0-9]+", text.lower())


def _singular(w: str) -> str:
    if len(w) > 3 and w.endswith("ies"):
        return w[:-3] + "y"
    if len(w) > 3 and w.endswith("s") and not w.endswith("ss"):
        return w[:-1]
    return w


def _label_tokens(col: dict) -> list[str]:
    toks = _tokens(col["label"]) + _tokens(col["name"])
    return [_singular(t) for t in toks if t not in _STOP and len(t) > 1]


def _match_columns(question: str, columns: list[dict]) -> list[tuple[dict, float]]:
    """Score each column by how strongly the question references its label."""
    q_toks = {_singular(t) for t in _tokens(question)}
    scored: list[tuple[dict, float]] = []
    for col in columns:
        ltoks = _label_tokens(col)
        if not ltoks:
            continue
        hits = sum(1 for t in set(ltoks) if t in q_toks)
        if hits:
            scored.append((col, hits / len(set(ltoks))))
    scored.sort(key=lambda x: x[1], reverse=True)
    return scored


def _find_filters(question: str, columns: list[dict]) -> list[tuple[dict, Any]]:
    """Detect literal values from the dataset that appear in the question."""
    ql = question.lower()
    filters: list[tuple[dict, Any]] = []
    for col in columns:
        candidates = []
        for tv in col.get("top_values", []) or []:
            candidates.append(tv["value"])
        for ex in col.get("examples", []) or []:
            candidates.append(ex)
        for val in candidates:
            s = str(val).strip()
            if len(s) < 2:
                continue
            if re.search(rf"(?<![a-z0-9]){re.escape(s.lower())}(?![a-z0-9])", ql):
                filters.append((col, val))
                break
    return filters


def _q(ident: str) -> str:
    return f'"{ident}"'


def _lit(value: Any, kind: str) -> str:
    if kind in ("integer", "real"):
        return str(value)
    return "'" + str(value).replace("'", "''") + "'"


def _agg(question: str) -> Optional[str]:
    q = question.lower()
    if re.search(r"\b(average|avg|mean)\b", q):
        return "AVG"
    if re.search(r"\b(sum|total)\b", q):
        return "SUM"
    if re.search(r"\b(max|maximum|highest|largest|biggest|greatest)\b", q):
        return "MAX"
    if re.search(r"\b(min|minimum|lowest|smallest)\b", q):
        return "MIN"
    return None


def _limit(question: str, default: Optional[int] = None) -> Optional[int]:
    m = re.search(r"\b(?:top|bottom|first|last)\s+(\d{1,3})\b", question.lower())
    if m:
        return int(m.group(1))
    if re.search(r"\b(top|bottom)\b", question.lower()):
        return 5
    return default


def generate(meta: dict[str, Any], question: str) -> str:
    table = _q(meta["table"])
    cols = meta["columns"]
    ql = question.lower()

    by_role: dict[str, list[dict]] = {}
    for c in cols:
        by_role.setdefault(c["role"], []).append(c)

    matched = _match_columns(question, cols)
    matched_cols = [c for c, _ in matched]
    filters = _find_filters(question, cols)
    where = ""
    if filters:
        clauses = []
        for col, val in filters[:3]:
            if col["role"] == "text":
                safe = str(val).replace("'", "''")
                clauses.append(f'{_q(col["name"])} LIKE \'%{safe}%\'')
            else:
                clauses.append(f'{_q(col["name"])} = {_lit(val, col["kind"])}')
        where = " WHERE " + " AND ".join(clauses)

    agg = _agg(question)
    wants_count = bool(re.search(r"\b(how many|count|number of)\b", ql))
    wants_distinct = "distinct" in ql or "unique" in ql

    # group-by dimension: "by X" / "per X" / "for each X", or a mentioned category
    group_col = None
    gm = re.search(r"\b(?:by|per|for each|grouped by|across)\s+(.+)$", ql)
    if gm:
        tail = gm.group(1)
        for c in by_role.get("category", []) + by_role.get("text", []):
            if all(t in _tokens(tail) for t in _label_tokens(c)[:1]):
                group_col = c
                break
    if group_col is None:
        for c in matched_cols:
            if c["role"] in ("category", "text"):
                group_col = c
                break

    measure = next((c for c in matched_cols if c["role"] == "measure"), None)
    if measure is None and agg in ("AVG", "SUM", "MAX", "MIN"):
        measure = next(iter(by_role.get("measure", [])), None)

    # ---- COUNT DISTINCT of a single column ----
    if wants_distinct and wants_count and matched_cols:
        col = matched_cols[0]
        return f'SELECT COUNT(DISTINCT {_q(col["name"])}) AS count FROM {table}{where};'

    # ---- aggregate over a measure, optionally grouped ----
    if agg and measure:
        mq = _q(measure["name"])
        alias = f"{agg.lower()}_{measure['name']}"
        if group_col:
            gq = _q(group_col["name"])
            return (
                f'SELECT {gq}, {agg}({mq}) AS {alias} FROM {table}{where} '
                f'GROUP BY {gq} ORDER BY {alias} DESC LIMIT {_limit(question, 20)};'
            )
        return f"SELECT {agg}({mq}) AS {alias} FROM {table}{where};"

    # ---- grouped counts ("how many X by Y", "count by Y", "which Y has most") ----
    if group_col and (wants_count or "most" in ql or "least" in ql or _limit(question)):
        gq = _q(group_col["name"])
        order = "ASC" if re.search(r"\b(least|fewest|lowest|bottom)\b", ql) else "DESC"
        lim = _limit(question, 1 if ("most" in ql or "least" in ql) and "top" not in ql else 50)
        return (
            f'SELECT {gq}, COUNT(*) AS count FROM {table}{where} '
            f'GROUP BY {gq} ORDER BY count {order} LIMIT {lim};'
        )

    # ---- plain count of rows ----
    if wants_count and not matched_cols:
        return f"SELECT COUNT(*) AS count FROM {table}{where};"

    # ---- ranking rows by a measure ----
    if measure and (_limit(question) or re.search(r"\b(highest|lowest|top|bottom|most|least)\b", ql)):
        mq = _q(measure["name"])
        order = "ASC" if re.search(r"\b(lowest|smallest|least|fewest|bottom)\b", ql) else "DESC"
        return f"SELECT * FROM {table}{where} ORDER BY {mq} {order} LIMIT {_limit(question, 10)};"

    # ---- filtered listing ----
    if where:
        return f"SELECT * FROM {table}{where} LIMIT 100;"

    # ---- generic fallback: a useful overview ----
    if by_role.get("category"):
        gq = _q(by_role["category"][0]["name"])
        return (
            f"SELECT {gq}, COUNT(*) AS count FROM {table} "
            f"GROUP BY {gq} ORDER BY count DESC LIMIT 10;"
        )
    return f"SELECT * FROM {table} LIMIT 20;"
