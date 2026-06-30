-- ARC 居留證控管系統 Supabase 正式版 V1
-- 執行順序：001_schema.sql -> 002_seed_data.sql
-- 免登入版本：啟用 RLS，但開放 anon 讀寫。若未來要做正式帳密權限，請改寫 policies。

create extension if not exists pgcrypto;

create table if not exists agencies (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  short_name text not null,
  full_name text not null,
  contact_name text default '',
  phone text default '',
  is_active boolean not null default true,
  display_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists agency_accounts (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid references agencies(id) on delete set null,
  bank_code text not null default '',
  bank_name text not null default '',
  account_number text not null unique,
  account_label text default '',
  balance numeric(14,2) not null default 0,
  note text default '',
  is_active boolean not null default true,
  display_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists handlers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  short_code text default '',
  is_active boolean not null default true,
  display_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists application_items (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  default_amount numeric(12,2) not null default 1000,
  requires_payment boolean not null default true,
  requires_pickup boolean not null default true,
  download_after_payment boolean not null default false,
  is_active boolean not null default true,
  display_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists system_settings (
  key text primary key,
  value text not null default '',
  note text default '',
  updated_at timestamptz not null default now()
);

create table if not exists device_locks (
  id uuid primary key default gen_random_uuid(),
  device_id text not null unique,
  device_label text default '',
  handler_id uuid references handlers(id) on delete set null,
  handler_name text not null,
  is_locked boolean not null default true,
  locked_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unlocked_at timestamptz,
  unlock_reason text default ''
);

create table if not exists arc_cases (
  id uuid primary key default gen_random_uuid(),
  case_no text not null unique,
  handler_id uuid references handlers(id) on delete set null,
  handler_name text not null default '',
  agency_id uuid references agencies(id) on delete set null,
  agency_code text default '',
  agency_short_name text not null default '',
  employer_name text not null default '',
  worker_name text not null default '',
  entry_date date,
  application_date date,
  group_no text default '',
  application_item_id uuid references application_items(id) on delete set null,
  application_item_name text not null default '',
  amount numeric(12,2) not null default 0,
  entry_type text not null default 'online', -- online / onsite
  payment_status text not null default 'pending', -- pending / paid / no_payment / closed
  pickup_status text not null default 'none', -- none / pending / picked / hold / abnormal / download / closed
  receipt_no text default '',
  payment_date date,
  pickup_date date,
  card_count integer not null default 1,
  handler_code text default '',
  foreign_code_last5 text default '',
  old_card boolean not null default false,
  pickup_person text default '',
  note text default '',
  is_voided boolean not null default false,
  voided_at timestamptz,
  voided_by text default '',
  void_reason text default '',
  created_by text default '',
  updated_by text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists payment_batches (
  id uuid primary key default gen_random_uuid(),
  batch_no text not null unique,
  payment_date date not null,
  payer text default '',
  agency_id uuid references agencies(id) on delete set null,
  agency_short_name text default '',
  account_id uuid references agency_accounts(id) on delete set null,
  account_label text default '',
  fee numeric(12,2) not null default 7,
  total_case_amount numeric(14,2) not null default 0,
  grand_total numeric(14,2) not null default 0,
  financial_status text not null default 'pending', -- pending / confirmed / voided
  confirmed_at timestamptz,
  confirmed_by text default '',
  created_by text default '',
  updated_by text default '',
  note text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists payment_details (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid references payment_batches(id) on delete cascade,
  case_id uuid references arc_cases(id) on delete set null,
  receipt_no text default '',
  payment_amount numeric(12,2) not null default 0,
  entry_date date,
  employer_name text default '',
  worker_name text default '',
  handler_name text default '',
  agency_short_name text default '',
  application_item_name text default '',
  created_at timestamptz not null default now()
);

create table if not exists account_transactions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references agency_accounts(id) on delete set null,
  agency_id uuid references agencies(id) on delete set null,
  batch_id uuid references payment_batches(id) on delete set null,
  transaction_type text not null default 'payment_confirm',
  amount numeric(14,2) not null default 0,
  balance_before numeric(14,2) not null default 0,
  balance_after numeric(14,2) not null default 0,
  note text default '',
  created_by text default '',
  created_at timestamptz not null default now()
);

create table if not exists fax_batches (
  id uuid primary key default gen_random_uuid(),
  fax_no text not null unique,
  fax_date date not null,
  pickup_date date not null,
  total_cards integer not null default 0,
  created_by text default '',
  print_payload jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists fax_details (
  id uuid primary key default gen_random_uuid(),
  fax_batch_id uuid references fax_batches(id) on delete cascade,
  case_id uuid references arc_cases(id) on delete set null,
  receipt_no text default '',
  card_count integer not null default 1,
  handler_code text default '',
  foreign_code_last5 text default '',
  old_card boolean not null default false,
  employer_name text default '',
  worker_name text default '',
  handler_name text default '',
  created_at timestamptz not null default now()
);

create table if not exists contacts (
  id uuid primary key default gen_random_uuid(),
  contact_type text not null, -- service_station / brigade
  name text not null,
  address text default '',
  phone text default '',
  fax text default '',
  is_active boolean not null default true,
  display_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(contact_type, name)
);

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_handler_id uuid,
  actor_name text not null default '',
  device_id text default '',
  action_type text not null,
  table_name text not null,
  record_id text default '',
  before_data jsonb default '{}'::jsonb,
  after_data jsonb default '{}'::jsonb,
  reason text default '',
  created_at timestamptz not null default now()
);

create index if not exists idx_arc_cases_dates on arc_cases(application_date, entry_date);
create index if not exists idx_arc_cases_status on arc_cases(payment_status, pickup_status, is_voided);
create index if not exists idx_payment_batches_date on payment_batches(payment_date, financial_status);
create index if not exists idx_payment_details_batch on payment_details(batch_id);
create index if not exists idx_audit_logs_created_at on audit_logs(created_at desc);
create index if not exists idx_contacts_type on contacts(contact_type, is_active);

alter table agencies enable row level security;
alter table agency_accounts enable row level security;
alter table handlers enable row level security;
alter table application_items enable row level security;
alter table system_settings enable row level security;
alter table device_locks enable row level security;
alter table arc_cases enable row level security;
alter table payment_batches enable row level security;
alter table payment_details enable row level security;
alter table account_transactions enable row level security;
alter table fax_batches enable row level security;
alter table fax_details enable row level security;
alter table contacts enable row level security;
alter table audit_logs enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array[
    'agencies','agency_accounts','handlers','application_items','system_settings','device_locks','arc_cases',
    'payment_batches','payment_details','account_transactions','fax_batches','fax_details','contacts','audit_logs'
  ] loop
    execute format('drop policy if exists "anon_all_%s" on %I', t, t);
    execute format('create policy "anon_all_%s" on %I for all to anon using (true) with check (true)', t, t);
  end loop;
end $$;
