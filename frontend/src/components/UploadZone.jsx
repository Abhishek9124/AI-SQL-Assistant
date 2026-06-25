import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { UploadCloud, FileSpreadsheet, Loader2, Sparkles } from "lucide-react";

export default function UploadZone({ onFile, onSample, busy, sampleAvailable, maxMb = 25 }) {
  const inputRef = useRef(null);
  const [drag, setDrag] = useState(false);

  const pick = (file) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv")) {
      alert("Please choose a .csv file.");
      return;
    }
    if (file.size > maxMb * 1024 * 1024) {
      alert(
        `That file is ${(file.size / 1024 / 1024).toFixed(1)} MB — the limit is ${maxMb} MB. ` +
          `Please upload a smaller CSV (or a sample of your data).`
      );
      return;
    }
    onFile(file);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto max-w-2xl"
    >
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          pick(e.dataTransfer.files?.[0]);
        }}
        onClick={() => !busy && inputRef.current?.click()}
        className={`glass relative cursor-pointer rounded-3xl border-2 border-dashed p-12 text-center transition ${
          drag ? "border-gold/70 bg-gold/[0.06]" : "border-white/15 hover:border-white/30"
        } ${busy ? "pointer-events-none opacity-70" : ""}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => pick(e.target.files?.[0])}
        />
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-gold to-amber-500 text-black shadow-glow">
          {busy ? <Loader2 size={30} className="animate-spin" /> : <UploadCloud size={30} />}
        </div>
        <div className="text-lg font-semibold">
          {busy ? "Analyzing your data…" : "Drop a CSV here, or click to browse"}
        </div>
        <div className="mt-2 text-sm text-white/50">
          Any tabular CSV — the schema is detected automatically.
        </div>
        <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/55">
          <FileSpreadsheet size={13} className="text-gold" /> .csv · up to {maxMb} MB
        </div>
      </div>

      {sampleAvailable && (
        <div className="mt-4 text-center text-sm text-white/45">
          No file handy?{" "}
          <button
            onClick={onSample}
            disabled={busy}
            className="inline-flex items-center gap-1.5 font-medium text-gold transition hover:text-amber-300 disabled:opacity-40"
          >
            <Sparkles size={14} /> Try the bundled sample dataset
          </button>
        </div>
      )}
    </motion.div>
  );
}
