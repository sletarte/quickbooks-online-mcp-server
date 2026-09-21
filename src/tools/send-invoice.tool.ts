import { sendQuickbooksInvoice } from "../handlers/send-quickbooks-invoice.handler.js";
import { ToolDefinition } from "../types/tool-definition.js";
import { z } from "zod";

const toolName = "send_invoice";
const toolDescription =
  "Email an existing invoice to the customer through QuickBooks Online. This leaves the company: call it only after explicit human approval. " +
  "Sends to the invoice BillEmail (cc: BillEmailCc) unless send_to is given. Refuses voided invoices and invoices without a recipient. " +
  "The result carries EmailStatus and DeliveryInfo as the delivery trace.";
const toolSchema = z.object({
  invoice_id: z.string().min(1).describe("Id of the invoice to send"),
  send_to: z.string().email().optional().describe("Override recipient for this send only. Defaults to the invoice BillEmail"),
});

const toolHandler = async ({ params }: any) => {
  const response = await sendQuickbooksInvoice(params);
  if (response.isError) {
    return { content: [{ type: "text" as const, text: `Error sending invoice: ${response.error}` }] };
  }
  const inv = response.result ?? {};
  const summary = {
    Id: inv.Id,
    DocNumber: inv.DocNumber,
    TotalAmt: inv.TotalAmt,
    EmailStatus: inv.EmailStatus,
    DeliveryInfo: inv.DeliveryInfo,
    BillEmail: inv.BillEmail,
    BillEmailCc: inv.BillEmailCc,
  };
  return {
    content: [
      { type: "text" as const, text: `Invoice sent:` },
      { type: "text" as const, text: JSON.stringify(summary) },
    ],
  };
};

export const SendInvoiceTool: ToolDefinition<typeof toolSchema> = {
  name: toolName,
  description: toolDescription,
  schema: toolSchema,
  handler: toolHandler,
};
