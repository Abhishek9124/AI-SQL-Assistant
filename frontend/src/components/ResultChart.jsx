import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const COLORS = ["#f5c518", "#0085c7", "#009f3d", "#df0024", "#9b5de5", "#ff8c42"];

// Auto-detect a chartable shape: first text-ish column = label, first numeric = value.
export default function ResultChart({ columns, rows }) {
  if (!rows.length || rows.length > 30) return null;

  const labelIdx = columns.findIndex((_, i) =>
    rows.every((r) => typeof r[i] !== "number" || r[i] === null)
  );
  const valueIdx = columns.findIndex((_, i) =>
    rows.some((r) => typeof r[i] === "number")
  );
  if (labelIdx === -1 || valueIdx === -1 || labelIdx === valueIdx) return null;

  const data = rows
    .map((r) => ({
      name: String(r[labelIdx] ?? "—"),
      value: typeof r[valueIdx] === "number" ? r[valueIdx] : 0,
    }))
    .slice(0, 15);

  return (
    <div className="glass rounded-2xl p-4">
      <div className="mb-3 text-xs font-medium text-white/60">
        {columns[valueIdx]} by {columns[labelIdx]}
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 4, right: 8, left: -8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
          <XAxis
            dataKey="name"
            tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 11 }}
            interval={0}
            angle={-25}
            textAnchor="end"
            height={70}
          />
          <YAxis tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 11 }} />
          <Tooltip
            cursor={{ fill: "rgba(255,255,255,0.04)" }}
            contentStyle={{
              background: "#0d0d18",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 12,
              color: "#fff",
            }}
          />
          <Bar dataKey="value" radius={[6, 6, 0, 0]}>
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
