import { useEffect, useRef, useState } from "react";
import { Check, Copy, Terminal, Pencil, Play, X, Loader2 } from "lucide-react";

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

export default function SqlBlock({ sql, onRun, running }) {
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(sql);
  const taRef = useRef(null);

  // Keep the draft in sync when a new query produces fresh SQL.
  useEffect(() => {
    setDraft(sql);
    setEditing(false);
  }, [sql]);

  useEffect(() => {
    if (editing && taRef.current) {
      taRef.current.focus();
      taRef.current.setSelectionRange(draft.length, draft.length);
    }
  }, [editing]); // eslint-disable-line react-hooks/exhaustive-deps

  const copy = async () => {
    await navigator.clipboard.writeText(editing ? draft : sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const run = () => {
    if (draft.trim() && onRun) onRun(draft.trim());
  };

  const dirty = draft.trim() !== sql.trim();

  return (
    <div className="glass overflow-hidden rounded-2xl">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
        <div className="flex items-center gap-2 text-xs font-medium text-white/60">
          <Terminal size={14} className="text-gold" />
          {editing ? "Edit SQL" : "Generated SQL"}
          {editing && dirty && (
            <span className="rounded-full bg-gold/15 px-2 py-0.5 text-[10px] text-gold">
              edited
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {onRun && !editing && (
            <button
              onClick={() => setEditing(true)}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs text-white/60 transition hover:bg-white/10 hover:text-white"
            >
              <Pencil size={13} /> Edit
            </button>
          )}
          {editing && (
            <>
              <button
                onClick={() => {
                  setDraft(sql);
                  setEditing(false);
                }}
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs text-white/50 transition hover:bg-white/10 hover:text-white"
              >
                <X size={13} /> Cancel
              </button>
              <button
                onClick={run}
                disabled={running || !draft.trim()}
                className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-gold to-amber-400 px-2.5 py-1 text-xs font-semibold text-black transition hover:brightness-110 disabled:opacity-40"
              >
                {running ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
                Run
              </button>
            </>
          )}
          <button
            onClick={copy}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs text-white/60 transition hover:bg-white/10 hover:text-white"
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>

      {editing ? (
        <textarea
          ref={taRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) run();
            if (e.key === "Escape") {
              setDraft(sql);
              setEditing(false);
            }
          }}
          spellCheck={false}
          rows={Math.min(10, Math.max(3, draft.split("\n").length + 1))}
          className="w-full resize-y bg-transparent p-4 font-mono text-sm leading-relaxed text-white outline-none"
        />
      ) : (
        <pre className="overflow-x-auto p-4 font-mono text-sm leading-relaxed">
          <code>
            {highlight(sql).map((p, i) => (
              <span key={i} className={p.c}>
                {p.t}
              </span>
            ))}
          </code>
        </pre>
      )}
    </div>
  );
}
