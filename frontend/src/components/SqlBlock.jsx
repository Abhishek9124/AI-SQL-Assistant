import { useState } from "react";
import { Check, Copy, Terminal } from "lucide-react";

const KEYWORDS =
  /\b(SELECT|FROM|WHERE|GROUP BY|ORDER BY|LIMIT|COUNT|DISTINCT|AND|OR|AS|DESC|ASC|SUM|AVG|MIN|MAX|ROUND|CASE|WHEN|THEN|ELSE|END|IS|NOT|NULL|LIKE|IN|JOIN|ON|HAVING)\b/gi;

// Lightweight SQL highlighter — no external dependency.
function highlight(sql) {
  const parts = [];
  let lastIndex = 0;
  let match;
  const tokenRe = new RegExp(
    `${KEYWORDS.source}|'[^']*'|\\b\\d+(?:\\.\\d+)?\\b`,
    "gi"
  );
  while ((match = tokenRe.exec(sql)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ t: sql.slice(lastIndex, match.index), c: "text-white/80" });
    }
    const tok = match[0];
    let cls = "text-white/80";
    if (/^'/.test(tok)) cls = "text-emerald-300";
    else if (/^\d/.test(tok)) cls = "text-orange-300";
    else cls = "text-sky-300 font-semibold";
    parts.push({ t: tok, c: cls });
    lastIndex = tokenRe.lastIndex;
  }
  if (lastIndex < sql.length) parts.push({ t: sql.slice(lastIndex), c: "text-white/80" });
  return parts;
}

export default function SqlBlock({ sql }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="glass overflow-hidden rounded-2xl">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
        <div className="flex items-center gap-2 text-xs font-medium text-white/60">
          <Terminal size={14} className="text-gold" />
          Generated SQL
        </div>
        <button
          onClick={copy}
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs text-white/60 transition hover:bg-white/10 hover:text-white"
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-sm leading-relaxed">
        <code>
          {highlight(sql).map((p, i) => (
            <span key={i} className={p.c}>
              {p.t}
            </span>
          ))}
        </code>
      </pre>
    </div>
  );
}
