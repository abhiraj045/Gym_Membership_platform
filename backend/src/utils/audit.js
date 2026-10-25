// Writes an audit row. `db` can be the pool or a transaction client,
// so the audit entry commits/rolls back together with the change itself.
async function audit(db, ctx, { action, entityType, entityId, oldValues = null, newValues = null }) {
  await db.query(
    `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_values, new_values, ip)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      ctx.userId || null,
      action,
      entityType,
      entityId == null ? null : String(entityId),
      oldValues ? JSON.stringify(oldValues) : null,
      newValues ? JSON.stringify(newValues) : null,
      ctx.ip || null,
    ]
  );
}

module.exports = { audit };
