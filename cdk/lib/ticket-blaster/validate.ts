import {
  HONEYPOT_NAMES,
  REQUIRED_FIELDS,
  EMAIL_FIELDS,
  ONES_CARD_FIELDS,
  ONES_CVV_FIELDS,
} from './fields';
import type { SessionRecord, PurchaseRequest } from './types';

interface ValidationResult {
  valid: boolean;
  error?: string;
}

export function validateHoneypots(fields: Record<string, string | boolean>): ValidationResult {
  for (const name of HONEYPOT_NAMES) {
    const val = fields[name];
    if (val !== undefined && val !== '' && val !== false) {
      return { valid: false, error: 'Invalid submission' };
    }
  }
  return { valid: true };
}

export function validateRequiredFields(fields: Record<string, string | boolean>): ValidationResult {
  for (const name of REQUIRED_FIELDS) {
    const val = fields[name];
    if (val === undefined || val === '' || val === false) {
      return { valid: false, error: 'All required fields must be completed' };
    }
  }
  return { valid: true };
}

export function validateFormats(fields: Record<string, string | boolean>): ValidationResult {
  for (const [name, val] of Object.entries(fields)) {
    if (typeof val !== 'string' || val === '') continue;
    if (HONEYPOT_NAMES.has(name)) continue;

    if (EMAIL_FIELDS.has(name) && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(val)) {
      return { valid: false, error: 'Invalid email address' };
    }
    if (ONES_CARD_FIELDS.has(name) && !/^1{16}$/.test(val)) {
      return { valid: false, error: 'Card number must be exactly 16 ones' };
    }
    if (ONES_CVV_FIELDS.has(name) && !/^1{3}$/.test(val)) {
      return { valid: false, error: 'CVV must be exactly 3 ones' };
    }
  }
  return { valid: true };
}

export function validateTiming(session: SessionRecord): ValidationResult {
  const elapsed = Date.now() - session.createdAt;
  if (elapsed < 3000) {
    return { valid: false, error: 'Please take your time filling out the form' };
  }
  return { valid: true };
}

export function validatePurchaseFields(
  request: PurchaseRequest,
  session: SessionRecord
): ValidationResult {
  const checks = [
    validateHoneypots(request.fields),
    validateRequiredFields(request.fields),
    validateFormats(request.fields),
    validateTiming(session),
  ];
  for (const check of checks) {
    if (!check.valid) return check;
  }
  return { valid: true };
}
