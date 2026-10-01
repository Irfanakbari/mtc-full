import { getDisplayNotes, getDisplayOperator } from './ledger-presentation';

describe('stock transaction actor presentation', () => {
  it('extracts the display operator and removes the metadata prefix from notes', () => {
    const notes = '[Display operator: wissa] Scanner-first operator display transaction';

    expect(getDisplayOperator(notes)).toBe('wissa');
    expect(getDisplayNotes(notes)).toBe('Scanner-first operator display transaction');
  });

  it('keeps ordinary admin notes unchanged', () => {
    expect(getDisplayOperator('Manual warehouse issue')).toBeNull();
    expect(getDisplayNotes('Manual warehouse issue')).toBe('Manual warehouse issue');
  });
});
