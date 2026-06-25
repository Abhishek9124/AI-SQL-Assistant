import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Database,
  Columns3,
  Hash,
  Sigma,
  Tag,
  Zap,
  AlertTriangle,
  Clock,
  Rows3,
  Plus,
  BrainCircuit,
  Cpu,
  Sparkles,
} from "lucide-react";

import {
  activateDataset,
  executeSql,
  fetchDatasets,
  fetchExamples,
  fetchHealth,
  fetchSchema,
  fetchStats,
  fetchStatus,
  loadSample,
  runQuery,
  startTraining,
  uploadCsv,
} from "./api";
import StatCard from "./components/StatCard";
import QueryConsole from "./components/QueryConsole";
import SqlBlock from "./components/SqlBlock";
import ResultsTable from "./components/ResultsTable";
import ResultChart from "./components/ResultChart";
import UploadZone from "./components/UploadZone";
import SchemaPanel from "./components/SchemaPanel";
import TrainPanel from "./components/TrainPanel";
import HistoryPanel from "./components/HistoryPanel";
import DatasetSwitcher from "./components/DatasetSwitcher";

const fmt = (n) => (typeof n === "number" ? n.toLocaleString() : n ?? "—");
const CARD_ICONS = [Database, Columns3, Tag, Sigma, Hash, Rows3];
const CARD_ACCENTS = ["#f5c518", "#0085c7", "#009f3d", "#df0024", "#9b5de5", "#ff8c42"];

const ENGINE = {
  "fine-tuned": { label: "fine-tuned model", color: "text-emerald-300", Icon: BrainCircuit },
  deterministic: { label: "deterministic engine", color: "text-sky-300", Icon: Cpu },
  manual: { label: "manual SQL", color: "text-gold", Icon: Sparkles },
};

const HISTORY_KEY = "aisql.history";
const MAX_HISTORY = 12;

