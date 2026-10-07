import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isValidDisplayQuantity, stockShortage } from './display-quantity';

test('zero stock blocks stock out even when the input was clamped to zero', () => {
  assert.match(stockShortage('OUT', 0, '0', 'PCS')!, /Insufficient stock/);
  assert.match(stockShortage('OUT', 1, '0', 'PCS')!, /required quantity 1 PCS/);
});
test('shortage shows available and required quantity, and clears when enough stock exists', () => {
  assert.match(stockShortage('OUT', 3, '2.5', 'PCS')!, /available stock 2.5 PCS.*required quantity 3 PCS/);
  assert.equal(stockShortage('OUT', 2.5, '2.5', 'PCS'), null);
  assert.equal(stockShortage('OUT', 0.25, '2.5', 'PCS'), null);
  assert.equal(stockShortage('IN', 3, '0', 'PCS'), null);
});
test('quantity validation accepts two decimals and rejects empty, zero, negative, and excessive precision', () => {
  for (const value of [1, 0.01, 0.29, 1.15, 2.5]) assert.equal(isValidDisplayQuantity(value), true);
  for (const value of [undefined, null, '', '1', 0, -1, 0.001, 1.234, NaN, Infinity]) assert.equal(isValidDisplayQuantity(value), false);
});
