const router = require('express').Router();
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../middleware/validate');
const { authenticate, requireRole } = require('../middleware/auth');
const plans = require('../services/planService');
const schemas = require('../validators/schemas');

router.use(authenticate);

router.get('/', asyncHandler(async (req, res) =>
  res.json({ data: await plans.list({ onlyActive: req.user.role !== 'owner' }) })));
router.post('/', requireRole('owner'), validate(schemas.planBody), asyncHandler(async (req, res) =>
  res.status(201).json(await plans.create(req.body, req.ctx))));
router.put('/:id', requireRole('owner'), validate(schemas.planBody), asyncHandler(async (req, res) =>
  res.json(await plans.update(Number(req.params.id), req.body, req.ctx))));

module.exports = router;
