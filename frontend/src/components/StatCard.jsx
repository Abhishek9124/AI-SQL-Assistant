import { motion } from "framer-motion";

export default function StatCard({ icon: Icon, label, value, accent = "#f5c518", delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.5, delay }}
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
        {value}
      </div>
    </motion.div>
  );
}
