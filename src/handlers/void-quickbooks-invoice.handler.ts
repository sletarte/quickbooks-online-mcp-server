import { QuickbooksClient } from "../clients/quickbooks-client.js";
import { ToolResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";

export interface VoidInvoiceInput {
  invoice_id: string;
}

/**
 * Void an invoice in QuickBooks Online. The invoice stays in the books with a zero total.
 * Never deletes. Refuses when a payment is applied or the invoice is already voided.
 */
export async function voidQuickbooksInvoice(input: VoidInvoiceInput): Promise<ToolResponse<any>> {
  try {
    const quickbooks = await QuickbooksClient.getInstance();

    return new Promise((resolve) => {
      const fail = (error: unknown) => resolve({ result: null, isError: true, error: formatError(error) });

      (quickbooks as any).getInvoice(input.invoice_id, (readErr: any, invoice: any) => {
        if (readErr || !invoice?.Id) {
          return fail(readErr || `Invoice ${input.invoice_id} not found`);
        }
        if (Number(invoice.TotalAmt) === 0) {
          return fail(`Invoice ${input.invoice_id} is already voided (zero total)`);
        }
        const linkedPayment = (invoice.LinkedTxn ?? []).some((t: any) => t?.TxnType === "Payment");
        if (linkedPayment || Number(invoice.Balance) !== Number(invoice.TotalAmt)) {
          return fail(`Invoice ${input.invoice_id} has a payment applied; not voided. Handle the payment in QuickBooks first`);
        }

        (quickbooks as any).voidInvoice({ Id: invoice.Id, SyncToken: invoice.SyncToken }, (err: any, resp: any) =>
          err ? fail(err) : resolve({ result: resp, isError: false, error: null })
        );
      });
    });
  } catch (error) {
    return { result: null, isError: true, error: formatError(error) };
  }
}
