const router = require('express').Router();
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../middleware/validate');
const { authenticate, requireRole } = require('../middleware/auth');
const dashboard = require('../services/dashboardService');
const db = require('../config/db');
const schemas = require('../validators/schemas');

router.use(authenticate);

router.get('/dashboard', asyncHandler(async (req, res) => res.json(await dashboard.overview())));
router.get('/monthly-collections', asyncHandler(async (req, res) =>
  res.json({ data: await dashboard.monthlyCollections(12) })));
router.get('/overdue', asyncHandler(async (req, res) => res.json({ data: await dashboard.overdueList() })));
router.get('/overdue.csv', requireRole('owner'), asyncHandler(async (req, res) => {
  res.type('text/csv').attachment('overdue.csv').send(await dashboard.overdueCsv());
}));
router.get('/expiring', validate(schemas.daysQuery, 'query'), asyncHandler(async (req, res) =>
  res.json({ data: await dashboard.expiringList(req.valid.query.days) })));

router.get('/audit-logs', requireRole('owner'), validate(schemas.pageQuery, 'query'), asyncHandler(async (req, res) => {
  const { page, limit } = req.valid.query;
  const { rows } = await db.query(
    `SELECT a.*, u.name AS user_name FROM audit_logs a LEFT JOIN users u ON u.id = a.user_id
     ORDER BY a.created_at DESC, a.id DESC LIMIT $1 OFFSET $2`, [limit, (page - 1) * limit]);
  res.json({ data: rows, pagination: { page, limit } });
}));

module.exports = router;
