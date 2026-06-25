import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BarChart2, LineChart as LineIcon, PieChart as PieIcon, Sparkles } from "lucide-react";

const COLORS = ["#f5c518", "#0085c7", "#009f3d", "#df0024", "#9b5de5", "#ff8c42", "#f77f00", "#00b4d8"];

const TOOLTIP_STYLE = {
  background: "#0d0d18",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 12,
  color: "#fff",
  fontSize: 12,
};

const CHART_TYPES = [
  { id: "bar", label: "Bar", Icon: BarChart2 },
  { id: "line", label: "Line", Icon: LineIcon },
  { id: "pie", label: "Pie", Icon: PieIcon },
];

function detectAxes(columns, rows) {
  // First non-numeric column → label axis
  const labelIdx = columns.findIndex((_, i) =>
    rows.every((r) => r[i] === null || typeof r[i] !== "number")
  );
  // All numeric columns after label → value axes (up to 3)
  const valueIdxs = columns
    .map((_, i) => i)
    .filter((i) => i !== labelIdx && rows.some((r) => typeof r[i] === "number"))
    .slice(0, 3);

  return { labelIdx, valueIdxs };
}

const TIME_RE =
  /\b(over time|trend|trends|timeline|growth|year|years|yearly|month|monthly|date|dates|day|daily|week|weekly|season|decade|history|historical|progress|change|evolution)\b/i;
const SHARE_RE =
  /\b(share|shares|proportion|proportions|percentage|percent|distribution|breakdown|split|ratio|composition|make ?up|portion)\b/i;
const RANK_RE =
  /\b(top|bottom|most|least|highest|lowest|rank|ranking|compare|comparison|versus|vs|biggest|largest|smallest|by)\b/i;

const LABEL_LOOKS_TEMPORAL = (label = "") =>
  /\b(year|month|date|day|week|season|time|quarter|decade)\b/i.test(label);

// Choose a chart type from the question's intent + the shape of the data.
// The question drives it; the data shape breaks ties.
function suggestChartType(question = "", labelName = "", labelCount = 0, nSeries = 1) {
  const q = question || "";

  // Trend / time → line (also if the label column is itself temporal)
  if (TIME_RE.test(q) || LABEL_LOOKS_TEMPORAL(labelName)) return "line";

  // Share / proportion → pie, but only when it's a single series with a
  // readable number of slices (pie is useless with many categories).
  if (SHARE_RE.test(q) && nSeries === 1 && labelCount >= 2 && labelCount <= 8) {
    return "pie";
  }

  // Ranking / comparison, or anything else → bar
  if (RANK_RE.test(q)) return "bar";
  return "bar";
}

function fmt(v) {
  if (v === null || v === undefined) return "—";
  if (typeof v === "number") {
    if (Math.abs(v) >= 1_000_000) return (v / 1_000_000).toFixed(1) + "M";
    if (Math.abs(v) >= 1_000) return (v / 1_000).toFixed(1) + "K";
    return v.toLocaleString();
  }
  return String(v);
}

