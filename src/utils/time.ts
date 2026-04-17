import { toFiniteNumber } from './guards.js';

export const toIsoDateTime = (value: unknown): string | undefined => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return undefined;

    const asNumber = toFiniteNumber(trimmed);
    if (asNumber !== undefined) return toIsoDateTime(asNumber);

    const parsedDate = new Date(trimmed);
    if (Number.isNaN(parsedDate.getTime())) return undefined;
    return parsedDate.toISOString();
  }

  const numeric = toFiniteNumber(value);
  if (numeric === undefined) return undefined;

  const millis = numeric > 10_000_000_000 ? numeric : numeric * 1000;
  const date = new Date(millis);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
};
