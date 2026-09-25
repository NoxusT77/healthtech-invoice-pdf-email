import { test } from "node:test";
import assert from "node:assert/strict";
import { invoiceDecision, invoiceHtml, invoiceRequest } from "../src/invoice_workflow.ts";

const invoice = invoiceRequest.parse({ invoiceId: "visit-123", appointmentStatus: "scheduled", customerEmail: "alex@example.com", customerName: "Alex <Morgan>", serviceName: "Consultation", amountCents: 8500, currency: "USD", issuedOn: "2026-09-19" });

test("only a completed appointment produces an invoice notification", () => {
  assert.equal(invoiceDecision(invoice), "skip");
  assert.equal(invoiceDecision({ ...invoice, appointmentStatus: "cancelled" }), "skip");
  assert.equal(invoiceDecision({ ...invoice, appointmentStatus: "completed" }), "send");
  assert.match(invoiceHtml(invoice), /Alex &lt;Morgan&gt;/);
  assert.match(invoiceHtml(invoice), /\$85\.00/);
});
