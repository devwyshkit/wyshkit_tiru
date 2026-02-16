import Razorpay from 'razorpay';
import crypto from 'crypto';
import { logger } from '@/lib/logging/logger';

let razorpayInstance: Razorpay | null = null;

/**
 * WYSHKIT 2026: Razorpay Instance Factory with Validation
 * Validates API keys are configured before creating instance
 */
function getRazorpayInstance() {
  if (!razorpayInstance) {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      const errorMsg = 'RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET is not defined. Razorpay functionality will be disabled. Please set these environment variables.';
      logger.error(errorMsg, undefined, {
        hasKeyId: !!keyId,
        hasKeySecret: !!keySecret
      });

      // Return a mock instance that throws descriptive errors
      return {
        orders: { create: () => { throw new Error('Razorpay API keys missing. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET environment variables.'); } },
        payments: { fetch: () => { throw new Error('Razorpay API keys missing. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET environment variables.'); } },
        invoices: { create: () => { throw new Error('Razorpay API keys missing. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET environment variables.'); } },
        fundAccount: { create: () => { throw new Error('Razorpay API keys missing. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET environment variables.'); } },
        contacts: { create: () => { throw new Error('Razorpay API keys missing. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET environment variables.'); } },
        payouts: { create: () => { throw new Error('Razorpay API keys missing. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET environment variables.'); } },
      } as unknown as Razorpay;
    }

    // Validate key format (Razorpay key IDs typically start with 'rzp_')
    if (!keyId.startsWith('rzp_') && !keyId.startsWith('rzp_test_') && !keyId.startsWith('rzp_live_')) {
      logger.warn('RAZORPAY_KEY_ID format may be incorrect. Expected format: rzp_...', undefined, { keyIdPrefix: keyId.substring(0, 10) });
    }

    razorpayInstance = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });
  }
  return razorpayInstance;
}

export interface RazorpayOrderOptions {
  amount: number;
  currency?: string;
  receipt: string;
  notes?: Record<string, string>;
}

/**
 * Creates a Razorpay order.
 * @param amountInPaise - Amount in PAISE (already multiplied by 100 by caller)
 */
export async function createRazorpayOrder(
  amountInPaise: number,
  currency: string = 'INR',
  receipt: string,
  notes?: Record<string, string>
) {
  // WYSHKIT 2026: Amount is already in paise from caller - no multiplication needed
  const options = {
    amount: Math.round(amountInPaise),
    currency,
    receipt,
    notes,
  };

  const order = await getRazorpayInstance().orders.create(options);
  return order;
}

export async function verifyPayment(
  razorpayOrderId: string,
  razorpayPaymentId: string,
  razorpaySignature: string
): Promise<boolean> {
  const body = razorpayOrderId + '|' + razorpayPaymentId;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keySecret) {
    logger.error('RAZORPAY_KEY_SECRET is missing for verification', undefined, { razorpayOrderId });
    return false;
  }

  const expectedSignature = crypto
    .createHmac('sha256', keySecret)
    .update(body.toString())
    .digest('hex');

  return expectedSignature === razorpaySignature;
}

export function validateWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  return expectedSignature === signature;
}

export async function fetchPayment(paymentId: string) {
  return getRazorpayInstance().payments.fetch(paymentId);
}

/**
 * Refunds a payment.
 * @param paymentId Razorpay payment ID
 * @param amount Amount in PAISE (optional, defaults to full amount if not provided)
 * @param notes Optional notes
 */
export async function refundPayment(paymentId: string, amount?: number, notes?: Record<string, string>) {
  const options: Record<string, any> = { notes };
  if (amount) options.amount = Math.round(amount);

  return getRazorpayInstance().payments.refund(paymentId, options);
}

export interface InvoiceLineItem {
  name: string;
  description?: string;
  amount: number;
  currency?: string;
  quantity: number;
}

export interface InvoiceCustomer {
  name: string;
  email?: string;
  contact?: string;
  billing_address?: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    zipcode: string;
    country: string;
  };
  gstin?: string;
}

