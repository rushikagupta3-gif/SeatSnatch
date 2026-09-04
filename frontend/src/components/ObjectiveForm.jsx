import { useEffect, useState } from "react";
import { PlaneIcon } from "./icons.jsx";
import AirportSelect from "./AirportSelect.jsx";
import { getAirlines } from "../api.js";

const todayISO = () => {
  const d = new Date();
  const tzOffsetMs = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tzOffsetMs).toISOString().slice(0, 10);
};

const RETURN_WINDOWS = [
  { id: "any", label: "Any time" },
  { id: "morning", label: "Morning" },
  { id: "afternoon", label: "Afternoon" },
  { id: "evening", label: "Evening" },
];

export default function ObjectiveForm({ onSubmit, submitting }) {
  const [form, setForm] = useState({
    origin: "SFO",
    destination: "LHR",
    departDate: "2026-11-14",
    tripType: "one-way",
    returnDate: "2026-11-21",
    returnTimeWindow: "any",
    maxPrice: 600,
    hourlyLayoverCost: 8,
    riskDollarValue: 60,
    cabinClass: "economy",
    preferredAirlines: [],
    notes: "",
  });
  const [airlines, setAirlines] = useState([]);
  const [cabinClasses, setCabinClasses] = useState([]);

  useEffect(() => {
    getAirlines()
      .then((d) => {
        setAirlines(d.airlines);
        setCabinClasses(d.cabinClasses);
      })
      .catch(() => {});
  }, []);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function toggleAirline(code) {
    setForm((f) => ({
      ...f,
      preferredAirlines: f.preferredAirlines.includes(code)
        ? f.preferredAirlines.filter((c) => c !== code)
        : [...f.preferredAirlines, code],
    }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    onSubmit(form);
  }

  const isRoundTrip = form.tripType === "round-trip";

  return (
    <div className="card overflow-hidden">
      <div
        className="relative px-8 pt-8 pb-10 overflow-hidden"
        style={{ background: "linear-gradient(135deg, var(--sky) 0%, var(--sky-deep) 55%, var(--navy) 100%)" }}
      >
        <PlaneIcon className="absolute -right-4 top-8 w-40 h-40 text-white/20 rotate-45" />
        <PlaneIcon className="absolute left-10 bottom-2 w-16 h-16 text-white/20 -rotate-12" />
        <p className="text-white/80 text-xs font-semibold tracking-[0.2em] uppercase mb-2">Autonomous booking</p>
        <h2 className="text-white text-2xl font-bold drop-shadow-sm">Set your flight objective</h2>
        <p className="text-white/90 text-sm mt-1.5 max-w-sm drop-shadow-sm">
          Tell the agent what you want once — it monitors fares and books the moment its conditions are met.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="p-8 pt-6 space-y-5 -mt-4">
        {/* Trip type */}
        <div className="grid grid-cols-2 gap-2 bg-slate-100 rounded-xl p-1">
          {["one-way", "round-trip"].map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => update("tripType", t)}
              className={`py-2 rounded-lg text-sm font-semibold capitalize transition ${
                form.tripType === t ? "bg-white shadow" : "text-slate-500"
              }`}
              style={form.tripType === t ? { color: "var(--navy-deep)" } : undefined}
            >
              {t.replace("-", " ")}
            </button>
          ))}
        </div>

        <div
          className="grid grid-cols-2 gap-4 bg-white rounded-xl p-4 shadow-lg border"
          style={{ borderColor: "var(--line)" }}
        >
          <AirportSelect label="From" value={form.origin} onChange={(code) => update("origin", code)} />
          <AirportSelect label="To" value={form.destination} onChange={(code) => update("destination", code)} />
        </div>

        <div className={isRoundTrip ? "grid grid-cols-2 gap-4" : ""}>
          <Field label="Depart date">
            <input
              type="date"
              className="input"
              min={todayISO()}
              value={form.departDate}
              onChange={(e) => {
                const value = e.target.value;
                update("departDate", value);
                if (form.returnDate && form.returnDate < value) update("returnDate", value);
              }}
            />
          </Field>
          {isRoundTrip && (
            <Field label="Return date">
              <input
                type="date"
                className="input"
                min={form.departDate || todayISO()}
                value={form.returnDate}
                onChange={(e) => update("returnDate", e.target.value)}
              />
            </Field>
          )}
        </div>

        {isRoundTrip && (
          <Field label="Preferred return time">
            <div className="grid grid-cols-4 gap-2">
              {RETURN_WINDOWS.map((w) => (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => update("returnTimeWindow", w.id)}
                  className={`py-1.5 rounded-lg text-xs font-medium border transition ${
                    form.returnTimeWindow === w.id ? "text-white" : "bg-white"
                  }`}
                  style={
                    form.returnTimeWindow === w.id
                      ? { background: "var(--navy)", borderColor: "var(--navy)" }
                      : { borderColor: "var(--line)", color: "var(--navy-deep)" }
                  }
                >
                  {w.label}
                </button>
              ))}
            </div>
          </Field>
        )}

        <Field label="Cabin class">
          <div className="grid grid-cols-3 gap-2">
            {(cabinClasses.length ? cabinClasses : [{ id: "economy", label: "Economy" }]).map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => update("cabinClass", c.id)}
                className={`py-2 rounded-lg text-sm font-medium border transition ${
                  form.cabinClass === c.id ? "text-white" : "bg-white"
                }`}
                style={
                  form.cabinClass === c.id
                    ? { background: "var(--navy)", borderColor: "var(--navy)" }
                    : { borderColor: "var(--line)", color: "var(--navy-deep)" }
                }
              >
                {c.label}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Airlines (optional — leave empty to consider all)">
          <div className="flex flex-wrap gap-2">
            {airlines.map((a) => {
              const active = form.preferredAirlines.includes(a.code);
              return (
                <button
                  key={a.code}
                  type="button"
                  onClick={() => toggleAirline(a.code)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${active ? "text-white" : "bg-white"}`}
                  style={
                    active
                      ? { background: "var(--chestnut)", borderColor: "var(--chestnut)" }
                      : { borderColor: "var(--line)", color: "var(--navy-deep)" }
                  }
                >
                  {a.code} · {a.name}
                </button>
              );
            })}
          </div>
        </Field>

        <SliderField
          label="Max price"
          value={`$${form.maxPrice}`}
          min={300}
          max={isRoundTrip ? 2000 : 900}
          step={5}
          val={form.maxPrice}
          onChange={(v) => update("maxPrice", v)}
          hint={isRoundTrip ? "This is the combined budget for both legs together, not per-leg." : undefined}
        />

        <SliderField
          label="How much are you willing to pay to cut off an hour from your layover duration?"
          value={`$${form.hourlyLayoverCost}/hr`}
          min={0}
          max={40}
          step={1}
          val={form.hourlyLayoverCost}
          onChange={(v) => update("hourlyLayoverCost", v)}
          hint="How much are you willing to pay to cut off an hour from your layover duration"
        />

        <SliderField
          label="Value of a safer connection"
          value={`$${form.riskDollarValue} / risk unit`}
          min={0}
          max={150}
          step={5}
          val={form.riskDollarValue}
          onChange={(v) => update("riskDollarValue", v)}
          hint="Higher = agent pays more to avoid delay-prone layover airports (e.g. ORD, EWR)."
        />

        <Field label="Notes (optional)">
          <textarea
            className="input resize-none"
            rows={3}
            maxLength={500}
            placeholder="Anything else the agent should know — e.g. aisle seat, avoid overnight layovers, traveling with an infant..."
            value={form.notes}
            onChange={(e) => update("notes", e.target.value)}
          />
        </Field>

        <button
          type="submit"
          disabled={submitting}
          className="w-full flex items-center justify-center gap-2 text-white font-semibold rounded-xl py-3.5 transition disabled:opacity-60 hover:brightness-110"
          style={{ background: "linear-gradient(135deg, var(--navy), var(--chestnut))" }}
        >
          {submitting ? (
            "Locking budget on XRPL..."
          ) : (
            <>
              <PlaneIcon className="w-4 h-4 rotate-45" />
              Authorize agent &amp; lock budget
            </>
          )}
        </button>
      </form>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold mb-1.5 block">{label}</span>
      {children}
    </label>
  );
}

function SliderField({ label, value, min, max, step, val, onChange, hint }) {
  return (
    <label className="block">
      <span className="flex items-baseline justify-between mb-2">
        <span className="text-sm" style={{ color: "var(--navy-deep)" }}>
          {label}
        </span>
        <span className="text-sm font-semibold" style={{ color: "var(--chestnut)" }}>
          {value}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={val}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
        style={{ accentColor: "var(--navy)" }}
      />
      {hint && <p className="text-xs text-slate-500 mt-1">{hint}</p>}
    </label>
  );
}
