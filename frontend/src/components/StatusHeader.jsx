const STATUS_LABEL = {
  initializing: "Initializing",
  monitoring: "Monitoring fares",
  attempting: "Attempting booking",
  booked: "Booked",
  failed: "Failed",
  cancelled: "Cancelled",
};

const STATUS_DOT = {
  initializing: "bg-slate-400",
  monitoring: "bg-sky-500",
  attempting: "bg-amber-500 animate-pulse",
  booked: "bg-emerald-500",
  failed: "bg-red-500",
  cancelled: "bg-slate-400",
};

export default function StatusHeader({ session }) {
  if (!session) return null;
  return (
    <div className="card px-5 py-4 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
      <div className="flex items-center gap-2 pr-5 border-r" style={{ borderColor: "var(--line)" }}>
        <span className={`w-2 h-2 rounded-full ${STATUS_DOT[session.status] || "bg-slate-400"}`} />
        <span className="font-semibold" style={{ color: "var(--navy-deep)" }}>
          {STATUS_LABEL[session.status] || session.status}
        </span>
      </div>

      <div className="flex items-center gap-2 font-mono" style={{ color: "var(--navy)" }}>
        <span className="font-semibold">{session.objective.origin}</span>
        <span className="text-slate-400">{session.objective.tripType === "round-trip" ? "⇄" : "→"}</span>
        <span className="font-semibold">{session.objective.destination}</span>
        <span className="text-slate-400 mx-1">·</span>
        <span className="text-slate-500">
          {session.objective.tripType === "round-trip" ? (
            <>
              spent ${session.combinedSpentUSD.toFixed(0)} / ${session.objective.maxPrice} combined
            </>
          ) : (
            <>max ${session.objective.maxPrice}</>
          )}
        </span>
        {session.objective.cabinClass !== "economy" && (
          <span className="pill capitalize" style={{ background: "rgba(168,92,50,0.1)", color: "var(--chestnut)" }}>
            {session.objective.cabinClass}
          </span>
        )}
      </div>

      {session.escrow && (
        <a
          href={session.escrow.explorerUrl}
          target="_blank"
          rel="noreferrer"
          className="pill border transition hover:brightness-95 ml-auto"
          style={{ background: "rgba(50,96,128,0.08)", color: "var(--navy)", borderColor: "var(--line)" }}
        >
          Budget locked on XRPL ↗
        </a>
      )}
    </div>
  );
}
