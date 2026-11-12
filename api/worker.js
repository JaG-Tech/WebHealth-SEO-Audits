/**
 * JAG Tech quote API — Cloudflare Worker
 *
 * POST /quote  (JSON)  { name, email, url, package, message, website }
 *   - `website` is a honeypot: real visitors leave it empty.
 *   - Emails the submission to TO_EMAIL via Resend.
 *
 * Secrets / vars (set in Cloudflare, never in this file):
 *   RESEND_API_KEY  (secret)  API key from resend.com
 *   TO_EMAIL        (var)     where quote requests are delivered
 *   FROM_EMAIL      (var)     verified sender, e.g. "JAG Tech <quotes@yourdomain.com>"
 *   ALLOWED_ORIGIN  (var)     e.g. https://jag-tech.github.io
 */

const MAX_LEN = { name: 100, email: 200, url: 300, package: 60, message: 2000 };
const PACKAGES = [
  "Starter audit",
  "Standard audit",
  "Local Business Bundle",
  "Website build",
  "Build + audit bundle",
  "Not sure yet",
];

function cors(env) {
  return {
    "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
  };
}

function json(env, status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...cors(env) },
  });
}

const clean = (v, max) =>
  String(v ?? "").replace(/[\r\n\t]+/g, " ").trim().slice(0, max);

const escapeHtml = (s) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors(env) });
    }

    if (url.pathname !== "/quote" || request.method !== "POST") {
      return json(env, 404, { ok: false, error: "Not found" });
    }

    // Only accept requests from the site itself.
    if (request.headers.get("Origin") !== env.ALLOWED_ORIGIN) {
      return json(env, 403, { ok: false, error: "Forbidden" });
    }

    let data;
    try {
      data = await request.json();
    } catch {
      return json(env, 400, { ok: false, error: "Invalid JSON" });
    }

    // Honeypot: pretend success so bots don't retry.
    if (clean(data.website, 100)) {
      return json(env, 200, { ok: true });
    }

    const name = clean(data.name, MAX_LEN.name);
    const email = clean(data.email, MAX_LEN.email);
    const siteUrl = clean(data.url, MAX_LEN.url);
    const pkg = clean(data.package, MAX_LEN.package);
    const message = String(data.message ?? "").trim().slice(0, MAX_LEN.message);

    if (!name) return json(env, 400, { ok: false, error: "Please enter your name." });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json(env, 400, { ok: false, error: "Please enter a valid email." });
    }
    if (siteUrl && !/^https?:\/\/[^\s]+$/i.test(siteUrl)) {
      return json(env, 400, { ok: false, error: "Website URL must start with http:// or https://" });
    }
    if (pkg && !PACKAGES.includes(pkg)) {
      return json(env, 400, { ok: false, error: "Unknown package." });
    }

    const html = `
      <h2>New quote request</h2>
      <p><b>Name:</b> ${escapeHtml(name)}<br>
      <b>Email:</b> ${escapeHtml(email)}<br>
      <b>Website:</b> ${escapeHtml(siteUrl || "—")}<br>
      <b>Package:</b> ${escapeHtml(pkg || "—")}</p>
      <p><b>Message:</b><br>${escapeHtml(message || "—").replace(/\n/g, "<br>")}</p>`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: env.FROM_EMAIL,
        to: [env.TO_EMAIL],
        reply_to: email,
        subject: `Quote request: ${name}${pkg ? " — " + pkg : ""}`,
        html,
      }),
    });

    if (!res.ok) {
      return json(env, 502, { ok: false, error: "Couldn't send right now. Please email me directly." });
    }
    return json(env, 200, { ok: true });
  },
};
