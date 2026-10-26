import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isValidDisplayQuantity, stockShortage } from './display-quantity';

test('zero stock blocks stock out even when the input was clamped to zero', () => {
  assert.match(stockShortage('OUT', 0, '0', 'PCS')!, /Insufficient stock/);
  assert.match(stockShortage('OUT', 1, '0', 'PCS')!, /required quantity 1 PCS/);
});
test('shortage shows available and required whole-number quantities, and clears when enough stock exists', () => {
  assert.match(stockShortage('OUT', 3, '2', 'PCS')!, /available stock 2 PCS.*required quantity 3 PCS/);
  assert.equal(stockShortage('OUT', 2, '2', 'PCS'), null);
  assert.equal(stockShortage('OUT', 1, '2', 'PCS'), null);
  assert.equal(stockShortage('IN', 3, '0', 'PCS'), null);
});
test('quantity validation accepts positive whole numbers and rejects decimals and invalid values', () => {
  for (const value of [1, 2, 100]) assert.equal(isValidDisplayQuantity(value), true);
  for (const value of [undefined, null, '', '1', 0, -1, 0.01, 1.15, 2.5, NaN, Infinity]) assert.equal(isValidDisplayQuantity(value), false);
});
