#!/usr/bin/env node
/**
 * Minimal OAuth 2.0 + PKCE IdP for local Cosmolog development.
 * Implements GET /authorize, POST /token, GET /health.
 */
import { createServer } from "node:http";
import { createHash, randomBytes } from "node:crypto";
import { URL } from "node:url";

const PORT = Number(process.env.PORT || 9090);
const CLIENT_ID = process.env.OAUTH_CLIENT_ID || "cosmolog-local";
const CLIENT_SECRET = process.env.OAUTH_CLIENT_SECRET || "cosmolog-local-secret";
const ISSUER = process.env.OAUTH_ISSUER || "http://localhost:9090";
const APP_PUBLIC_URL = (
  process.env.APP_PUBLIC_URL || "http://localhost:3000"
).replace(/\/$/, "");
const ALLOWED_REDIRECT_PREFIXES = (
  process.env.OAUTH_ALLOWED_REDIRECT_PREFIXES || "http://localhost:3000/"
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

/** @type {Map<string, { challenge: string, redirectUri: string, email: string, name: string, exp: number }>} */
const codes = new Map();

function b64urlJson(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function makeIdToken({ sub, email, name, aud }) {
  const now = Math.floor(Date.now() / 1000);
  // alg RS256 matches Google path; API disables signature verification.
  const header = b64urlJson({ alg: "RS256", typ: "JWT" });
  const payload = b64urlJson({
    sub,
    email,
    email_verified: true,
    name,
    aud,
    iss: ISSUER,
    iat: now,
    exp: now + 3600,
  });
  return `${header}.${payload}.fakesig`;
}

function pkceChallenge(verifier) {
  return createHash("sha256").update(verifier).digest("base64url");
}

function htmlEscape(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function isAllowedRedirect(uri) {
  return ALLOWED_REDIRECT_PREFIXES.some((prefix) => uri.startsWith(prefix));
}

function authorizePage(query, error) {
  const {
    client_id = "",
    redirect_uri = "",
    state = "",
    code_challenge = "",
    code_challenge_method = "S256",
  } = query;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Cosmolog Fake IdP</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 28rem; margin: 3rem auto; padding: 0 1rem; }
    label { display: block; margin: 0.75rem 0 0.25rem; font-size: 0.9rem; }
    input { width: 100%; padding: 0.5rem; box-sizing: border-box; }
    button { margin-top: 1rem; padding: 0.6rem 1rem; width: 100%; cursor: pointer; }
    .err { color: #b00020; margin-bottom: 1rem; }
    .hint { color: #555; font-size: 0.85rem; margin-top: 1rem; }
  </style>
</head>
<body>
  <h1>Fake Google (local)</h1>
  ${error ? `<p class="err">${htmlEscape(error)}</p>` : ""}
  <form method="POST" action="/authorize">
    <input type="hidden" name="client_id" value="${htmlEscape(client_id)}" />
    <input type="hidden" name="redirect_uri" value="${htmlEscape(redirect_uri)}" />
    <input type="hidden" name="state" value="${htmlEscape(state)}" />
    <input type="hidden" name="code_challenge" value="${htmlEscape(code_challenge)}" />
    <input type="hidden" name="code_challenge_method" value="${htmlEscape(code_challenge_method)}" />
    <label for="email">Email</label>
    <input id="email" name="email" type="email" required value="dev@example.com" />
    <label for="name">Name</label>
    <input id="name" name="name" type="text" required value="Local Dev" />
    <button type="submit">Continue</button>
  </form>
  <p class="hint">
    Use an email with a real-looking domain (e.g. <code>dev@example.com</code>).
    <code>@localhost</code> is rejected by the API.
  </p>
  <p class="hint"><a href="${htmlEscape(APP_PUBLIC_URL)}/login">Cancel and return to Cosmolog</a></p>
</body>
</html>`;
}

function parseForm(body) {
  const params = new URLSearchParams(body);
  const out = {};
  for (const [k, v] of params.entries()) out[k] = v;
  return out;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function send(res, status, body, headers = {}) {
  const payload = typeof body === "string" ? body : JSON.stringify(body);
  res.writeHead(status, {
    "content-type":
      typeof body === "string" ? "text/html; charset=utf-8" : "application/json",
    ...headers,
  });
  res.end(payload);
}

async function handleAuthorizeGet(req, res, url) {
  const q = Object.fromEntries(url.searchParams.entries());
  if (q.client_id !== CLIENT_ID) {
    return send(res, 400, authorizePage(q, "invalid client_id"));
  }
  if (!q.redirect_uri || !isAllowedRedirect(q.redirect_uri)) {
    return send(res, 400, authorizePage(q, "invalid redirect_uri"));
  }
  if (!q.code_challenge || (q.code_challenge_method || "S256") !== "S256") {
    return send(res, 400, authorizePage(q, "PKCE S256 required"));
  }
  return send(res, 200, authorizePage(q));
}

async function handleAuthorizePost(req, res) {
  const form = parseForm(await readBody(req));
  if (form.client_id !== CLIENT_ID) {
    return send(res, 400, authorizePage(form, "invalid client_id"));
  }
  if (!form.redirect_uri || !isAllowedRedirect(form.redirect_uri)) {
    return send(res, 400, authorizePage(form, "invalid redirect_uri"));
  }
  if (!form.code_challenge || (form.code_challenge_method || "S256") !== "S256") {
    return send(res, 400, authorizePage(form, "PKCE S256 required"));
  }
  const email = (form.email || "").trim().toLowerCase();
  const name = (form.name || "").trim() || "Local Dev";
  if (!email.includes("@")) {
    return send(res, 400, authorizePage(form, "invalid email"));
  }

  const code = randomBytes(24).toString("base64url");
  codes.set(code, {
    challenge: form.code_challenge,
    redirectUri: form.redirect_uri,
    email,
    name,
    exp: Date.now() + 5 * 60 * 1000,
  });

  const redirect = new URL(form.redirect_uri);
  redirect.searchParams.set("code", code);
  if (form.state) redirect.searchParams.set("state", form.state);
  res.writeHead(302, { location: redirect.toString() });
  res.end();
}

async function handleToken(req, res) {
  if (req.method !== "POST") {
    return send(res, 405, { error: "method_not_allowed" });
  }
  const contentType = req.headers["content-type"] || "";
  const raw = await readBody(req);
  let form;
  if (contentType.includes("application/json")) {
    form = JSON.parse(raw || "{}");
  } else {
    form = parseForm(raw);
  }

  if (form.client_id !== CLIENT_ID || form.client_secret !== CLIENT_SECRET) {
    return send(res, 401, { error: "invalid_client" });
  }
  if (form.grant_type !== "authorization_code") {
    return send(res, 400, { error: "unsupported_grant_type" });
  }

  const entry = codes.get(form.code || "");
  if (!entry || entry.exp < Date.now()) {
    codes.delete(form.code || "");
    return send(res, 400, { error: "invalid_grant" });
  }
  if (entry.redirectUri !== form.redirect_uri) {
    return send(res, 400, { error: "invalid_grant" });
  }
  const expected = pkceChallenge(form.code_verifier || "");
  if (expected !== entry.challenge) {
    return send(res, 400, { error: "invalid_grant" });
  }
  codes.delete(form.code);

  const sub = createHash("sha256").update(`local:${entry.email}`).digest("hex").slice(0, 32);
  const id_token = makeIdToken({
    sub,
    email: entry.email,
    name: entry.name,
    aud: CLIENT_ID,
  });

  return send(res, 200, {
    access_token: randomBytes(16).toString("hex"),
    token_type: "Bearer",
    expires_in: 3600,
    id_token,
  });
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    if (url.pathname === "/health") {
      return send(res, 200, { ok: true });
    }
    if (url.pathname === "/authorize" && req.method === "GET") {
      return handleAuthorizeGet(req, res, url);
    }
    if (url.pathname === "/authorize" && req.method === "POST") {
      return handleAuthorizePost(req, res);
    }
    if (url.pathname === "/token") {
      return handleToken(req, res);
    }
    send(res, 404, { error: "not_found" });
  } catch (err) {
    console.error(err);
    send(res, 500, { error: "server_error" });
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`fake-idp listening on :${PORT} issuer=${ISSUER} client_id=${CLIENT_ID}`);
});