export async function createInvoice(
  customer: InvoiceCustomer,
  lineItems: InvoiceLineItem[],
  options?: {
    type?: 'invoice' | 'link';
    description?: string;
    currency?: string;
    expireBy?: number;
    smsNotify?: boolean;
    emailNotify?: boolean;
    partialPayment?: boolean;
  }
) {
  const invoiceData: Record<string, unknown> = {
    type: options?.type || 'invoice',
    description: options?.description || 'Order Invoice',
    customer: {
      name: customer.name,
      email: customer.email,
      contact: customer.contact,
      billing_address: customer.billing_address,
      gstin: customer.gstin,
    },
    line_items: lineItems.map((item) => ({
      name: item.name,
      description: item.description,
      amount: Math.round(item.amount * 100),
      currency: item.currency || 'INR',
      quantity: item.quantity,
    })),
    currency: options?.currency || 'INR',
    sms_notify: options?.smsNotify ?? false,
    email_notify: options?.emailNotify ?? true,
    partial_payment: options?.partialPayment ?? false,
  };

  if (options?.expireBy) {
    invoiceData.expire_by = options.expireBy;
  }

  return getRazorpayInstance().invoices.create(invoiceData as any);
}

// ============================================
// RAZORPAY X (PAYOUTS) - Partner Payouts
// ============================================

export interface PayoutContact {
  name: string;
  email?: string;
  contact?: string;
  type: 'vendor' | 'customer' | 'employee' | 'self';
  reference_id?: string;
  notes?: Record<string, string>;
}

export interface FundAccount {
  contact_id: string;
  account_type: 'bank_account' | 'vpa';
  bank_account?: {
    name: string;
    ifsc: string;
    account_number: string;
  };
  vpa?: {
    address: string;
  };
}

export interface PayoutRequest {
  account_number: string;
  fund_account_id: string;
  amount: number;
  currency?: string;
  mode: 'IMPS' | 'NEFT' | 'RTGS' | 'UPI';
  purpose: 'payout' | 'salary' | 'refund' | 'cashback' | 'vendor_bill';
  queue_if_low_balance?: boolean;
  reference_id?: string;
  narration?: string;
  notes?: Record<string, string>;
}

export async function createPayoutContact(contact: PayoutContact) {
  const razorpay = getRazorpayInstance();
  return (razorpay as any).contacts.create(contact);
}

export async function createFundAccount(fundAccount: FundAccount) {
  const razorpay = getRazorpayInstance();
  return (razorpay as any).fundAccount.create(fundAccount);
}

export async function createPayout(payout: PayoutRequest) {
  const razorpay = getRazorpayInstance();
  const payoutData = {
    ...payout,
    amount: Math.round(payout.amount * 100),
    currency: payout.currency || 'INR',
    queue_if_low_balance: payout.queue_if_low_balance ?? true,
  };
  return (razorpay as any).payouts.create(payoutData);
}

export async function initiatePartnerPayout(
  partner: {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    payout_contact_id?: string;
    payout_fund_account_id?: string;
    payout_account_number: string;
    payout_ifsc: string;
    payout_account_name: string;
    payout_mode?: string;
  },
  amount: number,
  orderId: string,
  orderNumber: string
) {
  let contactId = partner.payout_contact_id;
  let fundAccountId = partner.payout_fund_account_id;

  if (!contactId) {
    const contact = await createPayoutContact({
      name: partner.name,
      email: partner.email,
      contact: partner.phone,
      type: 'vendor',
      reference_id: partner.id,
    });
    contactId = contact.id;
  }

  if (!fundAccountId && contactId) {
    const fundAccount = await createFundAccount({
      contact_id: contactId,
      account_type: 'bank_account',
      bank_account: {
        name: partner.payout_account_name,
        ifsc: partner.payout_ifsc,
        account_number: partner.payout_account_number,
      },
    });
    fundAccountId = fundAccount.id;
  }

  if (!fundAccountId) {
    throw new Error('Failed to create fund account');
  }

  const razorpayAccountNumber = process.env.RAZORPAY_X_ACCOUNT_NUMBER;
  if (!razorpayAccountNumber) {
    throw new Error('RAZORPAY_X_ACCOUNT_NUMBER not configured');
  }

  const payout = await createPayout({
    account_number: razorpayAccountNumber,
    fund_account_id: fundAccountId,
    amount: amount,
    mode: (partner.payout_mode as 'IMPS' | 'NEFT' | 'RTGS' | 'UPI') || 'IMPS',
    purpose: 'vendor_bill',
    reference_id: orderId,
    narration: `WyshKit Order #${orderNumber}`,
    notes: {
      order_id: orderId,
      partner_id: partner.id,
    },
  });

  return {
    payout_id: payout.id,
    contact_id: contactId,
    fund_account_id: fundAccountId,
    status: payout.status,
  };
}
