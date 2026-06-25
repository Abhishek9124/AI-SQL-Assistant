# 🧠 AI SQL Assistant — Natural language → SQL on any CSV

Upload **any CSV**, optionally **fine-tune a small model on it**, then ask questions
in plain English and get back real SQL executed live against your data — as a
table with CSV export and an auto chart.

Built with a **React + FastAPI** web app and a **hybrid SQL engine** that combines
a per-dataset fine-tuned **Flan-T5** model with a deterministic, schema-aware SQL
generator (and an optional Claude upgrade).

---

## What it does

1. **Upload a CSV** → the backend profiles every column (type, role, cardinality,
   sample values), loads it into SQLite, and infers a schema automatically.
2. **Train (optional)** → fine-tune `google/flan-t5-small` on synthetic
   question/SQL pairs generated from *your* schema. Uses your **GPU** when
   available (CUDA), otherwise CPU. Live progress (epoch / step / loss) streams to
   the UI.
3. **Ask** → type a question; the assistant generates SQL, runs it read-only, and
   shows the results.

It works on *any* tabular CSV — sales, logistics, survey data, the bundled
Olympics dataset, anything.

---

## The hybrid SQL engine

Every question is answered by the first engine that produces a **valid** read-only
`SELECT` (validated by `EXPLAIN` against the real table); anything invalid falls
through to the next:

| Order | Engine | When |
|---|---|---|
| 1 | **Fine-tuned model** (Flan-T5) | after you train on the dataset |
| 2 | **Claude** | if `ANTHROPIC_API_KEY` is set |
| 3 | **Deterministic generator** | always available — the safety net |

The deterministic generator parses the question against the inferred schema
(counts, group-by, aggregates, filters, ranking), so the app is fully usable
**without any training or API key**.

---

## Tech stack

| Layer | Tools |
|---|---|
| Frontend | React + Vite + Tailwind + Framer Motion + Recharts |
| API | FastAPI + Uvicorn |
| Ingestion | pandas → SQLite, automatic schema inference & profiling |
| Fine-tuning | PyTorch + Transformers (`google/flan-t5-small`), CPU or CUDA |
| Generation | fine-tuned model · Claude (optional) · deterministic fallback |

---

## Quickstart

> Requires **Python 3.10+** and **Node 18+**. Run the backend and frontend in two
> terminals.

### 1. Backend — FastAPI (terminal 1)

```bash
python -m venv venv
# Windows (PowerShell):  venv\Scripts\Activate.ps1
# macOS / Linux:         source venv/bin/activate

pip install -r backend/requirements.txt
uvicorn backend.main:app --port 8000     # run from the project root
```

The optional `torch`/`transformers` enable real fine-tuning. **For GPU training**
install the CUDA build of torch:

```bash
pip install torch==2.12.0+cu126 --index-url https://download.pytorch.org/whl/cu126
```

### 2. Frontend — React (terminal 2)

```bash
cd frontend
npm install
npm run dev                               # http://localhost:5173
```

Open **http://localhost:5173**, drop in a CSV (or click *Try the bundled sample*),
optionally hit **Train**, and start asking. Vite proxies `/api` to the backend.

### Optional: Claude upgrade

```bash
export ANTHROPIC_API_KEY=sk-ant-...       # Windows: $env:ANTHROPIC_API_KEY="..."
```

When set, the assistant uses Claude for SQL on questions the fine-tuned model
can't handle (only the schema + question are sent, never your full data).

---

## API surface

| Endpoint | Purpose |
|---|---|
| `POST /api/upload` | Upload a CSV → ingest, infer schema, return stats + examples |
| `POST /api/sample` | Load the bundled sample dataset (`{ "train": true }` to also train) |
| `POST /api/datasets/{id}/train` | Start per-dataset fine-tuning (background job) |
| `GET /api/datasets/{id}/status` | Training progress (state / epoch / step / loss) |
| `GET /api/schema` | Inferred columns, roles, sample rows |
| `GET /api/stats` | Auto dashboard KPIs |
| `GET /api/examples` | Schema-derived example questions |
| `POST /api/query` | Question → SQL → executed results (`sql`, `columns`, `rows`, `engine`) |
| `GET /api/health` | ML availability, active dataset, Claude availability |

---

## Project layout

```
.
├── backend/                 # FastAPI app
│   ├── main.py              # endpoints + app state
│   ├── ingest.py            # CSV → SQLite + schema inference/profiling
│   ├── synth.py             # schema-derived synthetic NL→SQL pairs + examples
│   ├── trainer.py           # per-CSV fine-tuning (CPU/GPU) + serving
│   ├── engine.py            # hybrid generation + validation + execution
│   ├── heuristic.py         # deterministic schema-aware SQL generator
│   ├── storage.py           # dataset registry (uploads, DBs, models, status)
│   └── requirements.txt
├── frontend/                # React + Vite + Tailwind UI
│   └── src/
│       ├── App.jsx
│       ├── api.js
│       └── components/      # UploadZone, SchemaPanel, TrainPanel, QueryConsole,
│                            # StatCard, SqlBlock, ResultsTable, ResultChart
├── Fine_TuningLLM.ipynb     # (legacy) heavyweight Llama LoRA notebook
└── data/                    # runtime workspace (gitignored): uploads, DBs, models
```

---

## How "training" works

On **Train**, the backend:

1. Generates synthetic `(question, SQL)` pairs from the inferred schema
   (`synth.py`) — counts, group-bys, aggregates, filters, ranking.
2. Fine-tunes `flan-t5-small` on them with a plain PyTorch loop (GPU if available),
   streaming epoch / step / loss to `status.json`.
3. Saves the model under `data/datasets/<id>/model/` and serves it for that
   dataset.

A tiny model trained on a small CSV won't be perfect — which is exactly why the
deterministic generator validates and backstops every answer.
