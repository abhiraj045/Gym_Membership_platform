const router = require('express').Router();
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../middleware/validate');
const { authenticate, requireRole } = require('../middleware/auth');
const users = require('../services/userService');
const schemas = require('../validators/schemas');

router.use(authenticate, requireRole('owner'));

router.get('/', asyncHandler(async (req, res) => res.json({ data: await users.list() })));
router.post('/', validate(schemas.userCreate), asyncHandler(async (req, res) =>
  res.status(201).json(await users.createStaff(req.body, req.ctx))));
router.put('/:id', validate(schemas.userUpdate), asyncHandler(async (req, res) =>
  res.json(await users.update(Number(req.params.id), req.body, req.ctx))));

router.delete('/:id', asyncHandler(async (req, res) =>
  res.json(await users.remove(Number(req.params.id), req.ctx))));

module.exports = router;