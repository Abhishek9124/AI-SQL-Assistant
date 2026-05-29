# 🏅 Olympics NL→SQL — Fine-tuned Llama 3.2

Ask questions about **120 years of Olympic history in plain English** and get back real SQL queries executed on a 271,116-row database.

Built by fine-tuning **Llama 3.2-3B** with LoRA on a custom natural-language → SQL dataset, then served through a modern **React + FastAPI** web app (a single-file Streamlit app is included too).

---

## What it does

Type a question like *"Which country won the most gold medals overall?"* — the model generates the SQL, runs it against SQLite, and shows the results as a table with CSV download and optional bar chart.

Covers every Olympics from **Athens 1896 → Rio 2016**, including athlete names, ages, height/weight, sport, event, medals, and host cities.

---

## Tech stack

| Layer | Tools |
|---|---|
| Base model | Llama 3.2-3B-Instruct (4-bit quantized) |
| Fine-tuning | Unsloth + LoRA (PEFT), TRL SFTTrainer |
| Training | 30 NL/SQL pairs · 10 epochs · cosine LR schedule |
| Inference | Hugging Face Transformers, 4-bit |
| Data | SQLite (`olympics.db`, 271K rows) |
| API | FastAPI (lazy model load + demo fallback) |
| Frontend | React + Vite + Tailwind + Framer Motion + Recharts (also a single-file Streamlit app) |
| Model hosting | [Hugging Face Hub](https://huggingface.co/Abhishek9124/llama3-olympics-120years) |

---

## How it works

1. **Dataset prep** — Olympics CSV (Kaggle's 120-years dataset) loaded into SQLite as `athlete_events`.
2. **Training data** — 30 hand-crafted question/SQL pairs covering aggregations, filters, joins-by-condition, country/sport breakdowns, and edge cases (oldest medalist, female participation %, etc.).
3. **Fine-tuning** — LoRA adapters (r=16) on all attention + MLP projections, trained with Unsloth's 4-bit pipeline for fast convergence on a single GPU.
4. **Serving** — a FastAPI backend loads the model from HF Hub, prompts it with the schema + question, parses out the SQL, executes it read-only against SQLite, and returns rows to the React UI (a Streamlit app does the same in a single file).

---

## Quickstart

> Requires **Python 3.10+** and **Node 18+**. Run the backend and frontend in two terminals.

### 0. Build the database (once)

`build_db.py` loads `olympics.csv` (Kaggle's "120 years of Olympic history") into
`olympics.db`. If the CSV isn't present, it generates a representative sample
database with the same schema so the app still works end-to-end.

```bash
python -m venv venv

# Windows (PowerShell):
venv\Scripts\Activate.ps1
# macOS / Linux:
source venv/bin/activate

pip install pandas
python build_db.py            # -> creates olympics.db (271,116 rows)
```

### 1. Backend — FastAPI (terminal 1)

```bash
cd backend
pip install -r requirements.txt        # FastAPI + uvicorn (+ optional model deps)
uvicorn main:app --reload --port 8000  # http://localhost:8000
```

### 2. Frontend — React (terminal 2)

```bash
cd frontend
npm install
npm run dev                            # http://localhost:5173
```

Open **http://localhost:5173** and ask away. The Vite dev server proxies `/api`
to the backend automatically.

> **Engine:** the backend loads the fine-tuned model lazily on the first query.
> Without a GPU / model weights it falls back to a built-in rule-based SQL
> generator, so the UI stays fully interactive for demos. Read-only `SELECT`
> queries are enforced server-side.

API surface:

| Endpoint | Purpose |
|---|---|
| `POST /api/query` | Question → SQL → executed results (`sql`, `columns`, `rows`, `elapsed_ms`) |
| `GET /api/stats` | Dashboard KPIs (records, athletes, countries, sports, gold, span) |
| `GET /api/examples` | Curated example questions |
| `GET /api/health` | Model + DB status |

### Alternative: Streamlit (single file)

```bash
pip install -r requirements.txt
streamlit run streamlit_app.py
```

---

## Project layout

```
.
├── Fine_TuningLLM.ipynb     # End-to-end training notebook
├── build_db.py              # Build olympics.db from CSV (or generate a sample)
├── streamlit_app.py         # Single-file Streamlit UI
├── requirements.txt
├── backend/                 # FastAPI inference API
│   ├── main.py
│   └── requirements.txt
└── frontend/                # React + Vite + Tailwind UI
    ├── src/
    │   ├── App.jsx
    │   ├── api.js
    │   └── components/      # StatCard, QueryConsole, SqlBlock, ResultsTable, ResultChart
    └── package.json
```

---

## Example questions it handles

- *Show all medals won by India*
- *Who is the oldest gold medalist ever?*
- *What percentage of athletes are female?*
- *Top 5 athletes by gold medal count*
- *How many countries competed in the 1896 Olympics?*

---

## Why this project

A compact, end-to-end demo of the modern small-LLM playbook: take an open-weight model, fine-tune it cheaply with LoRA on domain-specific data, and ship it behind a usable UI — without an API bill or a vector store in sight.
