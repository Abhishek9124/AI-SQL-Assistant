# 🏅 Olympics NL→SQL — Fine-tuned Llama 3.2

Ask questions about **120 years of Olympic history in plain English** and get back real SQL queries executed on a 271,116-row database.

Built by fine-tuning **Llama 3.2-3B** with LoRA on a custom natural-language → SQL dataset, then served through a Streamlit app.

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
| Backend | SQLite (`olympics.db`, 271K rows) |
| Frontend | Streamlit |
| Model hosting | [Hugging Face Hub](https://huggingface.co/Abhishek9124/llama3-olympics-120years) |

---

## How it works

1. **Dataset prep** — Olympics CSV (Kaggle's 120-years dataset) loaded into SQLite as `athlete_events`.
2. **Training data** — 30 hand-crafted question/SQL pairs covering aggregations, filters, joins-by-condition, country/sport breakdowns, and edge cases (oldest medalist, female participation %, etc.).
3. **Fine-tuning** — LoRA adapters (r=16) on all attention + MLP projections, trained with Unsloth's 4-bit pipeline for fast convergence on a single GPU.
4. **Serving** — Streamlit app loads the merged model from HF Hub, prompts it with the schema + question, parses out the SQL, executes it, and renders results.

---

## Run locally

```bash
pip install -r requirements.txt
streamlit run streamlit_app.py
```

You'll need `olympics.db` in the project root (built from the Kaggle "120 years of Olympic history" dataset — the notebook shows the one-liner to create it).

---

## Project layout

```
.
├── Fine_TuningLLM.ipynb   # End-to-end training notebook
├── streamlit_app.py       # Inference UI
├── requirements.txt
└── README.md
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
