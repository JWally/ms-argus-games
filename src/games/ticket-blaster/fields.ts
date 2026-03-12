export interface Field {
  name: string;
  label: string;
  type: 'text' | 'email' | 'tel' | 'select' | 'checkbox' | 'radio' | 'textarea' | 'date';
  section: 'checkout' | 'preferences' | 'legal';
  required: boolean;
  placeholder?: string;
  options?: string[];
  validation?: string;
}

export const FIELDS: Field[] = [
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

export const SECTIONS = [
  {
    key: 'checkout' as const,
    title: 'Checkout',
    icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z',
  },
  {
    key: 'preferences' as const,
    title: 'Event Preferences',
    icon: 'M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z',
  },
  {
    key: 'legal' as const,
    title: 'Terms & Conditions',
    icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
  },
];
