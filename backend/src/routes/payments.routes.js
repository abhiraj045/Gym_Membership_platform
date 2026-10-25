const router = require('express').Router();
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../middleware/validate');
const { authenticate, requireRole } = require('../middleware/auth');
const payments = require('../services/paymentService');
const schemas = require('../validators/schemas');

router.use(authenticate);

router.get('/', validate(schemas.paymentList, 'query'), asyncHandler(async (req, res) =>
  res.json(await payments.list(req.valid.query))));
router.get('/export.csv', requireRole('owner'), validate(schemas.paymentList, 'query'), asyncHandler(async (req, res) => {
  res.type('text/csv').attachment('payments.csv').send(await payments.exportCsv(req.valid.query));
}));
router.post('/', validate(schemas.paymentCreate), asyncHandler(async (req, res) =>
  res.status(201).json(await payments.create(req.body, req.ctx))));
router.post('/:id/void', requireRole('owner'), validate(schemas.paymentVoid), asyncHandler(async (req, res) =>
  res.json(await payments.voidPayment(Number(req.params.id), req.body.reason, req.ctx))));

module.exports = router;
