import { useEffect, useRef, useState } from "react";
import ObjectiveForm from "./components/ObjectiveForm.jsx";
import ReasoningPanel from "./components/ReasoningPanel.jsx";
import StatusHeader from "./components/StatusHeader.jsx";
import TicketCard from "./components/TicketCard.jsx";
import DemoControls from "./components/DemoControls.jsx";
import AuthForm from "./components/AuthForm.jsx";
import ProfilePage from "./components/ProfilePage.jsx";
import { LogoMark, PlaneIcon } from "./components/icons.jsx";
import {
  startSession,
  getSession,
  streamSession,
  getToken,
  setToken,
  getStoredUser,
  setStoredUser,
  logout as apiLogout,
  getProfile,
} from "./api.js";

export default function App() {
  const [authChecked, setAuthChecked] = useState(false);
  const [user, setUser] = useState(null);
  const [profileComplete, setProfileComplete] = useState(false);
  const [showProfilePage, setShowProfilePage] = useState(false);

  const [showReasoning, setShowReasoning] = useState(false);
  const [session, setSession] = useState(null);
  const [log, setLog] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const stopStreamRef = useRef(null);

  useEffect(() => () => stopStreamRef.current?.(), []);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setAuthChecked(true);
      return;
    }
    getProfile()
      .then((p) => {
        setUser(getStoredUser());
        setProfileComplete(!!p.passport);
      })
      .catch(() => {
        apiLogout(); // stale/expired token
      })
      .finally(() => setAuthChecked(true));
  }, []);

  function handleAuthenticated(result) {
    setToken(result.token);
    setStoredUser(result.user);
    setUser(result.user);
    // Fresh accounts have no profile yet — ProfilePage's own load will confirm.
    getProfile()
      .then((p) => setProfileComplete(!!p.passport))
      .catch(() => setProfileComplete(false));
  }

  function handleLogout() {
    apiLogout();
    setUser(null);
    setProfileComplete(false);
    setSession(null);
    stopStreamRef.current?.();
  }

  async function handleStart(objective) {
    setSubmitting(true);
    setError(null);
    try {
      const s = await startSession(objective);
      setSession(s);
      setLog(s.log);

      stopStreamRef.current = streamSession(s.id, async (entry) => {
        if (entry.type === "connected") return;
        setLog((prev) => [...prev, entry]);
        if (["evaluation", "decision", "settlement", "ticket", "error", "refund", "alert"].includes(entry.type)) {
          try {
            const fresh = await getSession(s.id);
            setSession(fresh);
          } catch {
            // stream will retry on its own; ignore transient fetch errors
          }
        }
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen w-full">
      <nav
        className="sticky top-0 z-10 backdrop-blur-md border-b"
        style={{ background: "rgba(255, 241, 231, 0.85)", borderColor: "var(--line)" }}
      >
        <div className="max-w-7xl mx-auto px-8 py-4 flex items-center gap-3">
          <LogoMark />
          <div>
            <p className="font-bold leading-none" style={{ color: "var(--navy-deep)" }}>
              SeatSnatch
            </p>
            <p className="text-[11px] mt-0.5" style={{ color: "var(--navy)" }}>
              Autonomous flight-booking agent
            </p>
          </div>
          <div className="ml-auto flex items-center gap-3 text-xs">
            {user && (
              <>
                <button
                  onClick={() => setShowProfilePage(true)}
                  className="pill border transition hover:brightness-95"
                  style={{ background: "white", borderColor: "var(--line)", color: "var(--navy)" }}
                >
                  My Profile
                </button>
                <button
                  onClick={handleLogout}
                  className="pill border transition hover:brightness-95"
                  style={{ background: "white", borderColor: "var(--line)", color: "var(--chestnut)" }}
                >
                  Log out
                </button>
              </>
            )}
            <span className="pill bg-white border" style={{ borderColor: "var(--line)", color: "var(--navy)" }}>
              XRPL Testnet
            </span>
            <span className="pill bg-white border" style={{ borderColor: "var(--line)", color: "var(--chestnut)" }}>
              x402
            </span>
          </div>
        </div>
      </nav>

      {!authChecked && <div className="text-center text-sm text-slate-500 py-24">Loading...</div>}

      {authChecked && !user && (
        <div className="px-8 py-16 w-full min-h-[calc(100vh-73px)] flex items-center justify-center">
          <AuthForm onAuthenticated={handleAuthenticated} />
        </div>
      )}

      {authChecked && user && (showProfilePage || !profileComplete) && (
        <div className="px-8 py-16 w-full min-h-[calc(100vh-73px)] flex items-center justify-center">
          <ProfilePage
            required={!profileComplete}
            onCancel={profileComplete ? () => setShowProfilePage(false) : undefined}
            onSaved={() => {
              setProfileComplete(true);
              setShowProfilePage(false);
            }}
          />
        </div>
      )}

      {authChecked && user && profileComplete && !showProfilePage && !session && (
        <div className="px-8 py-16 w-full min-h-[calc(100vh-73px)] flex items-center">
          <div className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <span
                className="pill border mb-6"
                style={{ background: "rgba(50,96,128,0.08)", borderColor: "var(--line)", color: "var(--navy)" }}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--chestnut)" }} />
                Built for Singhacks 2026 · Ripple Track
              </span>
              <h1 className="text-5xl xl:text-6xl font-bold tracking-tight leading-[1.05]" style={{ color: "var(--navy-deep)" }}>
                Plan it once.
                <br />
                Let the agent fly.
              </h1>
              <p className="text-base mt-6 max-w-md leading-relaxed" style={{ color: "var(--navy)" }}>
                Fares in the cheapest class sell out in minutes. Set your constraints once — the agent monitors live
                fares and books the instant its conditions are met. No human in the loop.
              </p>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm mt-6 max-w-md">
                  {error}
                </div>
              )}

              <div className="mt-10 grid grid-cols-3 gap-6 max-w-md">
                <Stat value="24/7" label="Live fare monitoring" />
                <Stat value="~4s" label="XRPL finality" />
                <Stat value="0" label="Manual clicks to pay" />
              </div>

              <div className="mt-10 space-y-4 max-w-md">
                <Feature title="Depletion-aware decisions" desc="Projects sellout time per fare and targets the best expected value." />
                <Feature title="x402 machine payments" desc="Booking is gated behind a real 402 Payment Required flow." />
                <Feature title="Settled on XRPL Testnet" desc="Pre-authorized budget held in a native XRPL Escrow." />
              </div>
            </div>

            <ObjectiveForm onSubmit={handleStart} submitting={submitting} />
          </div>
        </div>
      )}

      <div className={`px-8 py-12 w-full ${authChecked && user && profileComplete && !showProfilePage && session ? "" : "hidden"}`}>
        <div className="mx-auto space-y-6 w-full max-w-7xl">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">{error}</div>
          )}

          {session && <StatusHeader session={session} />}

          {session && (
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-0">
                <DemoControls
                  bookedOfferIds={[session.legs.outbound?.ticket?.offerId, session.legs.return?.ticket?.offerId].filter(Boolean)}
                />
              </div>
              <button
                onClick={() => setShowReasoning((v) => !v)}
                className="pill border transition hover:brightness-95 shrink-0"
                style={
                  showReasoning
                    ? { background: "var(--navy)", borderColor: "var(--navy)", color: "white" }
                    : { background: "white", borderColor: "var(--line)", color: "var(--navy)" }
                }
              >
                {showReasoning ? "Hide agent reasoning" : "Show agent reasoning"}
              </button>
            </div>
          )}

          {session && session.objective.tripType === "round-trip" ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <LegColumn legKey="outbound" legLabel="Outbound" leg={session.legs.outbound} log={log} showReasoning={showReasoning} />
              <LegColumn legKey="return" legLabel="Return" leg={session.legs.return} log={log} showReasoning={showReasoning} />
            </div>
          ) : (
            session &&
            (showReasoning ? (
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                <div className="lg:col-span-2 space-y-6">
                  <WaitingOrTicket ticket={session.legs.outbound.ticket} refund={session.legs.outbound.refund} />
                </div>
                <div className="lg:col-span-3 min-h-[500px]">
                  <ReasoningPanel log={log} evaluations={session.legs.outbound.lastEvaluations} status={session.legs.outbound.status} />
                </div>
              </div>
            ) : (
              <div className="max-w-xl mx-auto w-full">
                <WaitingOrTicket ticket={session.legs.outbound.ticket} refund={session.legs.outbound.refund} />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function WaitingOrTicket({ ticket, legLabel, refund }) {
  if (ticket) return <TicketCard ticket={ticket} legLabel={legLabel} refund={refund} />;
  return (
    <div className="card p-6 flex flex-col items-center justify-center text-center gap-3 h-full min-h-[220px]">
      <span className="relative flex h-3 w-3">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-50" style={{ background: "var(--navy)" }} />
        <span className="relative inline-flex rounded-full h-3 w-3" style={{ background: "var(--navy)" }} />
      </span>
      <p className="font-medium" style={{ color: "var(--navy-deep)" }}>
        {legLabel ? `${legLabel} — agent is working` : "Agent is working"}
      </p>
      <p className="text-sm text-slate-500">Your ticket will appear here the moment this leg's booking settles.</p>
    </div>
  );
}

function LegColumn({ legKey, legLabel, leg, log, showReasoning }) {
  const legLog = log.filter((e) => e.leg === legKey || e.leg === null);
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 px-1">
        <PlaneIcon className={`w-4 h-4 rotate-45 ${legKey === "return" ? "-scale-x-100" : ""}`} style={{ color: "var(--navy)" }} />
        <h3 className="font-semibold text-sm uppercase tracking-wide" style={{ color: "var(--navy-deep)" }}>
          {legLabel} leg
        </h3>
      </div>
      <WaitingOrTicket ticket={leg.ticket} legLabel={legLabel} refund={leg.refund} />
      {showReasoning && (
        <div className="min-h-[420px]">
          <ReasoningPanel log={legLog} evaluations={leg.lastEvaluations} title={`${legLabel} reasoning`} status={leg.status} />
        </div>
      )}
    </div>
  );
}

function Stat({ value, label }) {
  return (
    <div>
      <p className="text-2xl font-bold" style={{ color: "var(--chestnut)" }}>
        {value}
      </p>
      <p className="text-xs mt-0.5 text-slate-500 leading-tight">{label}</p>
    </div>
  );
}

function Feature({ title, desc }) {
  return (
    <div className="flex items-start gap-3">
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
        style={{ background: "rgba(50,96,128,0.1)" }}
      >
        <PlaneIcon className="w-4 h-4 rotate-45" style={{ color: "var(--navy)" }} />
      </div>
      <div>
        <p className="text-sm font-semibold" style={{ color: "var(--navy-deep)" }}>
          {title}
        </p>
        <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
      </div>
    </div>
  );
}
