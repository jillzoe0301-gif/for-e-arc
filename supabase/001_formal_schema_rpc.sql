-- ARC 居留證控管系統｜V13 正式版 Supabase 後端
-- 執行位置：Supabase SQL Editor
-- 用途：Email 登入、角色帳號管理、共享資料狀態、跨裝置儲存

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
set search_path = public, extensions;

create table if not exists public.arc_users (
  id text primary key,
  email text not null unique,
  password_hash text not null,
  name text not null,
  person text,
  role text not null check (role in ('admin','office','accounting')),
  active boolean not null default true,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.arc_sessions (
  token text primary key,
  user_id text not null references public.arc_users(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '12 hours')
);

create table if not exists public.arc_app_state (
  id text primary key default 'main',
  data jsonb not null default '{}'::jsonb,
  updated_by text,
  updated_at timestamptz not null default now()
);

alter table public.arc_users enable row level security;
alter table public.arc_sessions enable row level security;
alter table public.arc_app_state enable row level security;

-- 不開放前端直接讀寫表格；前端只透過下方 SECURITY DEFINER RPC 存取。
revoke all on public.arc_users from anon, authenticated;
revoke all on public.arc_sessions from anon, authenticated;
revoke all on public.arc_app_state from anon, authenticated;

insert into public.arc_users(id,email,password_hash,name,person,role,active)
values
('USR-001','jillzoe@forwardhrm.com.tw',crypt('123456',gen_salt('bf')),'若儀','若儀','admin',true),
('USR-002','patty@forwardhrm.com.tw',crypt('123456',gen_salt('bf')),'嘉陽','嘉陽','admin',true),
('USR-003','mint@forwardhrm.com.tw',crypt('123456',gen_salt('bf')),'明書','明書','admin',true),
('USR-004','rachel@forwardhrm.com.tw',crypt('123456',gen_salt('bf')),'詩涵','詩涵','office',true),
('USR-005','penny@forwardhrm.com.tw',crypt('123456',gen_salt('bf')),'佩珊','佩珊','office',true),
('USR-006','helen@forwardhrm.com.tw',crypt('123456',gen_salt('bf')),'晏婷','晏婷','office',true),
('USR-007','jean_guo@forwardhrm.com.tw',crypt('123456',gen_salt('bf')),'奕君','奕君','office',true),
('USR-008','maru@forwardhrm.com.tw',crypt('123456',gen_salt('bf')),'莞莞','莞莞','office',true),
('USR-009','nina@forwardhrm.com.tw',crypt('123456',gen_salt('bf')),'芸瑄','芸瑄','accounting',true),
('USR-010','joy@forwardhrm.com.tw',crypt('123456',gen_salt('bf')),'淑娥','淑娥','accounting',true)
on conflict (email) do update set
  name=excluded.name,
  person=excluded.person,
  role=excluded.role,
  active=excluded.active,
  updated_at=now();

insert into public.arc_app_state(id,data)
values ('main','{}'::jsonb)
on conflict (id) do nothing;

create or replace function public.arc_user_json(u public.arc_users)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'id', u.id,
    'email', u.email,
    'name', u.name,
    'person', coalesce(u.person,''),
    'role', u.role,
    'active', u.active,
    'createdAt', to_char(u.created_at at time zone 'Asia/Taipei','YYYY-MM-DD HH24:MI:SS')
  );
$$;

create or replace function public.arc_user_list_json()
returns jsonb
language sql
stable
security definer
set search_path = public, extensions
as $$
  select coalesce(jsonb_agg(public.arc_user_json(u) order by u.id),'[]'::jsonb)
  from public.arc_users u
  where u.deleted_at is null;
$$;

create or replace function public.arc_session_user(p_token text)
returns public.arc_users
language sql
stable
security definer
set search_path = public, extensions
as $$
  select u
  from public.arc_sessions s
  join public.arc_users u on u.id=s.user_id
  where s.token=p_token
    and s.expires_at > now()
    and u.active=true
    and u.deleted_at is null
  limit 1;
$$;

