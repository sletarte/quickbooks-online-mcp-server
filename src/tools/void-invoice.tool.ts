import { voidQuickbooksInvoice } from "../handlers/void-quickbooks-invoice.handler.js";
import { ToolDefinition } from "../types/tool-definition.js";
import { z } from "zod";

const toolName = "void_invoice";
const toolDescription =
  "Void an invoice in QuickBooks Online: it stays in the books with a zero total. Never deletes. Call it only after explicit human approval. " +
  "Refuses invoices with a payment applied and invoices already voided. Independent of QUICKBOOKS_DISABLE_DELETE.";
const toolSchema = z.object({
  invoice_id: z.string().min(1).describe("Id of the invoice to void"),
});

const toolHandler = async ({ params }: any) => {
  const response = await voidQuickbooksInvoice(params);
  if (response.isError) {
    return { content: [{ type: "text" as const, text: `Error voiding invoice: ${response.error}` }] };
  }
  return {
    content: [
      { type: "text" as const, text: `Invoice voided:` },
      { type: "text" as const, text: JSON.stringify(response.result) },
    ],
  };
};

export const VoidInvoiceTool: ToolDefinition<typeof toolSchema> = {
  name: toolName,
  description: toolDescription,
  schema: toolSchema,
  handler: toolHandler,
};
