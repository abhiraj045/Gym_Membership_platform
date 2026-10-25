const { z } = require('zod');
const { isValidDate } = require('../utils/dates');

const date = z.string().refine(isValidDate, 'Use a valid date in YYYY-MM-DD format');
const id = z.coerce.number().int().positive();
const money = z.union([z.string(), z.number()]).transform(String)
  .refine((v) => /^\d{1,8}(\.\d{1,2})?$/.test(v), 'Enter a valid amount (max 2 decimals)');
const positiveMoney = money.refine((v) => Number(v) > 0, 'Amount must be greater than zero');
const phone = z.string().trim().regex(/^[0-9+\-\s]{7,20}$/, 'Enter a valid phone number');
const optionalEmail = z.union([z.literal(''), z.string().trim().email().max(255)]).nullish()
  .transform((v) => (v ? v : null));

const login = z.object({ email: z.string().trim().email(), password: z.string().min(1).max(200) });

const userCreate = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(255),
  password: z.string().min(10, 'Password must be at least 10 characters').max(200),
});
const userUpdate = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  is_active: z.boolean().optional(),
  password: z.string().min(10).max(200).optional(),
});

const memberBody = z.object({
  full_name: z.string().trim().min(2).max(100),
  phone,
  email: optionalEmail,
  joining_date: date.optional(),
  notes: z.string().trim().max(1000).nullish().transform((v) => v || null),
});

const memberList = z.object({
  q: z.string().trim().max(100).optional(),
  status: z.enum(['active', 'inactive']).optional(),
  overdue: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const planBody = z.object({
  name: z.string().trim().min(2).max(100),
  duration_months: z.coerce.number().int().min(1).max(60),
  default_price: money,
  is_active: z.boolean().optional(),
});

const membershipCreate = z.object({
  plan_id: id,
  start_date: date,
  term_months: z.coerce.number().int().min(1).max(60).optional(),
  billing_period_months: z.coerce.number().int().min(1).max(60).optional(),
  price_per_period: money.optional(),
});
const membershipRenew = z.object({ price_per_period: money.optional() });

const paymentCreate = z.object({
  member_id: id,
  amount: positiveMoney,
  paid_on: date.optional(),
  method: z.enum(['cash', 'upi', 'card', 'bank_transfer', 'other']),
  reference_no: z.string().trim().max(100).nullish().transform((v) => v || null),
  billing_period_id: id.optional(),
  notes: z.string().trim().max(500).nullish().transform((v) => v || null),
  allow_duplicate: z.boolean().optional(),
});
const paymentVoid = z.object({ reason: z.string().trim().min(5, 'Give a reason (min 5 characters)').max(500) });
const paymentList = z.object({
  member_id: id.optional(),
  from: date.optional(),
  to: date.optional(),
  method: z.enum(['cash', 'upi', 'card', 'bank_transfer', 'other']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const reminderSettings = z.object({
  days_before: z.array(z.number().int().min(0).max(60)).max(10),
  days_after: z.array(z.number().int().min(1).max(120)).max(10),
  send_owner_summary: z.boolean(),
});

const pageQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
const daysQuery = z.object({ days: z.coerce.number().int().min(1).max(90).default(14) });

module.exports = {
  login, userCreate, userUpdate, memberBody, memberList, planBody,
  membershipCreate, membershipRenew, paymentCreate, paymentVoid, paymentList,
  reminderSettings, pageQuery, daysQuery,
};
