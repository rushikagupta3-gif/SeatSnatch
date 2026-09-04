import { Router } from "express";
import { startSession, getSession, serializeSession, attachSSEClient, detachSSEClient, stopSession } from "../services/session.js";
import { requireAuth } from "../middleware/requireAuth.js";

export const sessionRouter = Router();

sessionRouter.post("/start", requireAuth, async (req, res) => {
  const {
    origin,
    destination,
    departDate,
    tripType,
    returnDate,
    returnTimeWindow,
    maxPrice,
    hourlyLayoverCost,
    riskDollarValue,
    cabinClass,
    preferredAirlines,
    notes,
  } = req.body || {};

  if (!origin || !destination || !maxPrice) {
    return res.status(400).json({ error: "origin, destination, and maxPrice are required" });
  }
  const isRoundTrip = tripType === "round-trip";
  if (isRoundTrip && !returnDate) {
    return res.status(400).json({ error: "returnDate is required for round-trip" });
  }

  const objective = {
    origin: String(origin).toUpperCase(),
    destination: String(destination).toUpperCase(),
    departDate: departDate || "2026-11-14",
    tripType: isRoundTrip ? "round-trip" : "one-way",
    returnDate: isRoundTrip ? returnDate : null,
    returnTimeWindow: isRoundTrip ? returnTimeWindow || "any" : null,
    maxPrice: Number(maxPrice),
    hourlyLayoverCost: Number(hourlyLayoverCost ?? 5),
    riskDollarValue: Number(riskDollarValue ?? 50),
    cabinClass: cabinClass || "economy",
    preferredAirlines: Array.isArray(preferredAirlines) ? preferredAirlines : [],
    notes: typeof notes === "string" ? notes.slice(0, 500) : "",
  };

  try {
    const session = await startSession(objective, req.userId);
    res.status(201).json(serializeSession(session));
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

sessionRouter.get("/:id", (req, res) => {
  const session = getSession(req.params.id);
  if (!session) return res.status(404).json({ error: "session not found" });
  res.json(serializeSession(session));
});

sessionRouter.post("/:id/cancel", requireAuth, (req, res) => {
  const session = getSession(req.params.id);
  if (!session) return res.status(404).json({ error: "session not found" });
  stopSession(session);
  res.json(serializeSession(session));
});

sessionRouter.get("/:id/stream", (req, res) => {
  const session = getSession(req.params.id);
  if (!session) return res.status(404).end();

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  res.write(`data: ${JSON.stringify({ type: "connected", message: "stream open" })}\n\n`);

  attachSSEClient(req.params.id, res);
  const keepAlive = setInterval(() => res.write(":\n\n"), 15000);

  req.on("close", () => {
    clearInterval(keepAlive);
    detachSSEClient(req.params.id, res);
  });
});
