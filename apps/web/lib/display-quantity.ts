export function isValidDisplayQuantity(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= Number.MAX_SAFE_INTEGER && /^\d+(\.\d{1,2})?$/.test(String(value));
}

export function stockShortage(direction: string, quantity: unknown, balance: string | number | undefined, unit = ''): string | null {
  if (direction !== 'OUT' || balance === undefined) return null;
  const available = Number(balance);
  if (!Number.isFinite(available)) return 'Stock balance is unavailable. Verify the item again.';
  if (available <= 0 || (typeof quantity === 'number' && quantity > available)) {
    return `Insufficient stock: available stock ${available} ${unit} is less than the required quantity${typeof quantity === 'number' && quantity > 0 ? ` ${quantity} ${unit}` : ''}.`;
  }
  return null;
}
