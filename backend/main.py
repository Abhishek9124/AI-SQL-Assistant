import os
import re
import sqlite3
import time
from contextlib import closing
from pathlib import Path
from typing import Any, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# --------------------------------------------------------------------------- #
# Config
# --------------------------------------------------------------------------- #
BASE_DIR = Path(__file__).resolve().parent.parent
DB_PATH = os.getenv("OLYMPICS_DB", str(BASE_DIR / "olympics.db"))
HF_MODEL_REPO = os.getenv("HF_MODEL_REPO", "Abhishek9124/llama3-olympics-120years")

SCHEMA = """CREATE TABLE athlete_events (
    ID INTEGER, Name VARCHAR, Sex VARCHAR,
    Age FLOAT, Height FLOAT, Weight FLOAT,
    Team VARCHAR, NOC VARCHAR, Games VARCHAR,
    Year INTEGER, Season VARCHAR, City VARCHAR,
    Sport VARCHAR, Event VARCHAR, Medal VARCHAR
)"""

EXAMPLES = [
    "Which country won the most gold medals overall?",
    "Show all medals won by India",
    "Who is the oldest gold medalist ever?",
    "How many female athletes competed in 2016?",
    "Which sport has the most Olympic events?",
    "What is the average height of Basketball players?",
    "Which city hosted the Olympics most often?",
    "Top 5 athletes by gold medal count",
    "How many countries competed in the 1896 Olympics?",
    "Show all Winter Olympics host cities",
    "What percentage of athletes are female?",
    "Which athlete competed in the most Olympics?",
    "Show all gold medals won by Jamaica",
    "How many medals has Kenya won in Athletics?",
]

# --------------------------------------------------------------------------- #
# Model loading (lazy + graceful fallback)
# --------------------------------------------------------------------------- #
_MODEL = None
_TOKENIZER = None
_MODEL_STATE = "not_loaded"  # not_loaded | loaded | demo


def _try_load_model() -> None:
    """Attempt to load the fine-tuned model once; fall back to demo mode."""
    global _MODEL, _TOKENIZER, _MODEL_STATE
    if _MODEL_STATE in ("loaded", "demo"):
        return
    try:
        from transformers import AutoModelForCausalLM, AutoTokenizer  # heavy import

        _MODEL = AutoModelForCausalLM.from_pretrained(
            HF_MODEL_REPO, load_in_4bit=True, device_map="auto"
        )
        _TOKENIZER = AutoTokenizer.from_pretrained(HF_MODEL_REPO)
        _MODEL_STATE = "loaded"
    except Exception as exc:  # noqa: BLE001 - we intentionally degrade gracefully
        print(f"[warn] Model load failed, using DEMO_MODE: {exc}")
        _MODEL_STATE = "demo"


def _generate_sql_with_model(question: str) -> str:
    prompt = f"""### Task
Convert the natural language question into a SQL query for the Olympics database.

### Database Schema
{SCHEMA}

### Question
{question}

### SQL Query
"""
    inputs = _TOKENIZER(prompt, return_tensors="pt").to(_MODEL.device)
    outputs = _MODEL.generate(
        **inputs,
        max_new_tokens=200,
        temperature=0.1,
        do_sample=True,
        pad_token_id=_TOKENIZER.eos_token_id,
    )
    raw = _TOKENIZER.decode(outputs[0], skip_special_tokens=True)
    sql = raw.split("### SQL Query")[-1].split("###")[0].strip()
    return sql.split(";")[0].strip() + ";"


