export interface FieldDef {
  name: string;
  label: string;
  type: string;
  section: string;
  required: boolean;
  placeholder?: string;
  options?: string[];
  validation?: string;
}

export const FIELD_SCHEMA: FieldDef[] = [
  // ── Checkout ────────────────────────────────────────────
  {
    name: 'email',
    label: 'Email',
    type: 'email',
    section: 'checkout',
    required: true,
    placeholder: 'you@example.com',
    validation: 'email',
  },
  {
    name: 'displayName',
    label: 'Display Name',
    type: 'text',
    section: 'checkout',
    required: true,
    placeholder: 'Your handle',
  },
  {
    name: 'company',
    label: 'Company',
    type: 'text',
    section: 'checkout',
    required: false,
    placeholder: 'Company name',
  },
  {
    name: 'cardNumber',
    label: 'Card Number',
    type: 'text',
    section: 'checkout',
    required: true,
    placeholder: 'Must be all 1s (16 digits)',
    validation: 'card-ones',
  },
  {
    name: 'cvv',
    label: 'CVV',
    type: 'text',
    section: 'checkout',
    required: true,
    placeholder: 'Must be all 1s (3 digits)',
    validation: 'cvv-ones',
  },

  // ── Event Preferences ──────────────────────────────────
  {
    name: 'seatSection',
    label: 'Seating Section',
    type: 'select',
    section: 'preferences',
    required: true,
    options: ['Floor', 'Lower Bowl', 'Upper Bowl', 'Nosebleeds', 'Standing Room'],
  },
  {
    name: 'ticketCount',
    label: 'Number of Tickets',
    type: 'select',
    section: 'preferences',
    required: true,
    options: ['1', '2', '3', '4'],
  },
  {
    name: 'tshirtSize',
    label: 'Free T-Shirt Size',
    type: 'select',
    section: 'preferences',
    required: true,
    options: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
  },
  {
    name: 'deliveryMethod',
    label: 'Ticket Delivery',
    type: 'radio',
    section: 'preferences',
    required: true,
    options: ['Digital', 'Mail', 'Will Call'],
  },
  {
    name: 'referralCode',
    label: 'Referral Code',
    type: 'text',
    section: 'preferences',
    required: false,
    placeholder: 'Enter code',
  },

  // ── Legal ───────────────────────────────────────────────
  {
    name: 'agreeTerms',
    label: 'I agree to the Terms of Service and understand tickets are non-refundable',
    type: 'checkbox',
    section: 'legal',
    required: true,
  },
];

export const HONEYPOT_NAMES = new Set(['company', 'referralCode']);

export const REQUIRED_FIELDS = new Set(
  FIELD_SCHEMA.filter((f) => f.required && !HONEYPOT_NAMES.has(f.name)).map((f) => f.name)
);

export const EMAIL_FIELDS = new Set(['email']);
export const ONES_CARD_FIELDS = new Set(['cardNumber']);
export const ONES_CVV_FIELDS = new Set(['cvv']);
