import { invoiceRequest } from "../src/invoice_workflow.ts";
import { issueInvoice } from "../src/invoice_sender.ts";

const customerEmail = process.env.CUSTOMER_EMAIL;
if (!customerEmail) throw new Error("Set CUSTOMER_EMAIL to the intended recipient");
const invoice = invoiceRequest.parse({
  invoiceId: process.env.INVOICE_ID ?? "visit-2026-001",
  appointmentStatus: "completed",
  customerEmail,
  customerName: "Alex Morgan",
  serviceName: "Consultation",
  amountCents: 8500,
  currency: "USD",
  issuedOn: "2026-09-19",
});
console.log(await issueInvoice(invoice));
