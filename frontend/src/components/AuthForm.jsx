import { useState } from "react";
import { login as apiLogin, signup as apiSignup } from "../api.js";
import { PlaneIcon } from "./icons.jsx";

export default function AuthForm({ onAuthenticated }) {
  const [mode, setMode] = useState("login"); // "login" | "signup"
  const [email, setEmail] = useState("demo@seatsnatch.test");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const result = mode === "login" ? await apiLogin(email, password) : await apiSignup(email, password);
      onAuthenticated(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-md mx-auto w-full card overflow-hidden">
      <div
        className="relative px-8 pt-8 pb-8 overflow-hidden"
        style={{ background: "linear-gradient(135deg, var(--sky) 0%, var(--sky-deep) 55%, var(--navy) 100%)" }}
      >
        <PlaneIcon className="absolute -right-4 top-6 w-32 h-32 text-white/20 rotate-45" />
        <p className="text-white/80 text-xs font-semibold tracking-[0.2em] uppercase mb-2">
          {mode === "login" ? "Welcome back" : "Create your account"}
        </p>
        <h2 className="text-white text-2xl font-bold drop-shadow-sm">Sign {mode === "login" ? "in" : "up"} to SeatSnatch</h2>
      </div>

      <form onSubmit={handleSubmit} className="p-8 space-y-4">
        <div className="grid grid-cols-2 gap-2 bg-slate-100 rounded-xl p-1">
          {["login", "signup"].map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`py-2 rounded-lg text-sm font-semibold capitalize transition ${mode === m ? "bg-white shadow" : "text-slate-500"}`}
              style={mode === m ? { color: "var(--navy-deep)" } : undefined}
            >
              {m === "login" ? "Sign in" : "Sign up"}
            </button>
          ))}
        </div>

        <label className="block">
          <span className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold mb-1.5 block">Email</span>
          <input type="email" required className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>

        <label className="block">
          <span className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold mb-1.5 block">Password</span>
          <input
            type="password"
            required
            minLength={8}
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={mode === "signup" ? "At least 8 characters" : undefined}
          />
        </label>

        {mode === "login" && (
          <p className="text-xs text-slate-500">
            Demo account: <span className="font-mono">demo@seatsnatch.test</span> / <span className="font-mono">demo-password-123</span>
          </p>
        )}

        {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">{error}</div>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full text-white font-semibold rounded-xl py-3 transition disabled:opacity-60 hover:brightness-110"
          style={{ background: "linear-gradient(135deg, var(--navy), var(--chestnut))" }}
        >
          {submitting ? "..." : mode === "login" ? "Sign in" : "Create account"}
        </button>
      </form>
    </div>
  );
}
