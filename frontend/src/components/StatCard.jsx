import { useEffect, useRef, useState } from "react";
import { animate, motion } from "framer-motion";

// Smoothly counts from the previous value up to the new one. Falls back to
// rendering the raw value verbatim for non-numeric stats (e.g. text labels).
function AnimatedValue({ value }) {
  const numeric =
    typeof value === "string" ? Number(value.replace(/,/g, "")) : Number(value);
  const isNumber = value !== "" && value != null && Number.isFinite(numeric);
  const [display, setDisplay] = useState(isNumber ? 0 : value);
  const prev = useRef(0);

  useEffect(() => {
    if (!isNumber) {
      setDisplay(value);
      return;
    }
    const controls = animate(prev.current, numeric, {
      duration: 0.9,
      ease: "easeOut",
      onUpdate: (v) => setDisplay(Math.round(v).toLocaleString()),
    });
    prev.current = numeric;
    return () => controls.stop();
  }, [value, numeric, isNumber]);

  return <>{display}</>;
}

export default function StatCard({ icon: Icon, label, value, accent = "#f5c518", delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      transition={{ type: "spring", stiffness: 260, damping: 22, delay }}
      className="glass group relative overflow-hidden rounded-2xl p-5 shadow-card transition-colors hover:border-white/20"
    >
      <div
        className="absolute -right-6 -top-6 h-20 w-20 rounded-full opacity-20 blur-2xl transition-opacity duration-300 group-hover:opacity-40"
        style={{ background: accent }}
      />
      <div className="flex items-center gap-3">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-xl"
          style={{ background: `${accent}22`, color: accent }}
        >
          <Icon size={20} />
        </div>
        <span className="text-xs font-medium uppercase tracking-wider text-white/50">
          {label}
        </span>
      </div>
      <div className="mt-3 font-mono text-2xl font-bold text-white md:text-3xl">
        <AnimatedValue value={value} />
      </div>
    </motion.div>
  );
}
