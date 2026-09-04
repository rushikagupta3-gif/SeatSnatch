const BASE = "/api";

const TOKEN_KEY = "seatsnatch_token";
const USER_KEY = "seatsnatch_user";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || "null");
  } catch {
    return null;
  }
}

export function setStoredUser(user) {
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
  else localStorage.removeItem(USER_KEY);
}

export function logout() {
  setToken(null);
  setStoredUser(null);
}

function authHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function signup(email, password) {
  const res = await fetch(`${BASE}/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "signup failed");
  return res.json();
}

export async function login(email, password) {
  const res = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "login failed");
  return res.json();
}

export async function getProfile() {
  const res = await fetch(`${BASE}/profile`, { headers: authHeaders() });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "failed to load profile");
  return res.json();
}

export async function saveProfile(profile) {
  const res = await fetch(`${BASE}/profile`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(profile),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "failed to save profile");
  return res.json();
}

export async function scanPassport(file) {
  const formData = new FormData();
  formData.append("passport", file);
  const res = await fetch(`${BASE}/profile/scan-passport`, {
    method: "POST",
    headers: authHeaders(), // no Content-Type — browser sets multipart boundary
    body: formData,
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "scan failed");
  return res.json();
}

export async function startSession(objective) {
  const res = await fetch(`${BASE}/session/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(objective),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "failed to start session");
  return res.json();
}

export async function getAirlines() {
  const res = await fetch(`${BASE}/inventory/airlines`);
  if (!res.ok) throw new Error("failed to load airlines");
  return res.json();
}

export async function getSession(id) {
  const res = await fetch(`${BASE}/session/${id}`);
  if (!res.ok) throw new Error("failed to load session");
  return res.json();
}

export function streamSession(id, onEvent) {
  const es = new EventSource(`${BASE}/session/${id}/stream`);
  es.onmessage = (e) => {
    try {
      onEvent(JSON.parse(e.data));
    } catch {
      // ignore keep-alive / malformed frames
    }
  };
  return () => es.close();
}
