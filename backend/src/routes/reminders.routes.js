const router = require('express').Router();
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../middleware/validate');
const { authenticate, requireRole } = require('../middleware/auth');
const reminders = require('../services/reminderService');
const schemas = require('../validators/schemas');

router.use(authenticate, requireRole('owner'));

router.get('/settings', asyncHandler(async (req, res) => res.json(await reminders.getSettings())));
router.put('/settings', validate(schemas.reminderSettings), asyncHandler(async (req, res) =>
  res.json(await reminders.updateSettings(req.body, req.ctx))));
router.post('/run', asyncHandler(async (req, res) => res.json(await reminders.run())));
router.get('/notifications', validate(schemas.pageQuery, 'query'), asyncHandler(async (req, res) =>
  res.json(await reminders.listNotifications(req.valid.query))));

module.exports = router;
