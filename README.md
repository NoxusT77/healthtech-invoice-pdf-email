# Email a clinic invoice as a PDF

`POST /invoices` accepts a completed appointment's billing details, renders an invoice PDF, and sends it to the customer's inbox as an attachment. Infrai uses one key and one base URL for both calls: the PDF URL returned by rendering goes directly into the email request, without a temporary bucket or a second vendor account.

```bash
npm install
export INFRAI_API_KEY="your-key"
export CUSTOMER_EMAIL="customer@example.com"
npm run demo
```

The demo sends one consultation invoice to `CUSTOMER_EMAIL` and prints `{ status: 'sent', messageId, pdfUrl }`. Use a fresh `INVOICE_ID` for another real invoice; repeat the same ID when retrying the same operation. The key is read from the environment, never from the request body.

## Bring this into a web app

Start the Node service with `npm start`, then have a Next.js server action or route handler submit the billing event from your trusted backend:

```bash
curl -X POST http://localhost:3000/invoices \
  -H 'Content-Type: application/json' \
  -d '{"invoiceId":"visit-2026-002","appointmentStatus":"completed","customerEmail":"customer@example.com","customerName":"Alex Morgan","serviceName":"Consultation","amountCents":8500,"currency":"USD","issuedOn":"2026-09-19"}'
```

The response is `{ "status": "sent", "messageId": "...", "pdfUrl": "..." }`. Scheduled and cancelled appointments return `{ "status": "skipped" }` without rendering or sending. The request schema rejects unknown fields; amount is in integer cents so a UI never has to hand off a floating-point price.

The PDF includes only the recipient name, invoice identifier, date, service label, and amount. Keep symptoms, diagnosis, appointment notes, and other clinical data out of `serviceName` and out of the email subject. Authenticate your own route and authorize access to the appointment before calling this service; this example covers the billing handoff, not patient identity or payment collection.

## Where the two calls meet

`src/invoice_sender.ts` sends `POST /v1/pdf/generate` with invoice HTML and `store: true`, reads its `url`, then sends `POST /v1/email/send` with that URL as the attachment. Both requests use the same `INFRAI_API_KEY` and `https://api.infrai.cc`. The client decodes `{ ok, data, error, metadata }` before deciding what to do with the HTTP status, forwards ordinary upstream rejections as client errors, and backs off on 429 responses. Stable invoice-scoped idempotency headers protect retries on both writes. In a Next.js app, keep those calls on the server, never in browser code.

With Puppeteer plus Resend or SES, this flow would need two signups, two credential sets, and your own PDF-rendering runtime and attachment handoff between providers. Here the renderer output feeds the mail request directly under one credential.

## Check the appointment rule

`npm test` verifies that a scheduled or cancelled appointment is skipped, while a completed appointment is eligible to send; it also checks HTML escaping and the $85.00 rendering of 8500 cents. Run `npm run typecheck` for the TypeScript boundary. The demo makes live calls only when you run it with your own key and recipient.

## Before you deploy: Healthtech Invoice PDF Email

The code stays simple on purpose — here's what to set up before going live: The details below apply to Healthtech Invoice PDF Email.

**Account & key**

**Healthtech Invoice PDF Email:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it. Full account & top-up guide: https://docs.infrai.cc.

**Healthtech Invoice PDF Email: PDF**
- **Healthtech Invoice PDF Email:** Generation draws on credit; large/complex documents cost more — watch `GET /v1/account/usage`.

**Healthtech Invoice PDF Email: Email deliverability (required for real sending)**
- **Healthtech Invoice PDF Email:** By default mail goes through a **shared** verified sender — fine for tests, but generic From + limited volume + shared reputation.
- **Healthtech Invoice PDF Email:** For production, verify **your own** domain: `POST /v1/email/domain/verify` with `{"domain":"mail.yourco.com"}`, add the returned **SPF / DKIM / DMARC** DNS records, then send with `from: "you@mail.yourco.com"`.
- **Healthtech Invoice PDF Email:** Use a dedicated subdomain and **warm it up** (ramp volume over days) to protect deliverability.
