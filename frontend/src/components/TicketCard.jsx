import { PlaneIcon } from "./icons.jsx";

export default function TicketCard({ ticket, legLabel, refund }) {
  if (!ticket) return null;
  const explorer = `https://testnet.xrpl.org/transactions/${ticket.settlementTxHash}`;

  return (
    <div className="card overflow-hidden shadow-2xl shadow-emerald-950/40">
      <div
        className="relative px-6 pt-6 pb-8 text-white"
        style={{ background: "linear-gradient(135deg, #059669, #047857 60%, #064e3b)" }}
      >
        <PlaneIcon className="absolute -right-3 -top-3 w-28 h-28 text-white/10 rotate-45" />
        <div className="flex items-center justify-between">
          <div className="pill bg-white/15 text-white">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-300" />
            {legLabel ? `${legLabel} confirmed` : "Confirmed"}
          </div>
          <PlaneIcon className="w-6 h-6 text-white/80 rotate-45" />
        </div>
        <div className="mt-4 flex items-end justify-between">
          <div>
            <p className="text-xs text-white/70 uppercase tracking-wide">{ticket.offer.origin}</p>
            <p className="text-3xl font-bold leading-none mt-1">{ticket.offer.origin}</p>
          </div>
          <div className="flex-1 flex flex-col items-center px-3">
            <PlaneIcon className="w-4 h-4 text-white/70 rotate-45 mb-1" />
            <div className="w-full border-t border-dashed border-white/40" />
          </div>
          <div className="text-right">
            <p className="text-xs text-white/70 uppercase tracking-wide">{ticket.offer.destination}</p>
            <p className="text-3xl font-bold leading-none mt-1">{ticket.offer.destination}</p>
          </div>
        </div>
      </div>

      {/* perforated stub divider */}
      <div className="relative h-0">
        <div className="absolute -left-3 -top-3 w-6 h-6 rounded-full" style={{ background: "var(--cream)" }} />
        <div className="absolute -right-3 -top-3 w-6 h-6 rounded-full" style={{ background: "var(--cream)" }} />
        <div className="absolute left-3 right-3 -top-px border-t border-dashed" style={{ borderColor: "var(--line)" }} />
      </div>

      <div className="p-6 pt-7 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-slate-500 uppercase tracking-wide shrink-0">Confirmation code</span>
          <span className="font-mono text-lg font-bold tracking-wide" style={{ color: "var(--chestnut)" }}>
            {ticket.confirmationCode}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-y-3 text-sm">
          <TicketField label="Date" value={ticket.offer.departDate} />
          <TicketField label="Fare" value={`${ticket.offer.price.currency} ${ticket.offer.price.amount}`} align="right" />
          <TicketField label="Flight" value={`${ticket.offer.airline?.name ?? ""} ${ticket.offer.flightNumber ?? ""}`} />
          <TicketField label="Settled" value={`$${ticket.settledAmountUSD ?? ticket.offer.price.amount}`} align="right" />
        </div>

        <a
          href={explorer}
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-center gap-2 border text-sm font-medium rounded-xl py-2.5 transition hover:brightness-95"
          style={{ background: "rgba(5,150,105,0.08)", borderColor: "rgba(5,150,105,0.3)", color: "#047857" }}
        >
          View settlement on XRPL Testnet explorer ↗
        </a>

        {refund && (
          <div className="rounded-xl border p-3 space-y-1.5" style={{ borderColor: "rgba(168,92,50,0.3)", background: "rgba(168,92,50,0.06)" }}>
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--chestnut)" }}>
              Price-drop refund
            </p>
            <p className="text-sm" style={{ color: "var(--navy-deep)" }}>
              The fare dropped after booking — the agent automatically refunded{" "}
              <span className="font-semibold">${refund.amountUSD}</span> back to your wallet.
            </p>
            <a
              href={refund.explorerUrl}
              target="_blank"
              rel="noreferrer"
              className="text-xs underline decoration-dotted"
              style={{ color: "var(--chestnut)" }}
            >
              View refund transaction ↗
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

function TicketField({ label, value, align = "left" }) {
  return (
    <div className={align === "right" ? "text-right" : ""}>
      <p className="text-[11px] text-slate-500 uppercase tracking-wide">{label}</p>
      <p className="font-medium" style={{ color: "var(--navy-deep)" }}>
        {value}
      </p>
    </div>
  );
}
