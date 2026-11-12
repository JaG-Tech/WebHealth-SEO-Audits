# JAG Tech Quote API

Cloudflare Worker that receives the quote form and emails it to you via Resend.

## Deploy (about 10 minutes)

1. Create free accounts at cloudflare.com and resend.com.
2. In Resend, create an API key. (Using `onboarding@resend.dev` as sender works for testing; verify your own domain for production.)
3. From this `api/` folder:
   ```
   npx wrangler login
   npx wrangler secret put RESEND_API_KEY
   npx wrangler deploy
   ```
4. Wrangler prints your Worker URL (like `https://jag-tech-quote-api.<you>.workers.dev`).
5. In `index.html`, set `QUOTE_API_URL` to `<that URL>/quote`, commit, and push.

## Endpoint

`POST /quote` with JSON: `name`, `email` (required), `url`, `package`, `message`, plus hidden honeypot `website` (must be empty).
Responds `{ "ok": true }` or `{ "ok": false, "error": "..." }`.

## Protections

Origin check (only your site), honeypot field, input validation and length caps, HTML-escaped email body, secret key stored in Cloudflare (not in the repo).
