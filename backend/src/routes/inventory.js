import { Router } from "express";
import { inventoryStore } from "../services/inventoryStore.js";
import { AIRLINES, CABIN_CLASSES } from "../data/airlines.js";

export const inventoryRouter = Router();

// GDS/aggregator-style search response. ?leg=outbound|return filters to one leg.
inventoryRouter.get("/search", (req, res) => {
  res.json({ offers: inventoryStore.list(req.query.leg) });
});

inventoryRouter.get("/airlines", (req, res) => {
  res.json({ airlines: AIRLINES, cabinClasses: CABIN_CLASSES });
});

inventoryRouter.get("/offers/:id", (req, res) => {
  const offer = inventoryStore.get(req.params.id);
  if (!offer) return res.status(404).json({ error: "offer not found" });
  res.json(offer);
});

inventoryRouter.get("/offers/:id/history", (req, res) => {
  res.json({ history: inventoryStore.getHistory(req.params.id) });
});

// Demo controls — force seats to deplete on cue during the live demo
inventoryRouter.post("/demo/deplete/:id", (req, res) => {
  const by = Number(req.body?.by ?? 1);
  const offer = inventoryStore.decrementSeats(req.params.id, by);
  if (!offer) return res.status(404).json({ error: "offer not found" });
  res.json(offer);
});

inventoryRouter.post("/demo/reset", (req, res) => {
  inventoryStore.reset();
  res.json({ offers: inventoryStore.list() });
});
