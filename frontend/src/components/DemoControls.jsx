const OFFER_IDS = ["offer_A", "offer_B", "offer_C"];

export default function DemoControls({ bookedOfferIds = [] }) {
  async function deplete(offerId) {
    await fetch(`/api/inventory/demo/deplete/${offerId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ by: 1 }),
    });
  }

  async function reset() {
    await fetch(`/api/inventory/demo/reset`, { method: "POST" });
  }

  async function dropPrice(offerId) {
    const res = await fetch(`/api/inventory/search`);
    const { offers } = await res.json();
    const offer = offers.find((o) => o.id === offerId);
    if (!offer) return;
    const newAmount = Math.max(1, Math.round(offer.price.amount * 0.85));
    await fetch(`/api/inventory/demo/price-drop/${offerId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: newAmount }),
    });
  }

  return (
    <div className="card px-5 py-3.5 flex flex-wrap items-center gap-2.5 text-sm">
      <span className="text-slate-500 text-xs uppercase tracking-wide font-semibold mr-1">Demo controls</span>
      {OFFER_IDS.map((id) => (
        <button
          key={id}
          onClick={() => deplete(id)}
          className="bg-white hover:bg-slate-50 rounded-lg px-3 py-1.5 text-xs font-medium transition border"
          style={{ borderColor: "var(--line)", color: "var(--navy-deep)" }}
        >
          Deplete {id}
        </button>
      ))}
      {bookedOfferIds.map((id) => (
        <button
          key={`drop-${id}`}
          onClick={() => dropPrice(id)}
          className="rounded-lg px-3 py-1.5 text-xs font-medium transition border"
          style={{ borderColor: "rgba(168,92,50,0.35)", color: "var(--chestnut)", background: "rgba(168,92,50,0.06)" }}
        >
          Simulate price drop on {id}
        </button>
      ))}
      <button
        onClick={reset}
        className="bg-white hover:bg-red-50 hover:text-red-600 hover:border-red-200 rounded-lg px-3 py-1.5 text-xs font-medium transition border ml-auto"
        style={{ borderColor: "var(--line)", color: "var(--navy)" }}
      >
        Reset inventory
      </button>
    </div>
  );
}
