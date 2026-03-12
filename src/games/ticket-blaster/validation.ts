/** Basic email format check */
export function isValidEmail(val: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(val);
}

/** Card number must be exactly 16 ones */
export function isCardOnes(val: string): boolean {
  return /^1{16}$/.test(val);
}

/** CVV must be exactly 3 ones */
export function isCvvOnes(val: string): boolean {
  return /^1{3}$/.test(val);
}

/** Get validation error for a field, or null if valid */
export function getFieldError(value: string, validation: string | undefined): string | null {
  if (!value || !validation) return null;

  switch (validation) {
    case 'email':
      return isValidEmail(value) ? null : 'Enter a valid email address';
    case 'card-ones':
      return isCardOnes(value) ? null : 'Must be exactly 16 ones';
    case 'cvv-ones':
      return isCvvOnes(value) ? null : 'Must be exactly 3 ones';
    default:
      return null;
  }
}
