const TYPE_STYLES = {
  info: "text-slate-500",
  escrow: "text-purple-600",
  evaluation: "text-sky-700",
  decision: "text-amber-700 font-medium",
  x402: "text-orange-700",
  settlement: "text-emerald-700 font-medium",
  ticket: "text-emerald-700 font-semibold",
  error: "text-red-600 font-medium",
  alert: "text-rose-700 font-medium",
};

const TYPE_LABEL = {
  info: "INFO",
  escrow: "ESCROW",
  evaluation: "EVAL",
  decision: "DECIDE",
  x402: "X402",
  settlement: "SETTLE",
  ticket: "TICKET",
  error: "ERROR",
  alert: "ALERT",
};

const TYPE_DOT = {
  info: "bg-slate-400",
  escrow: "bg-purple-500",
  evaluation: "bg-sky-500",
  decision: "bg-amber-500",
  x402: "bg-orange-500",
  settlement: "bg-emerald-500",
  ticket: "bg-emerald-500",
  error: "bg-red-500",
  alert: "bg-rose-500",
};

function fmtTime(t) {
  return new Date(t).toLocaleTimeString(undefined, { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

const STATUS_DOT_COLOR = {
  monitoring: "var(--sky-deep)",
  attempting: "#f59e0b",
  booked: "#10b981",
  cancelled: "#94a3b8",
};

export default function ReasoningPanel({ log, evaluations, title = "Live agent reasoning", status }) {
  const dotColor = STATUS_DOT_COLOR[status] || "var(--navy)";
  const pulsing = status === "monitoring" || status === "attempting" || !status;

  return (
    <div className="card p-6 flex flex-col h-full">
      <div className="flex items-center gap-2 mb-4">
        <span className="relative flex h-2 w-2">
          {pulsing && (
            <span
              className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60"
              style={{ background: dotColor }}
            />
          )}
          <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: dotColor }} />
        </span>
        <h2 className="text-base font-semibold" style={{ color: "var(--navy-deep)" }}>
          {title}
        </h2>
        {status && (
          <span className="ml-auto text-[11px] uppercase tracking-wide font-semibold text-slate-400">{status}</span>
        )}
      </div>

      {evaluations?.length > 0 && (
        <div className="mb-4 grid gap-2">
          {evaluations.map((e) => (
            <FareRow key={e.offerId} e={e} />
          ))}
        </div>
      )}

      <div className="flex-1 overflow-y-auto font-mono text-[13px] space-y-1.5 border-t pt-3" style={{ borderColor: "var(--line)" }}>
        {log.length === 0 && <p className="text-slate-400">Waiting for agent to start...</p>}
        {log.map((entry) => (
          <div key={entry.id} className="flex gap-2.5 items-baseline">
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${TYPE_DOT[entry.type] || "bg-slate-400"}`} />
            <span className="text-slate-400 shrink-0">{fmtTime(entry.t)}</span>
            <span className={`shrink-0 w-16 text-[11px] tracking-wide ${TYPE_STYLES[entry.type] || "text-slate-500"}`}>
              {TYPE_LABEL[entry.type] || entry.type}
            </span>
            <span className={TYPE_STYLES[entry.type] || "text-slate-700"}>{entry.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function FareRow({ e }) {
  const sellout =
    e.depletion?.projectedSelloutSeconds != null ? `sellout ~${Math.round(e.depletion.projectedSelloutSeconds)}s` : "stable";
  const isTargeted = e.viable;

  return (
    <div
      className={`rounded-xl px-4 py-3 flex items-center justify-between text-sm border transition ${
        isTargeted ? "border-emerald-300 bg-emerald-50" : "bg-slate-50"
      }`}
      style={!isTargeted ? { borderColor: "var(--line)" } : undefined}
    >
      <div className="flex items-center gap-3">
        <span
          className={`font-mono font-bold text-xs px-2 py-1 rounded-md ${
            isTargeted ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-500"
          }`}
        >
          {e.availabilityCode}
        </span>
        <span className="text-slate-400 text-xs">{e.flightNumber || e.offerId}</span>
        {e.price?.currency !== "USD" && (
          <span className="text-[10px] uppercase tracking-wide bg-purple-100 text-purple-700 rounded-md px-1.5 py-0.5 font-medium">
            {e.price.currency} → RLUSD
          </span>
        )}
      </div>
      <div className="flex items-center gap-4 text-xs">
        <span className="text-slate-500">{e.seatsRemaining} seats</span>
        <span className="text-slate-500">{sellout}</span>
        <span className={`font-semibold ${isTargeted ? "text-emerald-700" : "text-slate-500"}`}>${e.expectedCost}</span>
      </div>
    </div>
  );
}
