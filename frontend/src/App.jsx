import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Award,
  Database,
  Globe,
  Medal,
  Trophy,
  Users,
  Zap,
  AlertTriangle,
  Github,
  Cpu,
} from "lucide-react";

import { fetchExamples, fetchHealth, fetchStats, runQuery } from "./api";
import StatCard from "./components/StatCard";
import QueryConsole from "./components/QueryConsole";
import SqlBlock from "./components/SqlBlock";
import ResultsTable from "./components/ResultsTable";
import ResultChart from "./components/ResultChart";

const fmt = (n) => (typeof n === "number" ? n.toLocaleString() : n ?? "—");

export default function App() {
  const [stats, setStats] = useState(null);
  const [examples, setExamples] = useState([]);
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchStats().then(setStats).catch(() => {});
    fetchExamples()
      .then((d) => setExamples(d.examples || []))
      .catch(() => {});
    fetchHealth().then(setHealth).catch(() => {});
  }, []);

  const ask = async (question) => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await runQuery(question);
      setResult(data);
    } catch (e) {
      setError(e.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const engineLabel =
    health?.model_state === "loaded"
      ? "Llama 3.2-3B · live"
      : health?.model_state === "demo"
        ? "Demo engine"
        : "Connecting…";

  return (
    <>
      <div className="aurora grid-overlay" />

      <div className="mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-12">
        {/* Header */}
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-gold to-amber-500 text-black shadow-glow">
              <Trophy size={22} />
            </div>
            <div>
              <div className="text-sm font-bold tracking-tight">Olympics NL→SQL</div>
              <div className="text-xs text-white/45">
                Fine-tuned Llama 3.2-3B · LoRA
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/70">
              <Cpu size={13} className="text-emerald-400" />
              {engineLabel}
            </span>
            <a
              href="https://github.com/Abhishek9124/olympics-nl-to-sql"
              target="_blank"
              rel="noreferrer"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-white/60 transition hover:bg-white/10 hover:text-white"
            >
              <Github size={17} />
            </a>
          </div>
        </header>

        {/* Hero */}
        <section className="mt-14 text-center md:mt-20">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-3 py-1 text-xs text-gold"
          >
            <Zap size={13} /> Text-to-SQL on 271K athlete records
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="text-4xl font-extrabold leading-tight tracking-tight md:text-6xl"
          >
            Ask the <span className="text-gradient">Olympics</span> anything,
            <br className="hidden md:block" /> in plain English.
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mx-auto mt-4 max-w-2xl text-base text-white/55 md:text-lg"
          >
            A fine-tuned Llama 3.2-3B turns your question into SQL, runs it live
            against 120 years of Olympic history, and shows the results — Athens
            1896 to Rio 2016.
          </motion.p>
        </section>

        {/* Stat cards */}
        {stats && (
          <section className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
            <StatCard icon={Database} label="Records" value={fmt(stats.total_records)} delay={0} />
            <StatCard icon={Users} label="Athletes" value={fmt(stats.total_athletes)} accent="#0085c7" delay={0.05} />
            <StatCard icon={Globe} label="Countries" value={fmt(stats.countries)} accent="#009f3d" delay={0.1} />
            <StatCard icon={Medal} label="Sports" value={fmt(stats.sports)} accent="#df0024" delay={0.15} />
            <StatCard icon={Award} label="Gold medals" value={fmt(stats.gold)} accent="#f5c518" delay={0.2} />
            <StatCard icon={Trophy} label="Span" value={stats.years_span} accent="#9b5de5" delay={0.25} />
          </section>
        )}

        {/* Query console */}
        <section className="mt-10">
          <QueryConsole examples={examples} loading={loading} onAsk={ask} />
        </section>

        {/* Results */}
        <section className="mt-8 space-y-5">
          <AnimatePresence mode="wait">
            {loading && (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="glass space-y-3 rounded-2xl p-6"
              >
                <div className="h-4 w-1/3 animate-pulse rounded bg-white/10" />
                <div className="h-24 w-full animate-pulse rounded bg-white/[0.06]" />
                <div className="h-40 w-full animate-pulse rounded bg-white/[0.04]" />
              </motion.div>
            )}

            {!loading && error && (
              <motion.div
                key="error"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-start gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200"
              >
                <AlertTriangle size={18} className="mt-0.5 shrink-0" />
                <div>
                  <div className="font-semibold">Couldn’t reach the API</div>
                  <div className="text-red-200/70">{error}</div>
                  <div className="mt-1 text-xs text-red-200/50">
                    Make sure the backend is running: <code>uvicorn main:app</code> in <code>/backend</code>.
                  </div>
                </div>
              </motion.div>
            )}

            {!loading && result && (
              <motion.div
                key="result"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-5"
              >
                <div className="flex flex-wrap items-center gap-3 text-xs text-white/50">
                  <span className="rounded-full bg-white/[0.06] px-3 py-1">
                    ⚡ {result.elapsed_ms} ms
                  </span>
                  <span className="rounded-full bg-white/[0.06] px-3 py-1">
                    engine: {result.engine}
                  </span>
                  <span className="rounded-full bg-white/[0.06] px-3 py-1">
                    {fmt(result.row_count)} rows
                  </span>
                </div>

                <SqlBlock sql={result.sql} />

                {result.error ? (
                  <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
                    <div className="font-semibold">Query error</div>
                    <div className="text-amber-200/70">{result.error}</div>
                    <div className="mt-1 text-xs text-amber-200/50">
                      Try rephrasing the question slightly.
                    </div>
                  </div>
                ) : result.row_count > 0 ? (
                  <div className="grid gap-5 lg:grid-cols-2">
                    <ResultsTable columns={result.columns} rows={result.rows} />
                    <ResultChart columns={result.columns} rows={result.rows} />
                  </div>
                ) : (
                  <div className="glass rounded-2xl p-6 text-center text-sm text-white/50">
                    No rows returned — try a different question.
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* Footer */}
        <footer className="mt-16 border-t border-white/10 pt-6 text-center text-xs text-white/35">
          Built with Llama 3.2-3B · Unsloth + LoRA · FastAPI · React. Data:
          120 years of Olympic history (1896–2016).
        </footer>
      </div>
    </>
  );
}
