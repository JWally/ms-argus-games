import { useState, type CSSProperties, type ReactElement } from 'react';

/**
 * Checkout-form intake for /bot-buster.
 *
 * The page is a honeypot. The form is the disguise. Five fluff product
 * fields look like a real e-commerce checkout; the real input is the
 * `attribution` field at the bottom — that's the only value the server
 * stores (logged to CloudWatch by /api/leaderboard-entry).
 *
 * Submitting kicks off the bot-buster verdict reveal. Bots that fill
 * the form get scored AND entered on the leaderboard with whatever
 * handle they supply. Bots that submit empty still see the verdict
 * but won't be reachable for the prize.
 *
 * Visual: a deliberately mainstream-looking white card embedded in the
 * site's CRT-green theme. The contrast IS the joke — you clicked a
 * BOT-BUSTER tile expecting a scan, and you got dropped into what
 * looks like a Stripe checkout.
 */

export interface CheckoutPayload {
  /** Free-text contact for the leaderboard — email, handle, BTC addr, anything.
   *  Empty string when the user opted out. */
  attribution: string;
  /** Pure fluff — not validated, not stored. Captured for symmetry. */
  quantity: number;
  tier: string;
  size: string;
  addons: { expedited: boolean; giftWrap: boolean; fraudShield: boolean };
  promo: string;
}

const TIERS = ['Standard', 'Pro', 'Premium', 'Legendary'] as const;
const SIZES = ['S', 'M', 'L', 'XL', 'XXL'] as const;

export function CheckoutForm({
  onSubmit,
}: {
  onSubmit: (payload: CheckoutPayload) => void;
}): ReactElement {
  const [quantity, setQuantity] = useState(1);
  const [tier, setTier] = useState<(typeof TIERS)[number]>('Standard');
  const [size, setSize] = useState<(typeof SIZES)[number]>('M');
  const [expedited, setExpedited] = useState(false);
  const [giftWrap, setGiftWrap] = useState(false);
  const [fraudShield, setFraudShield] = useState(true);
  const [promo, setPromo] = useState('');
  const [attribution, setAttribution] = useState('');

  const submit = () => {
    onSubmit({
      attribution: attribution.trim(),
      quantity,
      tier,
      size,
      addons: { expedited, giftWrap, fraudShield },
      promo: promo.trim(),
    });
  };

  return (
    <div
      className="mt-6 rounded-md p-5 sm:p-7"
      style={{
        // White card on the dark CRT page. The mismatch is intentional.
        background: '#ffffff',
        color: '#111827',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(15, 42, 24, 0.6)',
      }}
    >
      <div className="flex items-center justify-between" style={{ marginBottom: '1rem' }}>
        <div>
          <div style={{ fontSize: '0.75rem', color: '#6b7280', letterSpacing: '0.1em' }}>
            SECURE CHECKOUT
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: 600 }}>Bot Detector Bypass Kit</div>
        </div>
        <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>v0.1 · digital good · $0.00</div>
      </div>

      <div
        style={{
          borderTop: '1px solid #e5e7eb',
          borderBottom: '1px solid #e5e7eb',
          padding: '0.75rem 0',
          fontSize: '0.875rem',
          color: '#4b5563',
        }}
      >
        A non-fungible artifact of your visit. Includes verdict scorecard, leaderboard
        eligibility, and the satisfaction of being benchmarked.
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="mt-4 space-y-4"
      >
        {/* Field 1: Quantity */}
        <Row label="Quantity">
          <input
            type="number"
            min={1}
            max={99}
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, Math.min(99, Number(e.target.value) || 1)))}
            style={inputStyle}
          />
        </Row>

        {/* Field 2: Tier */}
        <Row label="Tier">
          <select value={tier} onChange={(e) => setTier(e.target.value as (typeof TIERS)[number])} style={selectStyle}>
            {TIERS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </Row>

        {/* Field 3: Size */}
        <Row label="Size">
          <div className="flex flex-wrap gap-2">
            {SIZES.map((s) => (
              <label key={s} style={radioLabelStyle(size === s)}>
                <input
                  type="radio"
                  name="size"
                  value={s}
                  checked={size === s}
                  onChange={() => setSize(s)}
                  style={{ display: 'none' }}
                />
                {s}
              </label>
            ))}
          </div>
        </Row>

        {/* Field 4: Add-ons */}
        <Row label="Add-ons">
          <div className="space-y-1">
            <Check label="Expedited handling (+$0.00)" checked={expedited} onChange={setExpedited} />
            <Check label="Gift wrap (+$0.00)" checked={giftWrap} onChange={setGiftWrap} />
            <Check
              label="Anti-bot fraud screening (already included, free)"
              checked={fraudShield}
              onChange={setFraudShield}
            />
          </div>
        </Row>

        {/* Field 5: Promo code */}
        <Row label="Promo code">
          <input
            type="text"
            value={promo}
            onChange={(e) => setPromo(e.target.value)}
            placeholder="optional"
            maxLength={32}
            style={inputStyle}
          />
        </Row>

        {/* Divider before the one real field */}
        <div
          style={{
            margin: '1.5rem 0 1rem',
            borderTop: '1px dashed #d1d5db',
            paddingTop: '1rem',
          }}
        >
          <Row label="Leaderboard handle">
            <input
              type="text"
              value={attribution}
              onChange={(e) => setAttribution(e.target.value)}
              placeholder="email, @handle, BTC address — your call"
              maxLength={200}
              style={inputStyle}
              autoComplete="off"
            />
          </Row>
          <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.5rem' }}>
            Optional. Only field we keep. If you crack all five detectors, this is how we
            reach you about the bounty.
          </div>
        </div>

        <button type="submit" style={submitButtonStyle}>
          Place Order →
        </button>

        <div style={{ fontSize: '0.72rem', color: '#9ca3af', textAlign: 'center', marginTop: '0.5rem' }}>
          Submitting reveals your bot-detection scorecard.
        </div>
      </form>
    </div>
  );
}

