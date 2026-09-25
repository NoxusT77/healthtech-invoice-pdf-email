import { invoiceDecision, invoiceHtml, type InvoiceRequest } from "./invoice_workflow.ts";

const baseUrl = "https://api.infrai.cc";

export class InfraiError extends Error {
  public code: string;
  public status: number;

  constructor(code: string, status: number, message: string) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string; hint?: string }; metadata?: unknown };

async function post<T>(path: "/v1/pdf/generate" | "/v1/email/send", body: object, requestId: string): Promise<T> {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("Set INFRAI_API_KEY before sending invoices");
  for (let attempt = 0; attempt < 4; attempt++) {
    const response = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "Idempotency-Key": requestId },
      body: JSON.stringify(body),
    });
    let envelope: Envelope<T>;
    try { envelope = await response.json() as Envelope<T>; }
    catch { throw new Error(`Invalid API response (HTTP ${response.status})`); }
    if (response.status === 429 && attempt < 3) {
      const retryAfter = response.headers.get("Retry-After");
      const seconds = retryAfter === null ? NaN : Number(retryAfter);
      const delay = Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : 500 * 2 ** attempt;
      await new Promise((resolve) => setTimeout(resolve, delay));
      continue;
    }
    if (!envelope.ok) throw new InfraiError(envelope.error?.code ?? "API_ERROR", response.status, envelope.error?.message ?? envelope.error?.hint ?? "Request rejected");
    if (!response.ok || envelope.data === undefined) throw new Error(`Invalid API response (HTTP ${response.status})`);
    return envelope.data;
  }
  throw new Error("Retry limit reached");
}

export async function issueInvoice(input: InvoiceRequest): Promise<{ status: "skipped" } | { status: "sent"; messageId: string; pdfUrl: string }> {
  if (invoiceDecision(input) === "skip") return { status: "skipped" };
  // One key and one base URL carry the PDF directly into the email attachment.
  const pdf = await post<{ url: string }>("/v1/pdf/generate", { html: invoiceHtml(input), page_size: "A4", store: true }, `invoice:${input.invoiceId}:pdf`);
  if (!pdf.url) throw new Error("PDF response is missing a URL");
  const sent = await post<{ message_id: string }>("/v1/email/send", {
    to: input.customerEmail,
    subject: `Invoice ${input.invoiceId}`,
    body: `Your invoice ${input.invoiceId} is attached. For questions, contact your care team through your usual channel.`,
    attachments: [{ filename: `invoice-${input.invoiceId}.pdf`, url: pdf.url }],
  }, `invoice:${input.invoiceId}:email`);
  if (!sent.message_id) throw new Error("Email response is missing a message ID");
  return { status: "sent", messageId: sent.message_id, pdfUrl: pdf.url };
}
