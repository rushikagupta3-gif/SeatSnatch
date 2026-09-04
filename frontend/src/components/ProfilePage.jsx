import { useEffect, useRef, useState } from "react";
import { getProfile, saveProfile, scanPassport } from "../api.js";
import { PlaneIcon } from "./icons.jsx";

const emptyForm = {
  fullName: "",
  dateOfBirth: "",
  nationality: "",
  passportIssuingCountry: "",
  passportNumber: "",
  passportExpiry: "",
};

export default function ProfilePage({ onSaved, onCancel, required }) {
  const [form, setForm] = useState(emptyForm);
  const [existingPassport, setExistingPassport] = useState(null); // masked info from server
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [reviewDraft, setReviewDraft] = useState(null); // OCR output pending user confirmation
  const [scannedImageBase64, setScannedImageBase64] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    getProfile()
      .then((p) => {
        setForm((f) => ({
          ...f,
          fullName: p.fullName || "",
          dateOfBirth: p.dateOfBirth || "",
          nationality: p.nationality || "",
          passportIssuingCountry: p.passportIssuingCountry || "",
        }));
        setExistingPassport(p.passport);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setScanning(true);
    setError(null);
    try {
      const result = await scanPassport(file);
      setReviewDraft(result.extracted);
      setScannedImageBase64(result.rawImageBase64);
    } catch (err) {
      setError(err.message);
    } finally {
      setScanning(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function acceptReviewDraft() {
    setForm((f) => ({
      ...f,
      fullName: reviewDraft.fullName || f.fullName,
      passportNumber: reviewDraft.passportNumber || f.passportNumber,
      passportExpiry: normalizeDate(reviewDraft.passportExpiry) || f.passportExpiry,
    }));
    setReviewDraft(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await saveProfile({ ...form, passportImageBase64: scannedImageBase64 });
      onSaved?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="max-w-xl mx-auto text-center text-sm text-slate-500 py-12">Loading profile...</div>;

  // Passport number + expiry must always be submitted together: required
  // outright when there's no passport on file yet, and required once the
  // user starts filling either one in (so a half-filled pair can't silently
  // no-op, which is the bug this replaced).
  const passportPairRequired = required || !!form.passportNumber || !!form.passportExpiry;

  return (
    <div className="max-w-xl mx-auto w-full card overflow-hidden">
      <div
        className="relative px-8 pt-8 pb-8 overflow-hidden"
        style={{ background: "linear-gradient(135deg, var(--sky) 0%, var(--sky-deep) 55%, var(--navy) 100%)" }}
      >
        <PlaneIcon className="absolute -right-4 top-6 w-32 h-32 text-white/20 rotate-45" />
        <p className="text-white/80 text-xs font-semibold tracking-[0.2em] uppercase mb-2">Passenger profile</p>
        <h2 className="text-white text-2xl font-bold drop-shadow-sm">My profile</h2>
        <p className="text-white/90 text-sm mt-1.5 max-w-sm drop-shadow-sm">
          {required
            ? "Complete this once — the agent pulls it automatically for every booking, no re-entry needed."
            : "Update your passenger and passport details."}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="p-8 space-y-5">
        <label className="block">
          <span className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold mb-1.5 block">
            Full name <span className="normal-case font-normal text-slate-400">— must match your passport exactly</span>
          </span>
          <input required className="input" value={form.fullName} onChange={(e) => update("fullName", e.target.value)} />
        </label>

        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <span className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold mb-1.5 block">Date of birth</span>
            <input required type="date" className="input" value={form.dateOfBirth} onChange={(e) => update("dateOfBirth", e.target.value)} />
          </label>
          <label className="block">
            <span className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold mb-1.5 block">Nationality</span>
            <input required className="input" value={form.nationality} onChange={(e) => update("nationality", e.target.value)} />
          </label>
        </div>

        <div className="rounded-xl border p-4 space-y-4" style={{ borderColor: "var(--line)" }}>
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--navy)" }}>
              Passport details
            </p>
            <label className="text-xs font-medium underline decoration-dotted cursor-pointer" style={{ color: "var(--chestnut)" }}>
              {scanning ? "Scanning..." : "Scan passport"}
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} disabled={scanning} />
            </label>
          </div>

          {existingPassport && !form.passportNumber && (
            <p className="text-xs text-slate-500">
              On file: <span className="font-mono">{existingPassport.passportNumberMasked}</span>, expires{" "}
              {existingPassport.passportExpiry}. Enter new details below to replace it.
            </p>
          )}

          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold mb-1.5 block">
                Passport number {passportPairRequired && <span style={{ color: "var(--chestnut)" }}>*</span>}
              </span>
              <input
                className="input font-mono"
                required={passportPairRequired}
                value={form.passportNumber}
                onChange={(e) => update("passportNumber", e.target.value.toUpperCase())}
                placeholder={existingPassport ? "Leave blank to keep existing" : ""}
              />
            </label>
            <label className="block">
              <span className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold mb-1.5 block">
                Passport expiry {passportPairRequired && <span style={{ color: "var(--chestnut)" }}>*</span>}
              </span>
              <input
                type="date"
                className="input"
                required={passportPairRequired}
                value={form.passportExpiry}
                onChange={(e) => update("passportExpiry", e.target.value)}
              />
            </label>
          </div>
          {!existingPassport && !form.passportNumber && !form.passportExpiry && (
            <p className="text-xs" style={{ color: "var(--chestnut)" }}>
              Both passport number and expiry are required — enter them together.
            </p>
          )}

          <label className="block">
            <span className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold mb-1.5 block">Passport issuing country</span>
            <input className="input" value={form.passportIssuingCountry} onChange={(e) => update("passportIssuingCountry", e.target.value)} />
          </label>
        </div>

        {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">{error}</div>}

        <div className="flex gap-3">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 rounded-xl py-3 text-sm font-medium border"
              style={{ borderColor: "var(--line)", color: "var(--navy)" }}
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={saving}
            className="flex-1 text-white font-semibold rounded-xl py-3 transition disabled:opacity-60 hover:brightness-110"
            style={{ background: "linear-gradient(135deg, var(--navy), var(--chestnut))" }}
          >
            {saving ? "Saving..." : "Save profile"}
          </button>
        </div>
      </form>

      {reviewDraft && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-6 z-50">
          <div className="card max-w-md w-full p-6 space-y-4">
            <h3 className="font-bold text-lg" style={{ color: "var(--navy-deep)" }}>
              Review scanned details
            </h3>
            <p className="text-sm text-slate-500">
              OCR extraction is not always accurate — check every field before using it. Nothing is saved until you click
              "Use these details" and then Save profile.
            </p>
            <div className="space-y-3">
              <ReviewField label="Full name" value={reviewDraft.fullName} onChange={(v) => setReviewDraft((d) => ({ ...d, fullName: v }))} />
              <ReviewField
                label="Passport number"
                value={reviewDraft.passportNumber}
                onChange={(v) => setReviewDraft((d) => ({ ...d, passportNumber: v }))}
              />
              <ReviewField
                label="Passport expiry"
                value={reviewDraft.passportExpiry}
                onChange={(v) => setReviewDraft((d) => ({ ...d, passportExpiry: v }))}
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setReviewDraft(null)}
                className="flex-1 rounded-xl py-2.5 text-sm font-medium border"
                style={{ borderColor: "var(--line)", color: "var(--navy)" }}
              >
                Discard
              </button>
              <button
                onClick={acceptReviewDraft}
                className="flex-1 text-white font-semibold rounded-xl py-2.5 text-sm transition hover:brightness-110"
                style={{ background: "linear-gradient(135deg, var(--navy), var(--chestnut))" }}
              >
                Use these details
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ReviewField({ label, value, onChange }) {
  return (
    <label className="block">
      <span className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold mb-1.5 block">{label}</span>
      <input className="input" value={value || ""} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function normalizeDate(raw) {
  if (!raw) return "";
  const m = raw.match(/(\d{2})[\/\-.](\d{2})[\/\-.](\d{2,4})/);
  if (!m) return "";
  let [, a, b, year] = m;
  if (year.length === 2) year = `20${year}`;
  return `${year}-${a}-${b}`;
}
