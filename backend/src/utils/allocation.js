// Pure function: decide how a payment is split across unpaid billing periods.
// `periods` must already be sorted oldest-due first. Amounts are integer cents.
// If preferredId is given, that period is filled first, then the rest oldest-first.
function allocate(amountCents, periods, preferredId = null) {
  const ordered = periods.filter((p) => p.balanceCents > 0);
  if (preferredId != null) {
    const i = ordered.findIndex((p) => String(p.id) === String(preferredId));
    if (i > 0) ordered.unshift(...ordered.splice(i, 1));
  }
  let remaining = amountCents;
  const allocations = [];
  for (const p of ordered) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, p.balanceCents);
    allocations.push({ billing_period_id: p.id, cents: take });
    remaining -= take;
  }
  return { allocations, remainderCents: remaining };
}

module.exports = { allocate };
