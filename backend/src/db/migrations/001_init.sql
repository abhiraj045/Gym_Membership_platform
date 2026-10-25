-- Active: 1792866429481@@127.0.0.1@5432@gym_db
-- Gym Membership & Fee Management: initial schema

CREATE TABLE users (
  id              BIGSERIAL PRIMARY KEY,
  name            VARCHAR(100) NOT NULL,
  email           VARCHAR(255) NOT NULL,
  password_hash   TEXT NOT NULL,
  role            VARCHAR(10) NOT NULL CHECK (role IN ('owner', 'staff')),
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  failed_attempts INT NOT NULL DEFAULT 0,
  locked_until    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX users_email_uq ON users (lower(email));

CREATE -SUENCE member_code_seq;
CREATE TABLE members (
  id           BIGSERIAL PRIMARY KEY,
  member_code  VARCHAR(20) NOT NULL UNIQUE
               DEFAULT ('GYM-' || lpad(nextval('member_code_seq')::text, 5, '0')),
  full_name    VARCHAR(100) NOT NULL,
  phone        VARCHAR(20) NOT NULL,
  email        VARCHAR(255),
  joining_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status       VARCHAR(10) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  notes        TEXT,
  created_by   BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX members_name_idx   ON members (lower(full_name));
CREATE INDEX members_phone_idx  ON members (phone);
CREATE INDEX members_status_idx ON members (status);

CREATE TABLE membership_plans (
  id              BIGSERIAL PRIMARY KEY,
  name            VARCHAR(100) NOT NULL UNIQUE,
  duration_months INT NOT NULL CHECK (duration_months > 0),
  default_price   NUMERIC(10,2) NOT NULL CHECK (default_price >= 0),
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- A member's agreement: which plan, for how long, at what (possibly custom) price per billing period.
CREATE TABLE member_memberships (
  id                     BIGSERIAL PRIMARY KEY,
  member_id              BIGINT NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
  plan_id                BIGINT NOT NULL REFERENCES membership_plans(id) ON DELETE RESTRICT,
  start_date             DATE NOT NULL,
  end_date               DATE NOT NULL,
  term_months            INT NOT NULL CHECK (term_months > 0),
  billing_period_months  INT NOT NULL CHECK (billing_period_months > 0),
  price_per_period       NUMERIC(10,2) NOT NULL CHECK (price_per_period >= 0),
  status                 VARCHAR(10) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled')),
  created_by             BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_date > start_date)
);
CREATE INDEX memberships_member_idx ON member_memberships (member_id);

-- Fee obligations. amount_due is a SNAPSHOT: later price changes never rewrite history.
CREATE TABLE billing_periods (
  id            BIGSERIAL PRIMARY KEY,
  membership_id BIGINT NOT NULL REFERENCES member_memberships(id) ON DELETE RESTRICT,
  period_start  DATE NOT NULL,
  period_end    DATE NOT NULL,
  due_date      DATE NOT NULL,
  amount_due    NUMERIC(10,2) NOT NULL CHECK (amount_due >= 0),
  UNIQUE (membership_id, period_start)
);
CREATE INDEX billing_due_idx        ON billing_periods (due_date);
CREATE INDEX billing_membership_idx ON billing_periods (membership_id);

CREATE TABLE payments (
  id           BIGSERIAL PRIMARY KEY,
  member_id    BIGINT NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
  amount       NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  paid_on      DATE NOT NULL,
  method       VARCHAR(20) NOT NULL CHECK (method IN ('cash', 'upi', 'card', 'bank_transfer', 'other')),
  reference_no VARCHAR(100),
  notes        TEXT,
  received_by  BIGINT REFERENCES users(id) ON DELETE SET NULL,
  is_void      BOOLEAN NOT NULL DEFAULT FALSE,
  void_reason  TEXT,
  voided_by    BIGINT REFERENCES users(id) ON DELETE SET NULL,
  voided_at    TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX payments_member_idx ON payments (member_id);
CREATE INDEX payments_paid_on_idx ON payments (paid_on);
-- Same reference number cannot be recorded twice for a member (voided payments are ignored).
CREATE UNIQUE INDEX payments_reference_uq ON payments (member_id, reference_no)
  WHERE reference_no IS NOT NULL AND is_void = FALSE;

-- One payment can be split across several billing periods; one period can receive several payments.
CREATE TABLE payment_allocations (
  id                BIGSERIAL PRIMARY KEY,
  payment_id        BIGINT NOT NULL REFERENCES payments(id) ON DELETE RESTRICT,
  billing_period_id BIGINT NOT NULL REFERENCES billing_periods(id) ON DELETE RESTRICT,
  amount            NUMERIC(10,2) NOT NULL CHECK (amount > 0)
);
CREATE INDEX alloc_payment_idx ON payment_allocations (payment_id);
CREATE INDEX alloc_period_idx  ON payment_allocations (billing_period_id);

CREATE TABLE notifications (
  id                BIGSERIAL PRIMARY KEY,
  member_id         BIGINT REFERENCES members(id) ON DELETE SET NULL,
  billing_period_id BIGINT REFERENCES billing_periods(id) ON DELETE SET NULL,
  type              VARCHAR(20) NOT NULL CHECK (type IN ('upcoming', 'overdue', 'owner_summary')),
  recipient         VARCHAR(255) NOT NULL,
  scheduled_for     DATE NOT NULL,
  status            VARCHAR(10) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  sent_at           TIMESTAMPTZ,
  error_message     TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- These two indexes are what make "no duplicate reminders" a database guarantee.
CREATE UNIQUE INDEX notif_dedupe_uq ON notifications (billing_period_id, type, scheduled_for)
  WHERE billing_period_id IS NOT NULL;
CREATE UNIQUE INDEX notif_owner_dedupe_uq ON notifications (type, scheduled_for, recipient)
  WHERE type = 'owner_summary';
CREATE INDEX notif_created_idx ON notifications (created_at DESC);

CREATE TABLE reminder_settings (
  id                  SMALLINT PRIMARY KEY CHECK (id = 1),
  days_before         INT[] NOT NULL DEFAULT '{7,3,1}',
  days_after          INT[] NOT NULL DEFAULT '{1,7,14}',
  send_owner_summary  BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO reminder_settings (id) VALUES (1);

CREATE TABLE audit_logs (
  id          BIGSERIAL PRIMARY KEY,
  user_id     BIGINT REFERENCES users(id) ON DELETE SET NULL,
  action      VARCHAR(60) NOT NULL,
  entity_type VARCHAR(40) NOT NULL,
  entity_id   VARCHAR(40),
  old_values  JSONB,
  new_values  JSONB,
  ip          VARCHAR(64),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX audit_entity_idx  ON audit_logs (entity_type, entity_id);
CREATE INDEX audit_created_idx ON audit_logs (created_at DESC);

-- Balance is always CALCULATED, never typed in: balance = amount_due - non-void allocations.
CREATE VIEW v_billing_balances AS
SELECT
  bp.id            AS billing_period_id,
  bp.membership_id,
  mm.member_id,
  mm.status        AS membership_status,
  bp.period_start,
  bp.period_end,
  bp.due_date,
  bp.amount_due,
  COALESCE(SUM(pa.amount) FILTER (WHERE p.is_void = FALSE), 0)::numeric(10,2) AS amount_paid,
  (bp.amount_due - COALESCE(SUM(pa.amount) FILTER (WHERE p.is_void = FALSE), 0))::numeric(10,2) AS balance,
  CASE
    WHEN bp.amount_due - COALESCE(SUM(pa.amount) FILTER (WHERE p.is_void = FALSE), 0) <= 0 THEN 'paid'
    WHEN COALESCE(SUM(pa.amount) FILTER (WHERE p.is_void = FALSE), 0) > 0 THEN 'partial'
    ELSE 'unpaid'
  END AS payment_status
FROM billing_periods bp
JOIN member_memberships mm ON mm.id = bp.membership_id
LEFT JOIN payment_allocations pa ON pa.billing_period_id = bp.id
LEFT JOIN payments p ON p.id = pa.payment_id
GROUP BY bp.id, mm.id;

-- testing below...

SELECT current_database(), current_schema();

SELECT to_regclass('public.users');


SELECT
    n.nspname AS schema_name,
    c.relname AS object_name,
    c.relkind AS object_type
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE lower(c.relname) = 'users';

SELECT COUNT(*) AS users_found
FROM pg_tables
WHERE tablename = 'users';