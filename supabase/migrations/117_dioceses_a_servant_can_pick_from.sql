-- ============================================================
-- Dioceses, so a servant picks their own instead of typing it
--
-- The signup form asks a servant which إيبارشية they serve in. Free text
-- means «شبرا الخيمة», «ابراشية شبرا الخيمه» and «الخيمة» are three churches
-- as far as the database is concerned, and no report over that column can
-- ever be trusted.
--
-- The 72 names below were researched from church sources and
-- cross-checked: anything a single source claimed was sent to a verifier
-- told to refute it, which correctly threw out «أسقفية المقطم ومنشية ناصر»
-- and «أسقفية غرب الإسكندرية» — both pastoral sectors of an existing
-- diocese, not dioceses. Three same-diocese-two-titles pairs were collapsed
-- to the fuller official name.
--
-- This is a seed, not a ruling. Dioceses are created, renamed and merged by
-- the Church, so is_active exists to retire a name without deleting rows
-- that reference it, and admins can add what is missing.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.dioceses (
  id           BIGSERIAL PRIMARY KEY,
  name_ar      TEXT NOT NULL UNIQUE,
  governorate  TEXT NOT NULL,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dioceses_governorate ON public.dioceses(governorate) WHERE is_active;

INSERT INTO public.dioceses (name_ar, governorate) VALUES
  ('إيبارشية أسوان', 'أسوان'),
  ('إيبارشية أبنوب والفتح وأسيوط الجديدة', 'أسيوط'),
  ('إيبارشية أبو تيج وصدفا والغنايم', 'أسيوط'),
  ('إيبارشية أسيوط وساحل سليم والبداري', 'أسيوط'),
  ('إيبارشية القوصية ومير', 'أسيوط'),
  ('إيبارشية دير المحرق', 'أسيوط'),
  ('إيبارشية ديروط وصنبو', 'أسيوط'),
  ('إيبارشية منفلوط', 'أسيوط'),
  ('أسقفية المنتزة', 'الإسكندرية'),
  ('أسقفية شرق الإسكندرية', 'الإسكندرية'),
  ('إيبارشية برج العرب والعامرية', 'الإسكندرية'),
  ('إيبارشية الإسماعيلية', 'الإسماعيلية'),
  ('إيبارشية إسنا وأرمنت', 'الأقصر'),
  ('إيبارشية الأقصر', 'الأقصر'),
  ('إيبارشية البحر الأحمر', 'البحر الأحمر'),
  ('إيبارشية البحيرة', 'البحيرة'),
  ('إيبارشية 6 أكتوبر وأوسيم', 'الجيزة'),
  ('إيبارشية أطفيح والصف', 'الجيزة'),
  ('إيبارشية إمبابة والوراق', 'الجيزة'),
  ('إيبارشية شمال الجيزة', 'الجيزة'),
  ('إيبارشية طموه والبدرشين والنمرس والحوامدية والعياط', 'الجيزة'),
  ('إيبارشية وسط الجيزة والواسطى', 'الجيزة'),
  ('إيبارشية المنصورة', 'الدقهلية'),
  ('إيبارشية ميت غمر ودقادوس وبلاد الشرقية', 'الدقهلية'),
  ('إيبارشية السويس', 'السويس'),
  ('إيبارشية الزقازيق ومنيا القمح', 'الشرقية'),
  ('إيبارشية مراكز الشرقية والعاشر من رمضان', 'الشرقية'),
  ('إيبارشية المحلة الكبرى وسمنود', 'الغربية'),
  ('إيبارشية طنطا', 'الغربية'),
  ('إيبارشية الفيوم', 'الفيوم'),
  ('أسقفية شبرا الجنوبية', 'القاهرة'),
  ('أسقفية شبرا الشمالية', 'القاهرة'),
  ('أسقفية شرق السكة الحديد', 'القاهرة'),
  ('أسقفية عزبة النخل والمرج', 'القاهرة'),
  ('أسقفية عين شمس والمطرية وحلمية الزيتون', 'القاهرة'),
  ('أسقفية مدينة السلام وحي الحرفيين', 'القاهرة'),
  ('أسقفية مصر القديمة والمنيل وفم الخليج', 'القاهرة'),
  ('أسقفية منطقة القبة والوايلي ومنشية الصدر', 'القاهرة'),
  ('أسقفية وسط القاهرة', 'القاهرة'),
  ('إيبارشية المعادي والبساتين ودار السلام', 'القاهرة'),
  ('إيبارشية حلوان والمعصرة ومدينة 15 مايو', 'القاهرة'),
  ('إيبارشية بنها وقويسنا', 'القليوبية'),
  ('إيبارشية شبرا الخيمة', 'القليوبية'),
  ('إيبارشية شبين القناطر والخانكة وأبو زعبل وطوخ', 'القليوبية'),
  ('إيبارشية المنوفية وشبين الكوم', 'المنوفية'),
  ('إيبارشية أبو قرقاص', 'المنيا'),
  ('إيبارشية المنيا', 'المنيا'),
  ('إيبارشية بني مزار والبهنسا', 'المنيا'),
  ('إيبارشية دير مواس ودلجا', 'المنيا'),
  ('إيبارشية سمالوط وطحا', 'المنيا'),
  ('إيبارشية شرق المنيا', 'المنيا'),
  ('إيبارشية مطاي', 'المنيا'),
  ('إيبارشية مغاغة والعدوة', 'المنيا'),
  ('إيبارشية ملوي وأنصنا والأشمونين', 'المنيا'),
  ('إيبارشية الوادي الجديد والواحات', 'الوادي الجديد'),
  ('إيبارشية ببا والفشن وسمسطا', 'بني سويف'),
  ('إيبارشية بني سويف', 'بني سويف'),
  ('إيبارشية بورسعيد', 'بورسعيد'),
  ('إيبارشية الطور وشرم الشيخ وكل جنوب سيناء', 'جنوب سيناء'),
  ('إيبارشية دمياط وكفر الشيخ والبراري', 'دمياط'),
  ('إيبارشية أخميم وساقلته', 'سوهاج'),
  ('إيبارشية البلينا وبرديس وأولاد طوق', 'سوهاج'),
  ('إيبارشية جرجا', 'سوهاج'),
  ('إيبارشية سوهاج والمنشأة والمراغة', 'سوهاج'),
  ('إيبارشية طما', 'سوهاج'),
  ('إيبارشية طهطا وجهينة', 'سوهاج'),
  ('إيبارشية العريش والقنطرة وكل شمال سيناء', 'شمال سيناء'),
  ('إيبارشية دشنا', 'قنا'),
  ('إيبارشية قنا وقفط', 'قنا'),
  ('إيبارشية نجع حمادي', 'قنا'),
  ('إيبارشية نقادة وقوص', 'قنا'),
  ('إيبارشية مرسى مطروح والخمس مدن الغربية', 'مطروح')
ON CONFLICT (name_ar) DO NOTHING;

-- Readable by everyone: the signup form needs it before anyone has an account.
ALTER TABLE public.dioceses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dioceses_read_all ON public.dioceses;
CREATE POLICY dioceses_read_all ON public.dioceses FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS dioceses_write_admin ON public.dioceses;
CREATE POLICY dioceses_write_admin ON public.dioceses FOR ALL
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

GRANT SELECT ON public.dioceses TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.dioceses TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.dioceses_id_seq TO authenticated;

-- The servant's own diocese. TEXT rather than a foreign key: a servant whose
-- diocese is missing from the seed must still be able to finish signing up,
-- and a key would stop them at the door.
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS diocese TEXT;

COMMENT ON TABLE public.dioceses IS
  'Seeded from church sources, verified against a refute-first check. Editable by admins — the Church changes this list, not us.';
