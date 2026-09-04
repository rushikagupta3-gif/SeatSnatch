export default function AlertBanner({ alert }) {
  if (!alert) return null;

  return (
    <div className="rounded-2xl border p-5 space-y-4" style={{ borderColor: "#fecaca", background: "#fef2f2" }}>
      <div className="flex items-start gap-3">
        <span className="w-2 h-2 rounded-full bg-rose-500 mt-2 shrink-0" />
        <div>
          <p className="font-semibold text-rose-700">{alert.message}</p>
          <p className="text-xs text-rose-500 mt-0.5">The agent keeps monitoring automatically — no action needed.</p>
        </div>
      </div>

      {alert.offers?.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] uppercase tracking-wide font-semibold text-rose-500">
            Available now, over budget (not purchased)
          </p>
          {alert.offers.map((o) => (
            <div
              key={o.offerId}
              className="rounded-xl px-4 py-2.5 flex items-center justify-between text-sm bg-white border"
              style={{ borderColor: "#fecaca" }}
            >
              <div className="flex items-center gap-3">
                <span className="font-mono font-bold text-xs px-2 py-1 rounded-md bg-rose-50 text-rose-600">
                  {o.availabilityCode}
                </span>
                <span className="text-slate-500 text-xs">
                  {o.airline?.name} {o.flightNumber}
                </span>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <span className="text-slate-400">{o.seatsRemaining} seats</span>
                <span className="font-semibold text-rose-600">
                  {o.price.currency} {o.price.amount} (${o.expectedCost} incl. layover)
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
