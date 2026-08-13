-- ============================================================
-- PiMa — Demo Users Seed (Development Only)
-- Password for all accounts: pima1234
-- ============================================================

-- Insert demo users into Supabase Auth (skip if already exist by id)
INSERT INTO auth.users (
  id, instance_id, aud, role,
  email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
)
SELECT * FROM (VALUES
  (
    'a1000000-0000-0000-0000-000000000001'::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated',
    'fady@gmail.com', crypt('pima1234', gen_salt('bf')), NOW()::timestamptz,
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"مينا الديب","role":"individual","phone":"01122334455"}'::jsonb,
    NOW()::timestamptz, NOW()::timestamptz
  ),
  (
    'a1000000-0000-0000-0000-000000000002'::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated',
    'mina@servant.org', crypt('pima1234', gen_salt('bf')), NOW()::timestamptz,
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"مينا الديب","role":"servant","phone":"01223344556","organization_name":"أسرة ثانوي كنيسة العذراء بالزيتون"}'::jsonb,
    NOW()::timestamptz, NOW()::timestamptz
  ),
  (
    'a1000000-0000-0000-0000-000000000003'::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated',
    'church_admin@outlook.com', crypt('pima1234', gen_salt('bf')), NOW()::timestamptz,
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"تامر منير","role":"church","phone":"01556677889","organization_name":"كنيسة مارجرجس هليوبوليس"}'::jsonb,
    NOW()::timestamptz, NOW()::timestamptz
  ),
  (
    'a1000000-0000-0000-0000-000000000004'::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated',
    'owner@church.eg', crypt('pima1234', gen_salt('bf')), NOW()::timestamptz,
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"بطرس ميلاد","role":"owner","phone":"01098765432","organization_name":"بيت مارمرقس للمؤتمرات"}'::jsonb,
    NOW()::timestamptz, NOW()::timestamptz
  ),
  (
    'a1000000-0000-0000-0000-000000000005'::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated',
    'shenouda@retreat.eg', crypt('pima1234', gen_salt('bf')), NOW()::timestamptz,
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"شنودة رمسيس","role":"owner","phone":"01234567890","organization_name":"بيت الشماسة فيبي"}'::jsonb,
    NOW()::timestamptz, NOW()::timestamptz
  ),
  (
    'a1000000-0000-0000-0000-000000000006'::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated',
    'admin@church.eg', crypt('pima1234', gen_salt('bf')), NOW()::timestamptz,
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"القس مرقس جرجس","role":"admin","phone":"01001234567"}'::jsonb,
    NOW()::timestamptz, NOW()::timestamptz
  )
) AS v(id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = v.id);

-- The trigger on_auth_user_created auto-creates profiles in public.users
-- But since we're inserting directly, run it manually for each:
INSERT INTO public.users (id, email, name, role, phone, organization_name, is_approved, points, created_at)
VALUES
  ('a1000000-0000-0000-0000-000000000001','fady@gmail.com','مينا الديب','individual','01122334455',NULL,NULL,450,NOW()),
  ('a1000000-0000-0000-0000-000000000002','mina@servant.org','مينا الديب','servant','01223344556','أسرة ثانوي كنيسة العذراء بالزيتون',NULL,1250,NOW()),
  ('a1000000-0000-0000-0000-000000000003','church_admin@outlook.com','تامر منير','church','01556677889','كنيسة مارجرجس هليوبوليس',NULL,0,NOW()),
  ('a1000000-0000-0000-0000-000000000004','owner@church.eg','بطرس ميلاد','owner','01098765432','بيت مارمرقس للمؤتمرات',TRUE,0,NOW()),
  ('a1000000-0000-0000-0000-000000000005','shenouda@retreat.eg','شنودة رمسيس','owner','01234567890','بيت الشماسة فيبي',TRUE,0,NOW()),
  ('a1000000-0000-0000-0000-000000000006','admin@church.eg','القس مرقس جرجس','admin','01001234567',NULL,NULL,0,NOW())
ON CONFLICT (id) DO NOTHING;
