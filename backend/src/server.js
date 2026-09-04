import "dotenv/config";
import express from "express";
import cors from "cors";
import { inventoryRouter } from "./routes/inventory.js";
import { sessionRouter } from "./routes/session.js";
import { bookingRouter } from "./routes/booking.js";
import { authRouter } from "./routes/auth.js";
import { profileRouter } from "./routes/profile.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" })); // passport image base64 can be a few MB

app.get("/api/health", (req, res) => res.json({ ok: true }));
app.use("/api/inventory", inventoryRouter);
app.use("/api/session", sessionRouter);
app.use("/api/booking", bookingRouter);
app.use("/api/auth", authRouter);
app.use("/api/profile", profileRouter);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Flight agent backend listening on http://localhost:${PORT}`);
});
