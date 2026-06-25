import { motion } from "framer-motion";
import {
  BrainCircuit,
  Cpu,
  Zap,
  CheckCircle2,
  AlertTriangle,
  Loader2,
} from "lucide-react";

const fmtLoss = (l) => (typeof l === "number" ? l.toFixed(4) : "—");

export default function TrainPanel({ status, onTrain, mlAvailable }) {
  const state = status?.state || "none";
  const running = state === "pending" || state === "running";
  const pct = Math.round((status?.progress || 0) * 100);
  const onGpu = status?.device === "cuda";

  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-center gap-2 text-sm font-medium text-white/70">
        <BrainCircuit size={16} className="text-gold" />
        Model training
        {state === "done" && (
          <span className="ml-auto flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs text-emerald-300">
            <CheckCircle2 size={12} /> Trained
          </span>
        )}
        {(state === "unavailable" || state === "failed") && (
          <span className="ml-auto flex items-center gap-1.5 rounded-full bg-amber-500/15 px-2.5 py-1 text-xs text-amber-300">
            <AlertTriangle size={12} /> Deterministic engine
          </span>
        )}
      </div>

      {/* idle: invite training */}
      {(state === "none" || !status) && (
        <div className="mt-3">
          <p className="text-sm text-white/55">
            Fine-tune a small language model on this dataset's schema for smarter
            SQL. You can also start asking right away — a deterministic engine
            answers without training.
          </p>
          <button
            onClick={onTrain}
            className="mt-4 flex items-center gap-2 rounded-xl bg-gradient-to-r from-gold to-amber-400 px-4 py-2.5 text-sm font-semibold text-black shadow-glow transition hover:brightness-110"
          >
            <Zap size={16} /> Train model on this CSV
          </button>
          {!mlAvailable && (
            <p className="mt-2 text-xs text-amber-300/70">
              Note: PyTorch isn't installed, so training will use the
              deterministic engine instead.
            </p>
          )}
        </div>
      )}

      {/* running: progress */}
      {running && (
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between text-xs text-white/55">
            <span className="flex items-center gap-1.5">
              <Loader2 size={13} className="animate-spin text-gold" />
              {status?.message || "Training…"}
            </span>
            <span className="flex items-center gap-1.5">
              {onGpu ? <Zap size={12} className="text-emerald-400" /> : <Cpu size={12} />}
              {onGpu ? "GPU" : "CPU"}
            </span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
            <motion.div
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.4 }}
              className="h-full rounded-full bg-gradient-to-r from-gold to-amber-400"
            />
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-white/45">
            <span>epoch {status?.epoch || 0}/{status?.total_epochs || "?"}</span>
            <span>step {status?.step || 0}/{status?.total_steps || "?"}</span>
            <span>loss {fmtLoss(status?.loss)}</span>
            <span>{pct}%</span>
          </div>
        </div>
      )}

      {/* done */}
      {state === "done" && (
        <p className="mt-3 text-sm text-white/55">
          {status?.message}{" "}
          <span className="text-white/40">
            Queries now use the fine-tuned model, with the deterministic engine
            as a safety net.
          </span>
        </p>
      )}

      {/* failed / unavailable */}
      {(state === "unavailable" || state === "failed") && (
        <p className="mt-3 text-sm text-amber-200/70">{status?.message}</p>
      )}
    </div>
  );
}
