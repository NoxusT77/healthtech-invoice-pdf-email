import { z } from "zod";

export const invoiceRequest = z.object({
  invoiceId: z.string().min(1),
  appointmentStatus: z.enum(["scheduled", "completed", "cancelled"]),
  customerEmail: z.string().email(),
  customerName: z.string().min(1),
  serviceName: z.string().min(1),
  amountCents: z.number().int().positive(),
  currency: z.literal("USD"),
  issuedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
}).strict();

export type InvoiceRequest = z.infer<typeof invoiceRequest>;

export function invoiceDecision(input: InvoiceRequest): "send" | "skip" {
  return input.appointmentStatus === "completed" ? "send" : "skip";
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[char]!);
}

export function invoiceHtml(input: InvoiceRequest): string {
  const money = new Intl.NumberFormat("en-US", { style: "currency", currency: input.currency }).format(input.amountCents / 100);
  return `<!doctype html><html lang="en"><meta charset="utf-8"><title>Invoice ${escapeHtml(input.invoiceId)}</title><body><h1>Invoice ${escapeHtml(input.invoiceId)}</h1><p>Issued ${input.issuedOn}</p><p>Bill to: ${escapeHtml(input.customerName)}</p><table><thead><tr><th>Service</th><th>Amount</th></tr></thead><tbody><tr><td>${escapeHtml(input.serviceName)}</td><td>${money}</td></tr></tbody></table><p>Total: ${money}</p></body></html>`;
}
