import { createServer } from "node:http";
import { ZodError } from "zod";
import { invoiceRequest } from "./invoice_workflow.ts";
import { InfraiError, issueInvoice } from "./invoice_sender.ts";

const server = createServer(async (request, response) => {
  response.setHeader("Content-Type", "application/json");
  if (request.method !== "POST" || request.url !== "/invoices") {
    response.writeHead(404).end(JSON.stringify({ error: "Not found" }));
    return;
  }
  try {
    let raw = "";
    for await (const chunk of request) {
      raw += chunk;
      if (raw.length > 65536) { response.writeHead(413).end(JSON.stringify({ error: "Body too large" })); return; }
    }
    const input = invoiceRequest.parse(JSON.parse(raw));
    const result = await issueInvoice(input);
    response.writeHead(result.status === "sent" ? 201 : 200).end(JSON.stringify(result));
  } catch (error) {
    const status = error instanceof ZodError || error instanceof SyntaxError ? 400
      : error instanceof InfraiError && error.status >= 400 && error.status < 500 ? error.status : 502;
    response.writeHead(status).end(JSON.stringify({ error: error instanceof InfraiError ? error.code : status === 400 ? "Invalid invoice request" : "Invoice delivery failed" }));
  }
});

server.listen(Number(process.env.PORT ?? 3000), () => console.log(`Invoice service listening on ${process.env.PORT ?? 3000}`));
