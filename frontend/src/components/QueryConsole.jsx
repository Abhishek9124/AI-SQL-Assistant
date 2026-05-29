import { useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, Send, Loader2 } from "lucide-react";

export default function QueryConsole({ examples, loading, onAsk }) {
  const [value, setValue] = useState("");

  const submit = () => {
    if (value.trim() && !loading) onAsk(value.trim());
  };

  return (
    <div className="glass rounded-3xl p-5 shadow-card md:p-6">
      <label className="mb-2 flex items-center gap-2 text-sm font-medium text-white/70">
        <Sparkles size={16} className="text-gold" />
        Ask about 120 years of Olympic history
      </label>

      <div className="relative">
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
          }}
          rows={3}
          placeholder="e.g. Which country won the most gold medals overall?"
          className="w-full resize-none rounded-2xl border border-white/10 bg-black/30 p-4 pr-32 text-[15px] text-white placeholder-white/30 outline-none transition focus:border-gold/50 focus:ring-2 focus:ring-gold/20"
        />
        <button
          onClick={submit}
          disabled={loading || !value.trim()}
          className="absolute bottom-3 right-3 flex items-center gap-2 rounded-xl bg-gradient-to-r from-gold to-amber-400 px-4 py-2.5 text-sm font-semibold text-black shadow-glow transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Send size={16} />
          )}
          {loading ? "Thinking" : "Ask AI"}
        </button>
      </div>

      <div className="mt-4">
        <div className="mb-2 text-xs uppercase tracking-wider text-white/40">
          Try an example
        </div>
        <div className="flex flex-wrap gap-2">
          {examples.map((ex, i) => (
            <motion.button
              key={ex}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.03 }}
              onClick={() => {
                setValue(ex);
                onAsk(ex);
              }}
              disabled={loading}
              className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-white/70 transition hover:border-gold/40 hover:bg-gold/10 hover:text-white disabled:opacity-40"
            >
              {ex}
            </motion.button>
          ))}
        </div>
      </div>

      <div className="mt-3 text-right text-[11px] text-white/30">
        Press ⌘/Ctrl + Enter to run
      </div>
    </div>
  );
}
