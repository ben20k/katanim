export const ORDER_STATUS = {
  pending_payment: {
    label: 'Awaiting payment',
    tone: 'warn',
    help: 'Pay using your selected method, then upload your proof of payment below.',
  },
  for_verification: {
    label: 'For verification',
    tone: 'info',
    help: 'We received your proof of payment and are verifying it with the bank / GCash.',
  },
  payment_rejected: {
    label: 'Payment not verified',
    tone: 'danger',
    help: 'We could not verify your payment. Please read the comment from our team and upload a new proof.',
  },
  payment_verified: {
    label: 'Payment verified',
    tone: 'success',
    help: 'Your payment is confirmed. We are preparing your order for shipping.',
  },
  shipped: { label: 'Shipped', tone: 'info', help: 'Your order is on its way. Press "Received" once it arrives.' },
  delivered: { label: 'Delivered', tone: 'info', help: 'The courier reports your order as delivered. Please press "Received".' },
  received: { label: 'Received', tone: 'success', help: 'Thank you! You confirmed receipt of this order.' },
  cancelled: { label: 'Cancelled', tone: 'muted', help: 'This order was cancelled.' },
};

export const PAYMENT_STATUS = {
  awaiting_proof: { label: 'Awaiting proof', tone: 'warn' },
  submitted: { label: 'For verification', tone: 'info' },
  verified: { label: 'Verified', tone: 'success' },
  rejected: { label: 'Not verified', tone: 'danger' },
};

export const PAYMENT_TYPE_LABEL = {
  gcash: 'GCash',
  bank: 'Bank transfer / QR Ph',
  maya: 'Maya',
  other: 'Other',
};

// statuses where the customer can still upload proofs
export const CAN_UPLOAD = ['pending_payment', 'payment_rejected', 'for_verification'];
