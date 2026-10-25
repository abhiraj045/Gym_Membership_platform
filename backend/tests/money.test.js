const test = require('node:test');
const assert = require('node:assert/strict');
const { toCents, fromCents } = require('../src/utils/money');

test('toCents parses exact decimals without float error', () => {
  assert.equal(toCents('0.10'), 10);
  assert.equal(toCents('1999.99'), 199999);
  assert.equal(toCents('5'), 500);
  assert.equal(toCents('5.5'), 550);
});
test('toCents rejects junk', () => {
  assert.throws(() => toCents('12.345'));
  assert.throws(() => toCents('abc'));
});
test('fromCents formats back', () => {
  assert.equal(fromCents(199999), '1999.99');
  assert.equal(fromCents(5), '0.05');
  assert.equal(fromCents(0), '0.00');
});
test('0.1 + 0.2 style sums stay exact in cents', () => {
  assert.equal(fromCents(toCents('0.10') + toCents('0.20')), '0.30');
});