export default function App() {
  const [health, setHealth] = useState(null);
  const [datasetId, setDatasetId] = useState(null);
  const [schema, setSchema] = useState(null);
  const [stats, setStats] = useState(null);
  const [examples, setExamples] = useState([]);
  const [trainStatus, setTrainStatus] = useState(null);

  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [datasets, setDatasets] = useState([]);
  const [history, setHistory] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
    } catch {
      return [];
    }
  });
  const pollRef = useRef(null);

  // Persist query history locally (no server, no account needed).
  useEffect(() => {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    } catch {
      /* storage full / disabled — non-fatal */
    }
  }, [history]);

  const recordHistory = (question, res) =>
    setHistory((h) =>
      [
        { id: Date.now(), question, engine: res?.engine, rowCount: res?.row_count },
        ...h.filter((x) => x.question !== question),
      ].slice(0, MAX_HISTORY)
    );

  const refreshDatasets = () =>
    fetchDatasets()
      .then((d) => setDatasets(d.datasets || []))
      .catch(() => {});

  // Initial: health + restore active dataset if one exists.
  useEffect(() => {
    refreshDatasets();
    fetchHealth()
      .then((h) => {
        setHealth(h);
        if (h.active_dataset) {
          Promise.all([
            fetchSchema(h.active_dataset),
            fetchStats(h.active_dataset),
            fetchExamples(h.active_dataset),
            fetchStatus(h.active_dataset),
          ])
            .then(([sc, st, ex, status]) => {
              setDatasetId(h.active_dataset);
              setSchema(sc);
              setStats(st);
              setExamples(ex.examples || []);
              setTrainStatus(status);
            })
            .catch(() => {});
        }
      })
      .catch(() => {});
  }, []);

  // Poll training status while a job is active.
  useEffect(() => {
    const st = trainStatus?.state;
    if (!datasetId || (st !== "pending" && st !== "running")) return;
    pollRef.current = setInterval(async () => {
      try {
        const s = await fetchStatus(datasetId);
        setTrainStatus(s);
        if (["done", "failed", "unavailable"].includes(s.state)) {
          clearInterval(pollRef.current);
        }
      } catch {
        /* keep polling */
      }
    }, 1500);
    return () => clearInterval(pollRef.current);
  }, [datasetId, trainStatus?.state]);

  const applyDataset = (resp) => {
    setDatasetId(resp.dataset_id);
    setSchema(resp.schema);
    setStats(resp.stats);
    setExamples(resp.examples || []);
    setTrainStatus({ state: "none" });
    setResult(null);
    setError(null);
    refreshDatasets();
  };

  const onFile = async (file) => {
    setUploading(true);
    setError(null);
    try {
      applyDataset(await uploadCsv(file));
    } catch (e) {
      setError(e.message || "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const onSample = async () => {
    setUploading(true);
    setError(null);
    try {
      applyDataset(await loadSample(false));
    } catch (e) {
      setError(e.message || "Could not load sample.");
    } finally {
      setUploading(false);
    }
  };

  const onTrain = async () => {
    try {
      const s = await startTraining(datasetId);
      setTrainStatus(s.state ? s : { state: "pending" });
    } catch (e) {
      setError(e.message || "Could not start training.");
    }
  };

  const ask = async (question) => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await runQuery(question, datasetId);
      setResult(res);
      recordHistory(question, res);
    } catch (e) {
      setError(e.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  // Run user-edited SQL directly (validated read-only on the backend).
  const runManual = async (sql) => {
    setRunning(true);
    setError(null);
    try {
      const res = await executeSql(sql, datasetId);
      setResult(res);
    } catch (e) {
      setError(e.message || "Could not run that SQL.");
    } finally {
      setRunning(false);
    }
  };

  const switchDataset = async (id) => {
    if (id === datasetId) return;
    setError(null);
    setResult(null);
    try {
      await activateDataset(id);
      const [sc, st, ex, status] = await Promise.all([
        fetchSchema(id),
        fetchStats(id),
        fetchExamples(id),
        fetchStatus(id),
      ]);
      setDatasetId(id);
      setSchema(sc);
      setStats(st);
      setExamples(ex.examples || []);
      setTrainStatus(status);
    } catch (e) {
      setError(e.message || "Could not switch dataset.");
    }
  };

  const newDataset = () => {
    clearInterval(pollRef.current);
    setDatasetId(null);
    setSchema(null);
    setStats(null);
    setExamples([]);
    setTrainStatus(null);
    setResult(null);
    setError(null);
    refreshDatasets();
  };

  const online = !!health;
  const eng = result && (ENGINE[result.engine] || ENGINE.deterministic);

  return (
    <>
      <div className="aurora grid-overlay" />

      <div className="mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-12">
        {/* Header */}
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-gold to-amber-500 text-black shadow-glow">
              <Database size={22} />
            </div>
            <div>
              <div className="text-sm font-bold tracking-tight">AI SQL Assistant</div>
              <div className="text-xs text-white/45">Upload · train · ask in plain English</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {datasetId && datasets.length > 1 && (
              <DatasetSwitcher
                datasets={datasets}
                activeId={datasetId}
                onSelect={switchDataset}
              />
            )}
            {datasetId && (
              <button
                onClick={newDataset}
                className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/70 transition hover:bg-white/10"
              >
                <Plus size={13} /> New dataset
              </button>
            )}
            <span className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/70">
              <span className="relative flex h-2 w-2">
                <span
                  className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${
                    online ? "animate-ping bg-emerald-400" : "bg-white/30"
                  }`}
                />
                <span
                  className={`relative inline-flex h-2 w-2 rounded-full ${
                    online ? "bg-emerald-400" : "bg-white/40"
                  }`}
                />
              </span>
              {online ? "100% local" : "Connecting…"}
            </span>
          </div>
        </header>

        {/* No dataset yet → hero + upload */}
        {!datasetId && (
          <section className="mt-16 md:mt-24">
            <div className="text-center">
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-3 py-1 text-xs text-gold"
              >
                <Zap size={13} /> Natural language → SQL on any CSV
              </motion.div>
              <motion.h1
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className="text-4xl font-extrabold leading-tight tracking-tight md:text-6xl"
              >
                Ask your data anything,
                <br className="hidden md:block" /> in plain{" "}
                <span className="text-gradient">English</span>.
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="mx-auto mb-10 mt-4 max-w-2xl text-base text-white/55 md:text-lg"
              >
                Upload a CSV, optionally fine-tune a small model on it, then ask
                questions and get live SQL plus results.
              </motion.p>
            </div>
            <UploadZone
              onFile={onFile}
              onSample={onSample}
              busy={uploading}
              sampleAvailable={health?.sample_available}
              maxMb={health?.max_upload_mb || 25}
            />
            {error && (
              <div className="mx-auto mt-5 max-w-2xl rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-center text-sm text-red-200">
                {error}
              </div>
            )}
          </section>
        )}

        {/* Dataset loaded → workspace */}
        {datasetId && (
          <>
            {stats?.headline && (
              <section className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
                {stats.headline.map((kpi, i) => (
                  <StatCard
                    key={kpi.label}
                    icon={CARD_ICONS[i % CARD_ICONS.length]}
                    label={kpi.label}
                    value={fmt(kpi.value)}
                    accent={CARD_ACCENTS[i % CARD_ACCENTS.length]}
                    delay={i * 0.05}
                  />
                ))}
              </section>
            )}

            <section className="mt-6 grid gap-5 lg:grid-cols-2">
              <SchemaPanel schema={schema} />
              <TrainPanel
                status={trainStatus}
                onTrain={onTrain}
                mlAvailable={health?.ml_available}
              />
            </section>

            <section
              className={`mt-6 grid gap-5 ${history.length ? "lg:grid-cols-2" : ""}`}
            >
              <QueryConsole
                examples={examples}
                loading={loading}
                onAsk={ask}
                datasetName={schema?.table}
              />
              <HistoryPanel
                history={history}
                onPick={ask}
                onClear={() => setHistory([])}
              />
            </section>

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
                      <div className="font-semibold">Couldn't reach the API</div>
                      <div className="text-red-200/70">{error}</div>
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
                    <div className="flex flex-wrap items-center gap-2 text-xs text-white/55">
                      {eng && (
                        <span className={`flex items-center gap-1.5 rounded-full bg-white/[0.06] px-3 py-1.5 ${eng.color}`}>
                          <eng.Icon size={12} /> {eng.label}
                        </span>
                      )}
                      <span className="flex items-center gap-1.5 rounded-full bg-white/[0.06] px-3 py-1.5">
                        <Clock size={12} className="text-gold" />
                        {result.elapsed_ms} ms
                      </span>
                      <span className="flex items-center gap-1.5 rounded-full bg-white/[0.06] px-3 py-1.5">
                        <Rows3 size={12} className="text-sky-400" />
                        {fmt(result.row_count)} {result.row_count === 1 ? "row" : "rows"}
                      </span>
                    </div>

                    <SqlBlock sql={result.sql} onRun={runManual} running={running} />

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
                        <ResultChart
                          columns={result.columns}
                          rows={result.rows}
                          question={result.question}
                        />
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
          </>
        )}

        {/* Footer */}
        <footer className="mt-16 border-t border-white/10 pt-6 text-center text-xs text-white/35">
          AI SQL Assistant · FastAPI + React · fine-tuned Flan-T5 with a
          deterministic SQL safety net · runs 100% locally, no external APIs.
        </footer>
      </div>
    </>
  );
}
