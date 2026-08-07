-- ============================================================
-- Is the view counter receiving anything at all?
--
-- Read-only. Run it AFTER opening a house or two in the app.
--
-- This splits the problem in half. If rows are arriving, recording
-- works and the fault is in how the admin screen reads them. If
-- nothing is arriving, the app is not reaching the server and the
-- fault is on the client side.
-- ============================================================

-- 1. Does the table exist, and does it have anything in it?
SELECT
  'إجمالي المشاهدات المسجّلة' AS "الفحص",
  COUNT(*)::TEXT              AS "النتيجة"
FROM public.house_views

UNION ALL

-- 2. Anything in the last hour — i.e. from your testing just now.
SELECT
  'مشاهدات آخر ساعة',
  COUNT(*)::TEXT
FROM public.house_views
WHERE viewed_at > NOW() - INTERVAL '1 hour'

UNION ALL

-- 3. Signed-in versus anonymous, which says whether it is reaching
--    the server as a logged-in user or as a visitor.
SELECT
  'منها بحساب مسجّل',
  COUNT(*)::TEXT
FROM public.house_views
WHERE viewer_id IS NOT NULL

UNION ALL

-- 4. Can the RPC even be called by a normal visitor? A missing grant
--    here is invisible from the app: the call just errors and the
--    page carries on.
SELECT
  'صلاحية anon على record_house_view',
  CASE WHEN has_function_privilege('anon', 'public.record_house_view(text)', 'EXECUTE')
       THEN 'موجودة' ELSE 'ناقصة ❌' END

UNION ALL

SELECT
  'صلاحية authenticated على record_house_view',
  CASE WHEN has_function_privilege('authenticated', 'public.record_house_view(text)', 'EXECUTE')
       THEN 'موجودة' ELSE 'ناقصة ❌' END

UNION ALL

SELECT
  'صلاحية authenticated على house_view_counts',
  CASE WHEN has_function_privilege('authenticated', 'public.house_view_counts()', 'EXECUTE')
       THEN 'موجودة' ELSE 'ناقصة ❌' END;