# Minimal rule-based generator used when the LLM is unavailable. Keeps the UI
# fully interactive for demos without a GPU.
_DEMO_RULES: list[tuple[str, str]] = [
    (r"most gold medals overall|most gold",
     "SELECT Team, COUNT(*) AS gold_count FROM athlete_events WHERE Medal='Gold' "
     "GROUP BY Team ORDER BY gold_count DESC LIMIT 5;"),
    (r"medals won by india|india",
     "SELECT Name, Sport, Event, Medal, Year FROM athlete_events "
     "WHERE Team='India' AND Medal IS NOT NULL ORDER BY Year DESC;"),
    (r"oldest gold",
     "SELECT Name, Team, Sport, Age, Year FROM athlete_events "
     "WHERE Medal='Gold' AND Age IS NOT NULL ORDER BY Age DESC LIMIT 5;"),
    (r"female athletes.*2016|2016.*female",
     "SELECT COUNT(DISTINCT ID) AS female_athletes FROM athlete_events "
     "WHERE Sex='F' AND Year=2016 AND Season='Summer';"),
    (r"most.*events|sport has the most",
     "SELECT Sport, COUNT(DISTINCT Event) AS num_events FROM athlete_events "
     "GROUP BY Sport ORDER BY num_events DESC LIMIT 10;"),
    (r"average height of basketball",
     "SELECT ROUND(AVG(Height),1) AS avg_height_cm FROM athlete_events "
     "WHERE Sport='Basketball' AND Height IS NOT NULL;"),
    (r"hosted.*most|city.*most often",
     "SELECT City, COUNT(DISTINCT Year) AS times_hosted FROM athlete_events "
     "GROUP BY City ORDER BY times_hosted DESC LIMIT 5;"),
    (r"top 5 athletes|athletes by gold",
     "SELECT Name, Team, COUNT(*) AS gold_medals FROM athlete_events "
     "WHERE Medal='Gold' GROUP BY Name, Team ORDER BY gold_medals DESC LIMIT 5;"),
    (r"1896",
     "SELECT COUNT(DISTINCT Team) AS countries FROM athlete_events WHERE Year=1896;"),
    (r"winter.*host",
     "SELECT DISTINCT City, Year FROM athlete_events WHERE Season='Winter' ORDER BY Year;"),
    (r"percentage.*female|female.*percentage",
     "SELECT ROUND(100.0*SUM(CASE WHEN Sex='F' THEN 1 ELSE 0 END)/COUNT(*),1) "
     "AS female_pct FROM athlete_events;"),
    (r"most olympics|participated in the most",
     "SELECT Name, Team, COUNT(DISTINCT Year) AS olympics_count FROM athlete_events "
     "GROUP BY Name, Team ORDER BY olympics_count DESC LIMIT 5;"),
    (r"gold medals won by jamaica|jamaica",
     "SELECT Name, Sport, Event, Year FROM athlete_events "
     "WHERE Team='Jamaica' AND Medal='Gold' ORDER BY Year;"),
    (r"kenya.*athletics|athletics.*kenya",
     "SELECT Medal, COUNT(*) AS count FROM athlete_events "
     "WHERE Team='Kenya' AND Sport='Athletics' AND Medal IS NOT NULL GROUP BY Medal;"),
]


# Capitalised multi-word phrases that aren't athlete names.
_NAME_STOPWORDS = {
    "How", "Which", "What", "Show", "Who", "List", "Top", "When", "Where",
    "Olympic", "Olympics", "Summer", "Winter", "Games", "Season",
}
_NAME_RE = re.compile(r"\b([A-Z][a-z]+(?:\s+(?:[A-Z][a-z]+|[A-Z]\.))+)\b")


def _extract_person(question: str) -> Optional[str]:
    """Pull a likely athlete name (2+ capitalised words) from the question."""
    candidates = []
    for m in _NAME_RE.finditer(question):
        phrase = m.group(1)
        first = phrase.split()[0]
        if first in _NAME_STOPWORDS:
            # Drop a leading stopword like "How"/"Show" but keep the rest.
            rest = phrase.split(maxsplit=1)
            phrase = rest[1] if len(rest) > 1 and len(rest[1].split()) >= 1 else ""
        if len(phrase.split()) >= 2:
            candidates.append(phrase)
    return max(candidates, key=len) if candidates else None


def _generate_sql_demo(question: str) -> str:
    q = question.lower()
    for pattern, sql in _DEMO_RULES:
        if re.search(pattern, q):
            return sql

    # Free-form athlete questions, e.g. "How many medals has Usain Bolt won?"
    person = _extract_person(question)
    if person:
        # Match each name token separately so middle names don't break it
        # (the dataset stores e.g. "Usain St. Leo Bolt", "Michael Fred Phelps, II").
        tokens = [t.replace("'", "''") for t in person.split() if len(t) > 1]
        name_clause = " AND ".join(f"Name LIKE '%{t}%'" for t in tokens)
        if "how many" in q or "count" in q or "number of" in q:
            return (
                "SELECT Medal, COUNT(*) AS count FROM athlete_events "
                f"WHERE {name_clause} AND Medal IS NOT NULL "
                "GROUP BY Medal ORDER BY count DESC;"
            )
        return (
            "SELECT Name, Team, Year, Sport, Event, Medal FROM athlete_events "
            f"WHERE {name_clause} "
            + ("AND Medal IS NOT NULL " if "medal" in q or "won" in q or "win" in q else "")
            + "ORDER BY Year;"
        )

    # Generic fallback: a safe overview query.
    return ("SELECT Team, COUNT(*) AS medals FROM athlete_events "
            "WHERE Medal IS NOT NULL GROUP BY Team ORDER BY medals DESC LIMIT 10;")


def generate_sql(question: str) -> str:
    _try_load_model()
    if _MODEL_STATE == "loaded":
        try:
            return _generate_sql_with_model(question)
        except Exception as exc:  # noqa: BLE001
            print(f"[warn] generation failed, falling back to demo: {exc}")
    return _generate_sql_demo(question)


