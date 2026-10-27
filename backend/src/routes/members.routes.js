const router = require('express').Router();
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../middleware/validate');
const { authenticate, requireRole } = require('../middleware/auth');
const members = require('../services/memberService');
const memberships = require('../services/membershipService');
const schemas = require('../validators/schemas');

router.use(authenticate);

router.get('/', validate(schemas.memberList, 'query'), asyncHandler(async (req, res) =>
  res.json(await members.list(req.valid.query))));

// Declared before '/:id' so "export.csv" is not treated as an id.
router.get('/export.csv', requireRole('owner'), asyncHandler(async (req, res) => {
  res.type('text/csv').attachment('members.csv').send(await members.exportCsv());
}));

router.post('/', validate(schemas.memberBody), asyncHandler(async (req, res) =>
  res.status(201).json(await members.create(req.body, req.ctx))));
router.get('/:id', asyncHandler(async (req, res) => res.json(await members.getDetail(Number(req.params.id)))));
router.put('/:id', validate(schemas.memberBody), asyncHandler(async (req, res) =>
  res.json(await members.update(Number(req.params.id), req.body, req.ctx))));
router.post('/:id/deactivate', requireRole('owner'), asyncHandler(async (req, res) =>
  res.json(await members.setStatus(Number(req.params.id), 'inactive', req.ctx))));
router.post('/:id/activate', requireRole('owner'), asyncHandler(async (req, res) =>
  res.json(await members.setStatus(Number(req.params.id), 'active', req.ctx))));
router.delete('/:id', requireRole('owner'), asyncHandler(async (req, res) =>
  res.json(await members.remove(Number(req.params.id), req.ctx))));
router.post('/:id/memberships', validate(schemas.membershipCreate), asyncHandler(async (req, res) =>
  res.status(201).json(await memberships.create(Number(req.params.id), req.body, req.ctx))));

module.exports = router;