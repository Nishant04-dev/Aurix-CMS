export interface Currency {
  code: string;
  symbol: string;
  name: string;
  locale: string;
}

export const SUPPORTED_CURRENCIES: Currency[] = [
  { code: 'USD', symbol: '$',    name: 'US Dollar',       locale: 'en-US' },
  { code: 'INR', symbol: '₹',   name: 'Indian Rupee',    locale: 'en-IN' },
  { code: 'EUR', symbol: '€',   name: 'Euro',            locale: 'de-DE' },
  { code: 'GBP', symbol: '£',   name: 'British Pound',   locale: 'en-GB' },
  { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham',      locale: 'ar-AE' },
  { code: 'CAD', symbol: 'CA$', name: 'Canadian Dollar',  locale: 'en-CA' },
  { code: 'AUD', symbol: 'A$',  name: 'Australian Dollar',locale: 'en-AU' },
  { code: 'SGD', symbol: 'S$',  name: 'Singapore Dollar', locale: 'en-SG' },
  { code: 'JPY', symbol: '¥',   name: 'Japanese Yen',    locale: 'ja-JP' },
];

export function getCurrency(code: string): Currency {
  return SUPPORTED_CURRENCIES.find(c => c.code === code) ?? SUPPORTED_CURRENCIES[0];
}

/**
 * Format an amount with the correct currency symbol and locale.
 * Uses Intl.NumberFormat for proper locale-aware formatting.
 */
export function formatCurrency(amount: number, currencyCode: string = 'USD'): string {
  const currency = getCurrency(currencyCode);
  try {
    return new Intl.NumberFormat(currency.locale, {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: currencyCode === 'JPY' ? 0 : 2,
      maximumFractionDigits: currencyCode === 'JPY' ? 0 : 2,
    }).format(amount);
  } catch {
    // Fallback for unsupported locales
    return `${currency.symbol}${amount.toLocaleString()}`;
  }
}

/**
 * Format a compact amount (e.g. ₹8.2K, $1.2M)
 */
export function formatCurrencyCompact(amount: number, currencyCode: string = 'USD'): string {
  const currency = getCurrency(currencyCode);
  if (amount >= 1_000_000) return `${currency.symbol}${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000)     return `${currency.symbol}${(amount / 1_000).toFixed(1)}K`;
  return formatCurrency(amount, currencyCode);
}
