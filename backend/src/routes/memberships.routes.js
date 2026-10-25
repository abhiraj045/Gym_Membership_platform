const router = require('express').Router();
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../middleware/validate');
const { authenticate, requireRole } = require('../middleware/auth');
const memberships = require('../services/membershipService');
const schemas = require('../validators/schemas');

router.use(authenticate);

router.post('/:id/renew', validate(schemas.membershipRenew), asyncHandler(async (req, res) =>
  res.status(201).json(await memberships.renew(Number(req.params.id), req.body, req.ctx))));
router.post('/:id/cancel', requireRole('owner'), asyncHandler(async (req, res) =>
  res.json(await memberships.cancel(Number(req.params.id), req.ctx))));

module.exports = router;
