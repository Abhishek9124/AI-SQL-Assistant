import { useMemo, useState } from "react";
import { ArrowUpDown, Download } from "lucide-react";

export default function ResultsTable({ columns, rows }) {
  const [sort, setSort] = useState({ col: null, dir: 1 });

  const sorted = useMemo(() => {
    if (sort.col === null) return rows;
    const idx = sort.col;
    return [...rows].sort((a, b) => {
      const x = a[idx];
      const y = b[idx];
      if (x === y) return 0;
      if (x === null) return 1;
      if (y === null) return -1;
      const num = typeof x === "number" && typeof y === "number";
      return (num ? x - y : String(x).localeCompare(String(y))) * sort.dir;
    });
  }, [rows, sort]);

  const toggleSort = (idx) =>
    setSort((s) => ({ col: idx, dir: s.col === idx ? -s.dir : 1 }));

  const downloadCsv = () => {
    const esc = (v) =>
      v === null ? "" : `"${String(v).replace(/"/g, '""')}"`;
    const csv = [
      columns.map(esc).join(","),
      ...rows.map((r) => r.map(esc).join(",")),
    ].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "olympics_result.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="glass overflow-hidden rounded-2xl">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
        <span className="text-xs font-medium text-white/60">
          {rows.length.toLocaleString()} {rows.length === 1 ? "row" : "rows"}
        </span>
        <button
          onClick={downloadCsv}
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs text-white/60 transition hover:bg-white/10 hover:text-white"
        >
          <Download size={13} /> CSV
        </button>
      </div>
      <div className="max-h-[460px] overflow-auto">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 bg-[#0d0d18]/95 backdrop-blur">
            <tr>
              {columns.map((c, i) => (
                <th
                  key={i}
                  onClick={() => toggleSort(i)}
                  className="cursor-pointer select-none whitespace-nowrap border-b border-white/10 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-white/70 transition hover:text-gold"
                >
                  <span className="inline-flex items-center gap-1">
                    {c}
                    <ArrowUpDown size={11} className="opacity-40" />
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, r) => (
              <tr
                key={r}
                className="transition hover:bg-white/[0.04]"
              >
                {row.map((cell, c) => (
                  <td
                    key={c}
                    className="whitespace-nowrap border-b border-white/5 px-4 py-2.5 text-white/85"
                  >
                    {cell === null ? (
                      <span className="text-white/25">—</span>
                    ) : typeof cell === "number" ? (
                      <span className="font-mono text-gold/90">
                        {cell.toLocaleString()}
                      </span>
                    ) : (
                      String(cell)
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
