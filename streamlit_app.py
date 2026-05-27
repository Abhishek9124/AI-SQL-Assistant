import streamlit as st
import sqlite3
import pandas as pd
from transformers import AutoModelForCausalLM, AutoTokenizer

st.set_page_config(
    page_title="120 Years of Olympics AI",
    page_icon="🏅",
    layout="wide"
)

st.title("🏅 120 Years of Olympics — Ask Anything")
st.caption("Fine-tuned Llama 3.2-3B  ·  271,116 athlete records  ·  Athens 1896 to Rio 2016")

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

HF_MODEL_REPO = "Abhishek9124/llama3-olympics-120years"

@st.cache_resource
def load_model():
    m = AutoModelForCausalLM.from_pretrained(
        HF_MODEL_REPO,
        load_in_4bit=True,
        device_map="auto"
    )
    t = AutoTokenizer.from_pretrained(HF_MODEL_REPO)
    return m, t

model, tokenizer = load_model()


def get_sql(question):
    prompt = f"""### Task
Convert the natural language question into a SQL query for the Olympics database.

### Database Schema
{SCHEMA}

### Question
{question}

### SQL Query
"""
    inputs = tokenizer(prompt, return_tensors="pt").to(model.device)
    outputs = model.generate(
        **inputs,
        max_new_tokens=200,
        temperature=0.1,
        do_sample=True,
        pad_token_id=tokenizer.eos_token_id,
    )
    raw = tokenizer.decode(outputs[0], skip_special_tokens=True)
    sql = raw.split("### SQL Query")[-1].split("###")[0].strip()
    return sql.split(";")[0].strip() + ";"


def run_sql(sql):
    try:
        conn = sqlite3.connect("olympics.db")
        df = pd.read_sql_query(sql, conn)
        conn.close()
        return df, None
    except Exception as e:
        return None, str(e)


if "question" not in st.session_state:
    st.session_state.question = ""

col1, col2 = st.columns([1, 2])

with col1:
    st.markdown("**Example questions**")
    for ex in EXAMPLES:
        if st.button(ex, key=ex, use_container_width=True):
            st.session_state.question = ex

    st.divider()
    question = st.text_area(
        "Or type your own question",
        value=st.session_state.question,
        placeholder="e.g. Which sport did India win its first gold medal in?",
        height=90
    )
    ask_clicked = st.button("Ask AI", type="primary", use_container_width=True)

with col2:
    if ask_clicked and question:
        with st.spinner("Generating SQL and fetching results..."):
            sql = get_sql(question)
            df, error = run_sql(sql)

        st.markdown("**Generated SQL**")
        st.code(sql, language="sql")

        if error:
            st.error(f"SQL Error: {error}")
            st.info("Try rephrasing your question slightly.")
        elif df is not None and len(df) > 0:
            st.markdown(f"**Results — {len(df):,} rows**")
            st.dataframe(df, use_container_width=True, height=420)

            c1, c2 = st.columns(2)
            with c1:
                st.download_button(
                    label="Download as CSV",
                    data=df.to_csv(index=False),
                    file_name="olympics_result.csv",
                    mime="text/csv",
                    use_container_width=True
                )
            with c2:
                numeric_cols = df.select_dtypes(include="number").columns.tolist()
                if numeric_cols and len(df) <= 50:
                    if st.button("Show bar chart", use_container_width=True):
                        st.bar_chart(df.set_index(df.columns[0])[numeric_cols[0]])
        else:
            st.warning("No results returned. Try a different question.")
