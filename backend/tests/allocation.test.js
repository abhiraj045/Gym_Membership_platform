const test = require('node:test');
const assert = require('node:assert/strict');
const { allocate } = require('../src/utils/allocation');

const periods = [
  { id: 1, balanceCents: 50000 },
  { id: 2, balanceCents: 50000 },
  { id: 3, balanceCents: 50000 },
];

test('partial payment stays inside the oldest period', () => {
  const r = allocate(20000, periods);
  assert.deepEqual(r.allocations, [{ billing_period_id: 1, cents: 20000 }]);
  assert.equal(r.remainderCents, 0);
});
test('payment spills across periods oldest-first', () => {
  const r = allocate(120000, periods);
  assert.deepEqual(r.allocations.map((a) => a.cents), [50000, 50000, 20000]);
  assert.equal(r.remainderCents, 0);
});
test('preferred period is filled first', () => {
  const r = allocate(50000, periods, 3);
  assert.deepEqual(r.allocations, [{ billing_period_id: 3, cents: 50000 }]);
});
test('overpayment leaves a remainder (caller must reject it)', () => {
  const r = allocate(200000, periods);
  assert.equal(r.remainderCents, 50000);
});
test('fully paid periods are ignored', () => {
  const r = allocate(100, [{ id: 9, balanceCents: 0 }, { id: 10, balanceCents: 500 }]);
  assert.deepEqual(r.allocations, [{ billing_period_id: 10, cents: 100 }]);
});
