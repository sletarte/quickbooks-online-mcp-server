import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { mockQuickbooksClient, mockQuickbooksClientClass, mockQuickBooksInstance, resetAllMocks } from '../../mocks/quickbooks.mock';

jest.unstable_mockModule('../../../src/clients/quickbooks-client', () => ({
  quickbooksClient: mockQuickbooksClient,
  QuickbooksClient: mockQuickbooksClientClass,
}));

const { sendQuickbooksInvoice } = await import('../../../src/handlers/send-quickbooks-invoice.handler');
const { voidQuickbooksInvoice } = await import('../../../src/handlers/void-quickbooks-invoice.handler');

const openInvoice = {
  Id: '77',
  SyncToken: '3',
  DocNumber: '1005',
  TotalAmt: 5058.9,
  Balance: 5058.9,
  BillEmail: { Address: 'comptabilite@example.com' },
  LinkedTxn: [],
};

const returnsInvoice = (inv: any) =>
  mockQuickBooksInstance.getInvoice.mockImplementation((_id: any, cb: any) => cb(null, inv));

describe('sendQuickbooksInvoice', () => {
  beforeEach(() => resetAllMocks());

  it('sends to the invoice BillEmail when no override is given', async () => {
    returnsInvoice(openInvoice);
    mockQuickBooksInstance.sendInvoicePdf.mockImplementation((_id: any, cb: any) =>
      cb(null, { ...openInvoice, EmailStatus: 'EmailSent' })
    );

    const result = await sendQuickbooksInvoice({ invoice_id: '77' });

    expect(result.isError).toBe(false);
    expect(result.result.EmailStatus).toBe('EmailSent');
    expect(mockQuickBooksInstance.sendInvoicePdf).toHaveBeenCalledWith('77', expect.any(Function));
  });

  it('passes send_to through, URL-encoded', async () => {
    returnsInvoice(openInvoice);
    mockQuickBooksInstance.sendInvoicePdf.mockImplementation((_id: any, _to: any, cb: any) => cb(null, openInvoice));

    await sendQuickbooksInvoice({ invoice_id: '77', send_to: 'a+b@example.com' });

    expect(mockQuickBooksInstance.sendInvoicePdf).toHaveBeenCalledWith('77', 'a%2Bb%40example.com', expect.any(Function));
  });

  it('refuses when the invoice has no BillEmail and no send_to', async () => {
    returnsInvoice({ ...openInvoice, BillEmail: undefined });

    const result = await sendQuickbooksInvoice({ invoice_id: '77' });

    expect(result.isError).toBe(true);
    expect(result.error).toContain('no email');
    expect(mockQuickBooksInstance.sendInvoicePdf).not.toHaveBeenCalled();
  });

  it('refuses to send a voided (zero total) invoice', async () => {
    returnsInvoice({ ...openInvoice, TotalAmt: 0, Balance: 0 });

    const result = await sendQuickbooksInvoice({ invoice_id: '77' });

    expect(result.isError).toBe(true);
    expect(mockQuickBooksInstance.sendInvoicePdf).not.toHaveBeenCalled();
  });

  it('returns isError when the invoice cannot be read', async () => {
    mockQuickBooksInstance.getInvoice.mockImplementation((_id: any, cb: any) => cb(new Error('not found'), null));

    const result = await sendQuickbooksInvoice({ invoice_id: '404' });

    expect(result.isError).toBe(true);
    expect(mockQuickBooksInstance.sendInvoicePdf).not.toHaveBeenCalled();
  });

  it('returns isError when the send call fails', async () => {
    returnsInvoice(openInvoice);
    mockQuickBooksInstance.sendInvoicePdf.mockImplementation((_id: any, cb: any) => cb(new Error('boom'), null));

    const result = await sendQuickbooksInvoice({ invoice_id: '77' });

    expect(result.isError).toBe(true);
    expect(result.error).toContain('boom');
  });
});

describe('voidQuickbooksInvoice', () => {
  beforeEach(() => resetAllMocks());

  it('voids an unpaid invoice using Id and SyncToken only', async () => {
    returnsInvoice(openInvoice);
    mockQuickBooksInstance.voidInvoice.mockImplementation((_e: any, cb: any) =>
      cb(null, { Invoice: { ...openInvoice, TotalAmt: 0, Balance: 0 } })
    );

    const result = await voidQuickbooksInvoice({ invoice_id: '77' });

    expect(result.isError).toBe(false);
    expect(mockQuickBooksInstance.voidInvoice).toHaveBeenCalledWith({ Id: '77', SyncToken: '3' }, expect.any(Function));
    expect(mockQuickBooksInstance.deleteInvoice).not.toHaveBeenCalled();
  });

  it('refuses when a payment is applied (Balance differs from TotalAmt)', async () => {
    returnsInvoice({ ...openInvoice, Balance: 1000 });

    const result = await voidQuickbooksInvoice({ invoice_id: '77' });

    expect(result.isError).toBe(true);
    expect(result.error).toContain('payment');
    expect(mockQuickBooksInstance.voidInvoice).not.toHaveBeenCalled();
  });

  it('refuses when a Payment is linked even if the balance matches', async () => {
    returnsInvoice({ ...openInvoice, LinkedTxn: [{ TxnId: '9', TxnType: 'Payment' }] });

    const result = await voidQuickbooksInvoice({ invoice_id: '77' });

    expect(result.isError).toBe(true);
    expect(mockQuickBooksInstance.voidInvoice).not.toHaveBeenCalled();
  });

  it('allows a linked Estimate (invoice created from a quote)', async () => {
    returnsInvoice({ ...openInvoice, LinkedTxn: [{ TxnId: '5', TxnType: 'Estimate' }] });
    mockQuickBooksInstance.voidInvoice.mockImplementation((_e: any, cb: any) => cb(null, {}));

    const result = await voidQuickbooksInvoice({ invoice_id: '77' });

    expect(result.isError).toBe(false);
  });

  it('refuses an invoice that is already voided', async () => {
    returnsInvoice({ ...openInvoice, TotalAmt: 0, Balance: 0 });

    const result = await voidQuickbooksInvoice({ invoice_id: '77' });

    expect(result.isError).toBe(true);
    expect(mockQuickBooksInstance.voidInvoice).not.toHaveBeenCalled();
  });

  it('returns isError when the void call fails', async () => {
    returnsInvoice(openInvoice);
    mockQuickBooksInstance.voidInvoice.mockImplementation((_e: any, cb: any) => cb(new Error('stale'), null));

    const result = await voidQuickbooksInvoice({ invoice_id: '77' });

    expect(result.isError).toBe(true);
    expect(result.error).toContain('stale');
  });
});
