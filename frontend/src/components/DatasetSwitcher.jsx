import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Database, ChevronDown, Check, BrainCircuit } from "lucide-react";

export default function DatasetSwitcher({ datasets, activeId, onSelect }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const active = datasets.find((d) => d.id === activeId);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/70 transition hover:bg-white/10"
      >
        <Database size={13} className="text-gold" />
        <span className="max-w-[140px] truncate">{active?.name || "Dataset"}</span>
        <ChevronDown
          size={13}
          className={`transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="glass absolute right-0 z-20 mt-2 max-h-80 w-72 overflow-auto rounded-2xl p-1.5 shadow-card"
          >
            {datasets.map((d) => {
              const isActive = d.id === activeId;
              const trained = d.train_state === "done";
              return (
                <button
                  key={d.id}
                  onClick={() => {
                    onSelect(d.id);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left transition hover:bg-white/[0.06] ${
                    isActive ? "bg-white/[0.04]" : ""
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-sm text-white/85">{d.name}</span>
                      {trained && (
                        <BrainCircuit size={11} className="shrink-0 text-emerald-400" title="Fine-tuned" />
                      )}
                    </div>
                    <div className="font-mono text-[11px] text-white/35">
                      {d.row_count?.toLocaleString()} rows · {d.column_count} cols
                    </div>
                  </div>
                  {isActive && <Check size={14} className="shrink-0 text-gold" />}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