export default function ResultChart({ columns, rows, question }) {
  const { labelIdx, valueIdxs } = useMemo(() => detectAxes(columns, rows), [columns, rows]);

  // Recommend a chart type from the question + data shape.
  const suggested = useMemo(() => {
    if (labelIdx === -1 || !valueIdxs.length) return "bar";
    return suggestChartType(question, columns[labelIdx], rows.length, valueIdxs.length);
  }, [question, columns, rows.length, labelIdx, valueIdxs.length]);

  const [chartType, setChartType] = useState(suggested);
  // When a new question/result comes in, follow the fresh recommendation
  // (until the user manually picks a different type for this result).
  const [userPicked, setUserPicked] = useState(false);
  useEffect(() => {
    setUserPicked(false);
    setChartType(suggested);
  }, [suggested, question]);

  const pick = (id) => {
    setUserPicked(true);
    setChartType(id);
  };

  if (!rows.length) return null;
  if (labelIdx === -1 || !valueIdxs.length) return null;

  // For pie, only single numeric makes sense; cap at 10 slices
  const MAX_PIE = 10;
  const MAX_BAR_LINE = 50;

  const data = rows
    .slice(0, chartType === "pie" ? MAX_PIE : MAX_BAR_LINE)
    .map((r) => {
      const point = { name: String(r[labelIdx] ?? "—") };
      valueIdxs.forEach((vi) => {
        point[columns[vi]] = typeof r[vi] === "number" ? r[vi] : 0;
      });
      return point;
    });

  const primaryKey = columns[valueIdxs[0]];
  const showLegend = valueIdxs.length > 1;

  const axisProps = {
    tick: { fill: "rgba(255,255,255,0.45)", fontSize: 11 },
  };

  return (
    <div className="glass rounded-2xl p-4">
      {/* header row */}
      <div className="mb-3 flex items-center justify-between">
        <div className="text-xs font-medium text-white/60">
          {valueIdxs.map((vi) => columns[vi]).join(", ")} by {columns[labelIdx]}
        </div>
        <div className="flex items-center gap-1">
          {!userPicked && (
            <span
              title="Chart picked automatically from your question"
              className="mr-1 flex items-center gap-1 rounded-full bg-gold/10 px-2 py-0.5 text-[10px] text-gold/90"
            >
              <Sparkles size={10} /> auto
            </span>
          )}
          {CHART_TYPES.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => pick(id)}
              title={id === suggested ? `${label} · suggested for this question` : label}
              className={`relative flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] transition ${
                chartType === id
                  ? "bg-gold/20 text-gold"
                  : "text-white/40 hover:bg-white/10 hover:text-white/70"
              }`}
            >
              <Icon size={13} />
              {label}
              {id === suggested && (
                <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-gold" />
              )}
            </button>
          ))}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={280}>
        {chartType === "bar" ? (
          <BarChart data={data} margin={{ top: 4, right: 8, left: -8, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis
              dataKey="name"
              {...axisProps}
              interval={0}
              angle={data.length > 8 ? -30 : 0}
              textAnchor={data.length > 8 ? "end" : "middle"}
              height={data.length > 8 ? 60 : 30}
            />
            <YAxis {...axisProps} tickFormatter={fmt} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => fmt(v)} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
            {showLegend && <Legend wrapperStyle={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }} />}
            {valueIdxs.map((vi, si) => (
              <Bar key={vi} dataKey={columns[vi]} radius={[4, 4, 0, 0]} fill={COLORS[si % COLORS.length]}>
                {!showLegend &&
                  data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            ))}
          </BarChart>
        ) : chartType === "line" ? (
          <LineChart data={data} margin={{ top: 4, right: 8, left: -8, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis
              dataKey="name"
              {...axisProps}
              interval={0}
              angle={data.length > 8 ? -30 : 0}
              textAnchor={data.length > 8 ? "end" : "middle"}
              height={data.length > 8 ? 60 : 30}
            />
            <YAxis {...axisProps} tickFormatter={fmt} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => fmt(v)} />
            {showLegend && <Legend wrapperStyle={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }} />}
            {valueIdxs.map((vi, si) => (
              <Line
                key={vi}
                type="monotone"
                dataKey={columns[vi]}
                stroke={COLORS[si % COLORS.length]}
                strokeWidth={2}
                dot={{ r: 3, fill: COLORS[si % COLORS.length] }}
                activeDot={{ r: 5 }}
              />
            ))}
          </LineChart>
        ) : (
          <PieChart>
            <Pie
              data={data}
              dataKey={primaryKey}
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={100}
              label={({ name, percent }) =>
                percent > 0.04 ? `${name} (${(percent * 100).toFixed(0)}%)` : ""
              }
              labelLine={{ stroke: "rgba(255,255,255,0.25)" }}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => fmt(v)} />
            <Legend wrapperStyle={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }} />
          </PieChart>
        )}
      </ResponsiveContainer>

      {rows.length > (chartType === "pie" ? MAX_PIE : MAX_BAR_LINE) && (
        <div className="mt-2 text-center text-[11px] text-white/30">
          Showing first {chartType === "pie" ? MAX_PIE : MAX_BAR_LINE} of {rows.length} rows
        </div>
      )}
    </div>
  );
}