# --------------------------------------------------------------------------- #
# SQL execution (read-only guard)
# --------------------------------------------------------------------------- #
_FORBIDDEN = re.compile(
    r"\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|REPLACE|ATTACH|DETACH|PRAGMA)\b",
    re.IGNORECASE,
)


def run_sql(sql: str) -> tuple[list[str], list[list[Any]]]:
    if _FORBIDDEN.search(sql):
        raise ValueError("Only read-only SELECT queries are allowed.")
    if not os.path.exists(DB_PATH):
        raise FileNotFoundError(
            f"Database not found at {DB_PATH}. Build olympics.db from the notebook."
        )
    with closing(sqlite3.connect(DB_PATH)) as conn:
        cur = conn.execute(sql)
        columns = [d[0] for d in cur.description] if cur.description else []
        rows = [list(r) for r in cur.fetchall()]
    return columns, rows


def _scalar(sql: str, default: Any = 0) -> Any:
    try:
        with closing(sqlite3.connect(DB_PATH)) as conn:
            row = conn.execute(sql).fetchone()
        return row[0] if row and row[0] is not None else default
    except Exception:  # noqa: BLE001
        return default


# --------------------------------------------------------------------------- #
# FastAPI app
# --------------------------------------------------------------------------- #
app = FastAPI(title="Olympics NL→SQL API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class QueryRequest(BaseModel):
    question: str


class QueryResponse(BaseModel):
    question: str
    sql: str
    columns: list[str]
    rows: list[list[Any]]
    row_count: int
    elapsed_ms: int
    engine: str
    error: Optional[str] = None


@app.get("/api/health")
def health() -> dict:
    return {
        "status": "ok",
        "model_state": _MODEL_STATE,
        "db_found": os.path.exists(DB_PATH),
        "model_repo": HF_MODEL_REPO,
    }


@app.get("/api/examples")
def examples() -> dict:
    return {"examples": EXAMPLES}


@app.get("/api/stats")
def stats() -> dict:
    """Headline KPIs for the dashboard hero."""
    if not os.path.exists(DB_PATH):
        # Static fallback numbers so the dashboard still renders for demos.
        return {
            "db_found": False,
            "total_records": 271116,
            "total_athletes": 134732,
            "countries": 230,
            "sports": 66,
            "events": 765,
            "years_span": "1896–2016",
            "gold": 13372,
            "top_countries": [
                {"team": "United States", "medals": 5637},
                {"team": "Soviet Union", "medals": 2503},
                {"team": "Germany", "medals": 2165},
                {"team": "Great Britain", "medals": 2068},
                {"team": "France", "medals": 1777},
            ],
        }

    top_rows = []
    try:
        with closing(sqlite3.connect(DB_PATH)) as conn:
            for team, medals in conn.execute(
                "SELECT Team, COUNT(*) AS m FROM athlete_events "
                "WHERE Medal IS NOT NULL GROUP BY Team ORDER BY m DESC LIMIT 5"
            ):
                top_rows.append({"team": team, "medals": medals})
    except Exception:  # noqa: BLE001
        pass

    min_year = _scalar("SELECT MIN(Year) FROM athlete_events", 1896)
    max_year = _scalar("SELECT MAX(Year) FROM athlete_events", 2016)

    return {
        "db_found": True,
        "total_records": _scalar("SELECT COUNT(*) FROM athlete_events"),
        "total_athletes": _scalar("SELECT COUNT(DISTINCT ID) FROM athlete_events"),
        "countries": _scalar("SELECT COUNT(DISTINCT NOC) FROM athlete_events"),
        "sports": _scalar("SELECT COUNT(DISTINCT Sport) FROM athlete_events"),
        "events": _scalar("SELECT COUNT(DISTINCT Event) FROM athlete_events"),
        "years_span": f"{min_year}–{max_year}",
        "gold": _scalar("SELECT COUNT(*) FROM athlete_events WHERE Medal='Gold'"),
        "top_countries": top_rows,
    }


@app.post("/api/query", response_model=QueryResponse)
def query(req: QueryRequest) -> QueryResponse:
    question = (req.question or "").strip()
    if not question:
        raise HTTPException(status_code=400, detail="Question must not be empty.")

    start = time.perf_counter()
    sql = generate_sql(question)

    columns: list[str] = []
    rows: list[list[Any]] = []
    error: Optional[str] = None
    try:
        columns, rows = run_sql(sql)
    except Exception as exc:  # noqa: BLE001
        error = str(exc)

    elapsed_ms = int((time.perf_counter() - start) * 1000)
    return QueryResponse(
        question=question,
        sql=sql,
        columns=columns,
        rows=rows,
        row_count=len(rows),
        elapsed_ms=elapsed_ms,
        engine="llama-3.2-3b" if _MODEL_STATE == "loaded" else "demo-rules",
        error=error,
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
