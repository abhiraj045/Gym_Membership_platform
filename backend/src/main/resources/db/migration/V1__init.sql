create table app_user (
    id            bigserial primary key,
    username      varchar(50)  not null unique,
    full_name     varchar(100) not null,
    email         varchar(150),
    password_hash varchar(100) not null,
    role          varchar(20)  not null check (role in ('OWNER','STAFF')),
    active        boolean      not null default true,
    created_at    timestamptz  not null default now()
);

create table member (
    id           bigserial primary key,
    full_name    varchar(100) not null,
    phone        varchar(20)  not null,
    email        varchar(150),
    joining_date date         not null,
    status       varchar(20)  not null default 'ACTIVE' check (status in ('ACTIVE','INACTIVE')),
    notes        varchar(500),
    created_at   timestamptz  not null default now()
);
create unique index uq_member_phone on member (phone);
create index idx_member_name on member (lower(full_name));

create table membership_plan (
    id              bigserial primary key,
    name            varchar(50)    not null unique,
    duration_months int            not null check (duration_months > 0),
    default_fee     numeric(12,2)  not null check (default_fee >= 0),
    active          boolean        not null default true
);
insert into membership_plan (name, duration_months, default_fee) values
    ('Monthly', 1, 1000.00),
    ('Six-Monthly', 6, 5500.00),
    ('Yearly', 12, 10000.00);

create table member_membership (
    id             bigserial primary key,
    member_id      bigint        not null references member(id),
    plan_id        bigint        references membership_plan(id),
    billing_months int           not null check (billing_months > 0),
    fee            numeric(12,2) not null check (fee >= 0),
    start_date     date          not null,
    status         varchar(20)   not null default 'ACTIVE' check (status in ('ACTIVE','CANCELLED')),
    created_at     timestamptz   not null default now()
);
create index idx_membership_member on member_membership(member_id);
create unique index uq_one_active_membership on member_membership(member_id) where status = 'ACTIVE';

create table fee_obligation (
    id            bigserial primary key,
    membership_id bigint        not null references member_membership(id),
    member_id     bigint        not null references member(id),
    period_start  date          not null,
    period_end    date          not null,
    due_date      date          not null,
    amount        numeric(12,2) not null check (amount >= 0),
    created_at    timestamptz   not null default now(),
    constraint uq_obligation_period unique (membership_id, period_start)
);
create index idx_obligation_member on fee_obligation(member_id);
create index idx_obligation_due on fee_obligation(due_date);

create table payment (
    id                  bigserial primary key,
    obligation_id       bigint        not null references fee_obligation(id),
    amount              numeric(12,2) not null check (amount <> 0),
    paid_on             date          not null,
    method              varchar(20)   not null,
    reference           varchar(100),
    reverses_payment_id bigint        unique references payment(id),
    note                varchar(255),
    recorded_by         varchar(50)   not null,
    created_at          timestamptz   not null default now()
);
create unique index uq_payment_reference on payment(reference) where reference is not null;
create index idx_payment_obligation on payment(obligation_id);
create index idx_payment_paid_on on payment(paid_on);

create table notification (
    id            bigserial primary key,
    type          varchar(30)  not null,
    dedupe_key    varchar(150) not null unique,
    obligation_id bigint       references fee_obligation(id),
    member_id     bigint       references member(id),
    recipient     varchar(150) not null,
    subject       varchar(200) not null,
    status        varchar(20)  not null check (status in ('PENDING','SENT','FAILED')),
    error         varchar(500),
    attempts      int          not null default 0,
    created_at    timestamptz  not null default now(),
    sent_at       timestamptz
);
create index idx_notification_created on notification(created_at desc);

create table audit_log (
    id          bigserial primary key,
    actor       varchar(50)  not null,
    action      varchar(50)  not null,
    entity_type varchar(50)  not null,
    entity_id   bigint,
    details     varchar(500),
    created_at  timestamptz  not null default now()
);
