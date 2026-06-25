import { AnimatePresence, motion } from "framer-motion";
import { History, RotateCcw, Trash2, CornerDownLeft } from "lucide-react";

const ENGINE_DOT = {
  "fine-tuned": "bg-emerald-400",
  deterministic: "bg-sky-400",
  manual: "bg-gold",
};

export default function HistoryPanel({ history, onPick, onClear }) {
  if (!history?.length) return null;

  return (
    <div className="glass rounded-2xl p-5">
      <div className="mb-3 flex items-center gap-2 text-sm font-medium text-white/70">
        <History size={16} className="text-gold" />
        Recent questions
        <span className="text-white/35">· {history.length}</span>
        <button
          onClick={onClear}
          className="ml-auto flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-white/45 transition hover:bg-white/10 hover:text-white"
        >
          <Trash2 size={12} /> Clear
        </button>
      </div>

      <div className="flex flex-col gap-1.5">
        <AnimatePresence initial={false}>
          {history.map((h) => (
            <motion.button
              key={h.id}
              layout
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0 }}
              onClick={() => onPick(h.question)}
              className="group flex items-center gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-left text-sm text-white/75 transition hover:border-gold/30 hover:bg-white/[0.05] hover:text-white"
            >
              <span
                className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                  ENGINE_DOT[h.engine] || "bg-white/40"
                }`}
                title={h.engine}
              />
              <span className="flex-1 truncate">{h.question}</span>
              {h.rowCount != null && (
                <span className="shrink-0 font-mono text-[11px] text-white/35">
                  {h.rowCount.toLocaleString()} rows
                </span>
              )}
              <RotateCcw
                size={13}
                className="shrink-0 text-white/0 transition group-hover:text-gold"
              />
            </motion.button>
          ))}
        </AnimatePresence>
      </div>

      <div className="mt-2.5 flex items-center gap-1 text-[11px] text-white/30">
        <CornerDownLeft size={11} /> Click any question to run it again
      </div>
    </div>
  );
}
