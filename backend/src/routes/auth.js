import { Router } from "express";
import { signup, login } from "../services/auth.js";

export const authRouter = Router();

function isValidPassword(password) {
  return typeof password === "string" && password.length >= 8;
}

authRouter.post("/signup", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !email.includes("@")) return res.status(400).json({ error: "a valid email is required" });
  if (!isValidPassword(password)) return res.status(400).json({ error: "password must be at least 8 characters" });

  try {
    const result = await signup(email, password);
    res.status(201).json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

authRouter.post("/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "email and password are required" });

  try {
    const result = await login(email, password);
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});
