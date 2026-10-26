export function isValidDisplayQuantity(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

export function formatDisplayQuantity(value: string | number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return "-";
  return Number(value).toFixed(0);
}

export function stockShortage(direction: string, quantity: unknown, balance: string | number | undefined, unit = ''): string | null {
  if (direction !== 'OUT' || balance === undefined) return null;
  const available = Number(balance);
  if (!Number.isFinite(available)) return 'Stock balance is unavailable. Verify the item again.';
  if (available <= 0 || (typeof quantity === 'number' && quantity > available)) {
    return `Insufficient stock: available stock ${formatDisplayQuantity(available)} ${unit} is less than the required quantity${typeof quantity === 'number' && quantity > 0 ? ` ${formatDisplayQuantity(quantity)} ${unit}` : ''}.`;
  }
  return null;
}
