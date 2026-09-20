import { QuickbooksClient } from "../clients/quickbooks-client.js";
import { ToolResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";

export interface SendInvoiceInput {
  invoice_id: string;
  send_to?: string; // overrides Invoice.BillEmail for this send only
}

/**
 * Email an invoice to the customer through QuickBooks Online.
 * Reads the invoice first and refuses to send when it is voided or has no recipient.
 * Cc recipients come from Invoice.BillEmailCc, set at creation.
 */
export async function sendQuickbooksInvoice(input: SendInvoiceInput): Promise<ToolResponse<any>> {
  try {
    const quickbooks = await QuickbooksClient.getInstance();

    return new Promise((resolve) => {
      const fail = (error: unknown) => resolve({ result: null, isError: true, error: formatError(error) });

      (quickbooks as any).getInvoice(input.invoice_id, (readErr: any, invoice: any) => {
        if (readErr || !invoice?.Id) {
          return fail(readErr || `Invoice ${input.invoice_id} not found`);
        }
        if (Number(invoice.TotalAmt) === 0) {
          return fail(`Invoice ${input.invoice_id} has a zero total (voided or empty); not sent`);
        }
        if (!input.send_to && !invoice.BillEmail?.Address) {
          return fail(`Invoice ${input.invoice_id} has no email address (BillEmail) and no send_to was given`);
        }

        const done = (err: any, sent: any) => (err ? fail(err) : resolve({ result: sent, isError: false, error: null }));

        if (input.send_to) {
          // node-quickbooks appends sendTo to the query string without encoding it
          (quickbooks as any).sendInvoicePdf(input.invoice_id, encodeURIComponent(input.send_to), done);
        } else {
          (quickbooks as any).sendInvoicePdf(input.invoice_id, done);
        }
      });
    });
  } catch (error) {
    return { result: null, isError: true, error: formatError(error) };
  }
}
