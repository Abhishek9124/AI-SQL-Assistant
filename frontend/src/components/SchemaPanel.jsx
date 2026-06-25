import { Table2, Hash, Tag, Type, Calendar, KeyRound } from "lucide-react";

const ROLE_META = {
  measure: { icon: Hash, color: "#0085c7", label: "numeric" },
  category: { icon: Tag, color: "#009f3d", label: "category" },
  text: { icon: Type, color: "#9b5de5", label: "text" },
  datetime: { icon: Calendar, color: "#ff8c42", label: "date" },
  id: { icon: KeyRound, color: "#f5c518", label: "id" },
};

export default function SchemaPanel({ schema }) {
  if (!schema) return null;
  return (
    <div className="glass rounded-2xl p-5">
      <div className="mb-4 flex items-center gap-2 text-sm font-medium text-white/70">
        <Table2 size={16} className="text-gold" />
        <span className="font-mono text-gold/90">{schema.table}</span>
        <span className="text-white/40">· {schema.columns.length} columns</span>
        <span className="ml-auto text-xs font-normal text-white/35">
          {schema.row_count?.toLocaleString()} rows
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {schema.columns.map((c) => {
          const meta = ROLE_META[c.role] || ROLE_META.text;
          const Icon = meta.icon;
          return (
            <div
              key={c.name}
              title={`${c.label} · ${c.type} · ${meta.label}${
                c.distinct != null ? ` · ${c.distinct} distinct` : ""
              }`}
              className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-xs"
            >
              <Icon size={12} style={{ color: meta.color }} />
              <span className="text-white/85">{c.label}</span>
              <span className="font-mono text-[10px] uppercase text-white/30">
                {meta.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