// ── styling helpers — kept inline so this drops in without touching tailwind ──

const inputStyle: CSSProperties = {
  width: '100%',
  padding: '0.5rem 0.75rem',
  fontSize: '0.875rem',
  border: '1px solid #d1d5db',
  borderRadius: '4px',
  background: '#ffffff',
  color: '#111827',
  outline: 'none',
};

const selectStyle: CSSProperties = { ...inputStyle, cursor: 'pointer' };

const submitButtonStyle: CSSProperties = {
  width: '100%',
  padding: '0.75rem 1rem',
  fontSize: '0.95rem',
  fontWeight: 600,
  background: '#1f2937',
  color: '#ffffff',
  border: 'none',
  borderRadius: '4px',
  cursor: 'pointer',
  letterSpacing: '0.02em',
  marginTop: '0.5rem',
};

function radioLabelStyle(active: boolean): CSSProperties {
  return {
    display: 'inline-block',
    padding: '0.35rem 0.75rem',
    fontSize: '0.875rem',
    border: `1px solid ${active ? '#1f2937' : '#d1d5db'}`,
    borderRadius: '4px',
    background: active ? '#1f2937' : '#ffffff',
    color: active ? '#ffffff' : '#374151',
    cursor: 'pointer',
    minWidth: '2.5rem',
    textAlign: 'center' as const,
    userSelect: 'none' as const,
  };
}

function Row({ label, children }: { label: string; children: ReactElement | ReactElement[] }) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:gap-4">
      <label
        style={{
          flexShrink: 0,
          width: '8rem',
          fontSize: '0.875rem',
          color: '#374151',
          paddingTop: '0.5rem',
        }}
      >
        {label}
      </label>
      <div className="flex-1">{children}</div>
    </div>
  );
}

function Check({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        fontSize: '0.875rem',
        color: '#374151',
        cursor: 'pointer',
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ width: '1rem', height: '1rem', cursor: 'pointer' }}
      />
      {label}
    </label>
  );
}
