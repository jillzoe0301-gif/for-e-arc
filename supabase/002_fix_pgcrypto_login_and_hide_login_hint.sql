-- ARC V13 正式版登入修正補丁
-- 用途：修正登入時 function crypt(text, text) does not exist
-- 執行位置：Supabase SQL Editor
-- 執行時機：已經跑過 001_formal_schema_rpc.sql 但登入失敗時，請直接執行本補丁。

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
set search_path = public, extensions;

-- 重新建立預設帳號，並統一重設密碼為 123456。
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
  password_hash=excluded.password_hash,
  name=excluded.name,
  person=excluded.person,
  role=excluded.role,
  active=excluded.active,
  deleted_at=null,
  updated_at=now();

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

grant execute on function public.arc_login(text,text) to anon, authenticated;
grant execute on function public.arc_admin_create_user(text,text,text,text,text,text) to anon, authenticated;
grant execute on function public.arc_admin_update_user(text,text,text,text,text,text,text,boolean) to anon, authenticated;
