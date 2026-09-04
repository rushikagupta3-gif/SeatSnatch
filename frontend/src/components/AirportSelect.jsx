import { useEffect, useRef, useState } from "react";
import { AIRPORTS, POPULAR_CODES } from "../data/airports.js";

const BY_CODE = new Map(AIRPORTS.map((a) => [a.code, a]));
const POPULAR = POPULAR_CODES.map((c) => BY_CODE.get(c)).filter(Boolean);

export default function AirportSelect({ label, value, onChange }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef(null);

  const selected = BY_CODE.get(value);

  useEffect(() => {
    function onClickOutside(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const q = query.trim().toLowerCase();
  const results = q
    ? AIRPORTS.filter(
        (a) =>
          a.code.toLowerCase().includes(q) ||
          a.city.toLowerCase().includes(q) ||
          a.name.toLowerCase().includes(q) ||
          a.country.toLowerCase().includes(q)
      ).slice(0, 8)
    : POPULAR;

  function pick(airport) {
    onChange(airport.code);
    setQuery("");
    setOpen(false);
  }

  function handleKeyDown(e) {
    if (!open && (e.key === "ArrowDown" || e.key === "Enter")) {
      setOpen(true);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (results[highlight]) pick(results[highlight]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="relative" ref={rootRef}>
      <span className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold mb-1.5 block">{label}</span>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="input flex items-center justify-between text-left cursor-pointer"
      >
        <span>
          <span className="font-mono font-semibold tracking-widest" style={{ color: "var(--navy-deep)" }}>
            {selected?.code || "—"}
          </span>
          {selected && <span className="text-slate-400 text-xs ml-2">{selected.city}</span>}
        </span>
        <svg viewBox="0 0 20 20" className="w-4 h-4 text-slate-400 shrink-0" fill="currentColor">
          <path d="M5.5 7.5 10 12l4.5-4.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        </svg>
      </button>

      {open && (
        <div
          className="absolute z-20 mt-1.5 w-72 max-w-[80vw] bg-white rounded-xl shadow-xl border overflow-hidden"
          style={{ borderColor: "var(--line)" }}
        >
          <div className="p-2 border-b" style={{ borderColor: "var(--line)" }}>
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setHighlight(0);
              }}
              onKeyDown={handleKeyDown}
              placeholder="Search 8,800+ airports worldwide..."
              className="w-full text-sm px-2.5 py-1.5 rounded-lg outline-none bg-slate-50"
              style={{ color: "var(--ink)" }}
            />
          </div>
          {!q && (
            <p className="px-3 pt-2 text-[10px] uppercase tracking-wide text-slate-400 font-semibold">Popular</p>
          )}
          <ul className="max-h-64 overflow-y-auto py-1">
            {results.length === 0 && <li className="px-3 py-2 text-sm text-slate-400">No airports found</li>}
            {results.map((a, i) => (
              <li key={a.code}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(a)}
                  onMouseEnter={() => setHighlight(i)}
                  className={`w-full text-left px-3 py-2 flex items-center justify-between text-sm transition ${
                    i === highlight ? "bg-slate-100" : ""
                  } ${a.code === value ? "font-semibold" : ""}`}
                  style={a.code === value ? { color: "var(--navy)" } : { color: "var(--ink)" }}
                >
                  <span>
                    <span className="font-mono font-semibold text-xs mr-2" style={{ color: "var(--navy)" }}>
                      {a.code}
                    </span>
                    {a.city}
                    <span className="text-slate-400"> · {a.country}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
