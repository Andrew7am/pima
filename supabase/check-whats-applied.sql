-- ============================================================
-- What is actually applied on this database?
--
-- Read-only. Changes nothing. Paste it into the Supabase SQL editor
-- and run it; every row tells you whether one migration has landed.
--
-- Each check looks for something only that migration creates, so a
-- ✅ means it really ran — not that its file exists in the repo.
-- ============================================================

SELECT * FROM (
  VALUES
    (
      '099 — إلغاء الغرف المهجورة',
      'cancel_room + claim_abandoned_match',
      (SELECT COUNT(*) FROM pg_proc WHERE proname IN ('cancel_room', 'claim_abandoned_match')) >= 2
    ),
    (
      '100 — مكافآت المباراة في رد الدالة',
      'finalize_match يرجّع host_xp_gain',
      EXISTS (
        SELECT 1 FROM pg_proc p
        WHERE p.proname = 'finalize_match'
          AND pg_get_function_result(p.oid) LIKE '%host_xp_gain%'
      )
    ),
    (
      '101 — نبضة غرفة الانتظار',
      'touch_waiting_room',
      EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'touch_waiting_room')
    ),
    (
      '104 — مضاعف نقاط الجولة',
      'submit_answer يقرأ multiplier',
      EXISTS (
        SELECT 1 FROM pg_proc p
        WHERE p.proname = 'submit_answer'
          AND pg_get_functiondef(p.oid) LIKE '%multiplier%'
      )
    ),
    (
      '105 — عدّادات الإنجازات (مهم)',
      'finalize_match يزوّد total_matches_won',
      EXISTS (
        SELECT 1 FROM pg_proc p
        WHERE p.proname = 'finalize_match'
          AND pg_get_functiondef(p.oid) LIKE '%total_matches_won%'
      )
    ),
    (
      '106 — مشاهدات البيوت',
      'جدول house_views',
      EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'house_views'
      )
    )
) AS t(migration, "بيتأكد من", applied)
ORDER BY migration;
