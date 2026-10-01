import { requestHash } from './request-hash';

describe('requestHash', () => {
  it('is stable when object keys have a different insertion order', () => {
    expect(requestHash({ quantity: 2, itemId: 'A', notes: { b: 2, a: 1 } }))
      .toBe(requestHash({ notes: { a: 1, b: 2 }, itemId: 'A', quantity: 2 }));
  });

  it('changes when a stock command payload changes', () => {
    expect(requestHash({ itemId: 'A', quantity: 2 })).not.toBe(requestHash({ itemId: 'A', quantity: 3 }));
  });
});