create or replace function public.arc_login(p_email text, p_password text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user public.arc_users;
  v_token text;
  v_state jsonb;
begin
  select * into v_user
  from public.arc_users
  where lower(email)=lower(trim(p_email))
    and deleted_at is null
  limit 1;

  if v_user.id is null then
    return jsonb_build_object('ok',false,'message','Email 或密碼錯誤');
  end if;

  if v_user.active is not true then
    return jsonb_build_object('ok',false,'message','此帳號已停用，請聯絡管理員');
  end if;

  if v_user.password_hash <> crypt(p_password, v_user.password_hash) then
    return jsonb_build_object('ok',false,'message','Email 或密碼錯誤');
  end if;

  delete from public.arc_sessions where expires_at <= now();
  v_token := gen_random_uuid()::text;
  insert into public.arc_sessions(token,user_id) values (v_token,v_user.id);

  select data into v_state from public.arc_app_state where id='main';

  return jsonb_build_object(
    'ok',true,
    'token',v_token,
    'user',public.arc_user_json(v_user),
    'users',public.arc_user_list_json(),
    'app_state',coalesce(v_state,'{}'::jsonb)
  );
end;
$$;

create or replace function public.arc_get_state(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user public.arc_users;
  v_state jsonb;
begin
  v_user := public.arc_session_user(p_token);
  if v_user.id is null then
    return jsonb_build_object('ok',false,'message','登入已失效，請重新登入');
  end if;
  update public.arc_sessions set expires_at=now()+interval '12 hours' where token=p_token;
  select data into v_state from public.arc_app_state where id='main';
  return jsonb_build_object('ok',true,'user',public.arc_user_json(v_user),'users',public.arc_user_list_json(),'app_state',coalesce(v_state,'{}'::jsonb));
end;
$$;

create or replace function public.arc_save_state(p_token text, p_state jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user public.arc_users;
begin
  v_user := public.arc_session_user(p_token);
  if v_user.id is null then
    return jsonb_build_object('ok',false,'message','登入已失效，無法儲存');
  end if;
  insert into public.arc_app_state(id,data,updated_by,updated_at)
  values ('main', coalesce(p_state,'{}'::jsonb), v_user.email, now())
  on conflict(id) do update set data=excluded.data, updated_by=excluded.updated_by, updated_at=now();
  return jsonb_build_object('ok',true,'updated_by',v_user.email);
end;
$$;

create or replace function public.arc_list_users(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user public.arc_users;
begin
  v_user := public.arc_session_user(p_token);
  if v_user.id is null then
    return jsonb_build_object('ok',false,'message','登入已失效');
  end if;
  return jsonb_build_object('ok',true,'users',public.arc_user_list_json());
end;
$$;

create or replace function public.arc_require_admin(p_token text)
returns public.arc_users
language sql
stable
security definer
set search_path = public, extensions
as $$
  select u.*
  from public.arc_session_user(p_token) u
  where u.role='admin'
  limit 1;
$$;

create or replace function public.arc_next_user_id()
returns text
language sql
security definer
set search_path = public, extensions
as $$
  select 'USR-' || lpad((coalesce(max(nullif(regexp_replace(id,'[^0-9]','','g'),'')::int),0)+1)::text,3,'0')
  from public.arc_users;
$$;

create or replace function public.arc_admin_create_user(p_token text, p_email text, p_password text, p_name text, p_person text, p_role text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_admin public.arc_users;
  v_id text;
begin
  v_admin := public.arc_require_admin(p_token);
  if v_admin.id is null then return jsonb_build_object('ok',false,'message','只有管理員可以新增帳號'); end if;
  if p_role not in ('admin','office','accounting') then return jsonb_build_object('ok',false,'message','角色錯誤'); end if;
  if coalesce(trim(p_email),'')='' or coalesce(p_password,'')='' or coalesce(trim(p_name),'')='' then return jsonb_build_object('ok',false,'message','Email、名稱、密碼不可空白'); end if;
  if exists(select 1 from public.arc_users where lower(email)=lower(trim(p_email)) and deleted_at is null) then return jsonb_build_object('ok',false,'message','Email 已存在'); end if;
  v_id := public.arc_next_user_id();
  insert into public.arc_users(id,email,password_hash,name,person,role,active)
  values(v_id,lower(trim(p_email)),crypt(p_password,gen_salt('bf')),trim(p_name),coalesce(trim(p_person),''),p_role,true);
  return jsonb_build_object('ok',true,'id',v_id,'users',public.arc_user_list_json());
end;
$$;

create or replace function public.arc_admin_update_user(p_token text, p_user_id text, p_email text, p_password text, p_name text, p_person text, p_role text, p_active boolean)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_admin public.arc_users;
begin
  v_admin := public.arc_require_admin(p_token);
  if v_admin.id is null then return jsonb_build_object('ok',false,'message','只有管理員可以修改帳號'); end if;
  if p_role not in ('admin','office','accounting') then return jsonb_build_object('ok',false,'message','角色錯誤'); end if;
  if coalesce(trim(p_email),'')='' or coalesce(trim(p_name),'')='' then return jsonb_build_object('ok',false,'message','Email 與名稱不可空白'); end if;
  if exists(select 1 from public.arc_users where lower(email)=lower(trim(p_email)) and id<>p_user_id and deleted_at is null) then return jsonb_build_object('ok',false,'message','Email 已被其他帳號使用'); end if;
  update public.arc_users set
    email=lower(trim(p_email)),
    name=trim(p_name),
    person=coalesce(trim(p_person),''),
    role=p_role,
    active=coalesce(p_active,true),
    password_hash=case when coalesce(p_password,'')<>'' then crypt(p_password,gen_salt('bf')) else password_hash end,
    updated_at=now()
  where id=p_user_id and deleted_at is null;
  return jsonb_build_object('ok',true,'users',public.arc_user_list_json());
end;
$$;

create or replace function public.arc_admin_set_user_active(p_token text, p_user_id text, p_active boolean)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_admin public.arc_users;
begin
  v_admin := public.arc_require_admin(p_token);
  if v_admin.id is null then return jsonb_build_object('ok',false,'message','只有管理員可以停用/啟用帳號'); end if;
  if v_admin.id=p_user_id then return jsonb_build_object('ok',false,'message','不能停用目前登入中的帳號'); end if;
  update public.arc_users set active=coalesce(p_active,false), updated_at=now() where id=p_user_id and deleted_at is null;
  return jsonb_build_object('ok',true,'users',public.arc_user_list_json());
end;
$$;

create or replace function public.arc_admin_delete_user(p_token text, p_user_id text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_admin public.arc_users;
begin
  v_admin := public.arc_require_admin(p_token);
  if v_admin.id is null then return jsonb_build_object('ok',false,'message','只有管理員可以刪除帳號'); end if;
  if v_admin.id=p_user_id then return jsonb_build_object('ok',false,'message','不能刪除目前登入中的帳號'); end if;
  update public.arc_users set deleted_at=now(), active=false, updated_at=now() where id=p_user_id and deleted_at is null;
  return jsonb_build_object('ok',true,'users',public.arc_user_list_json());
end;
$$;

create or replace function public.arc_logout(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  delete from public.arc_sessions where token=p_token;
  return jsonb_build_object('ok',true);
end;
$$;

grant execute on function public.arc_login(text,text) to anon, authenticated;
grant execute on function public.arc_get_state(text) to anon, authenticated;
grant execute on function public.arc_save_state(text,jsonb) to anon, authenticated;
grant execute on function public.arc_list_users(text) to anon, authenticated;
grant execute on function public.arc_admin_create_user(text,text,text,text,text,text) to anon, authenticated;
grant execute on function public.arc_admin_update_user(text,text,text,text,text,text,text,boolean) to anon, authenticated;
grant execute on function public.arc_admin_set_user_active(text,text,boolean) to anon, authenticated;
grant execute on function public.arc_admin_delete_user(text,text) to anon, authenticated;
grant execute on function public.arc_logout(text) to anon, authenticated;
