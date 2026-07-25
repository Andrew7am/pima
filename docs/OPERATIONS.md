# دليل تشغيل بيما (Operations Runbook)

كل حاجة في الملف ده **مبنية في الكود بالفعل** ومستنية تفعيل من لوحات التحكم.
كل قسم مستقل — تقدر تعملهم بأي ترتيب.

---

## ١. المايجريشنات المستنية

طبّقها من **Supabase → SQL Editor** بالترتيب. كل واحدة آمنة لو اتطبّقت مرتين
(`IF NOT EXISTS` / `CREATE OR REPLACE`).

| الملف | بيفعّل إيه | لو مش مطبّق |
|---|---|---|
| `072_leaderboard.sql` | لوحة الصدارة | القائمة تظهر فاضية |
| `074_conference_hub.sql` | بطاقات المشاركين + المذكرة الروحية | القسم مايشتغلش |
| `075_random_match.sql` | المباراة العشوائية 1v1 | اللعبة ماتبدأش |
| `076_promo_banners.sql` | بانرات العروض من لوحة الأدمن | بانرات ثابتة افتراضية |
| `077_prayer_wall.sql` | حائط الصلوات | القسم يظهر فاضي |
| `078_public_avatars.sql` | صور المستخدمين في الترفيه | أول حرف من الاسم |
| `079_email_delivery.sql` | إشعارات البريد + إلغاء الاشتراك | مفيش إيميلات |

> كل الأكواد بتتحمّل غياب الجدول بدون ما تكسر الواجهة — ده مقصود، عشان
> تطبيق المايجريشن ما يبقاش شرط لنشر الكود.

---

## ٢. إشعارات البريد الإلكتروني (Resend)

### أ. حساب Resend
1. اعمل حساب على [resend.com](https://resend.com).
2. **Domains → Add Domain** → `pimastay.com`.
3. ضيف سجلات DNS اللي هيديهالك (SPF + DKIM) عند مزوّد الدومين، واستنى التوثيق.
   من غير الخطوة دي الرسايل هتروح Spam.
4. **API Keys → Create** → انسخ المفتاح (`re_...`).

### ب. أسرار Supabase
```bash
supabase secrets set RESEND_API_KEY=re_xxxxxxxxxxxx
supabase secrets set EMAIL_FROM="بيما <no-reply@pimastay.com>"
supabase secrets set APP_URL="https://pimastay.com"
supabase functions deploy send-email
```

### ج. ربط الويب هوك
**Supabase → Database → Webhooks → Create a new hook**
- Table: `public.notifications`
- Events: **Insert** بس
- Type: **Supabase Edge Functions** → `send-email`

كده أي إشعار جوّه التطبيق هيتبعت إيميل تلقائياً — من غير أي كود إضافي، لأن
`notifications` هي مصدر الحقيقة الوحيد للأحداث.

### د. التأكد إنه شغال
- اعمل أي حدث (وافق على حجز مثلاً) وشوف الإيميل.
- **Supabase → Table Editor → `email_log`**: كل محاولة متسجلة
  (`sent` / `skipped` / `failed`) مع سبب الفشل.
- المستخدم يقدر يوقف الرسايل من **حسابي → إشعارات البريد الإلكتروني**،
  أو من رابط "إلغاء الاشتراك" في ذيل أي رسالة (شغال من غير تسجيل دخول).

---

## ٣. الإشعارات الخارجية (Push / FCM)

الكود جاهز بالكامل (`src/lib/push.ts` + `supabase/functions/send-push`)
وناقص **ملف واحد**:

1. [Firebase Console](https://console.firebase.google.com) → مشروع جديد.
2. **Project settings → General → Add app → Android**
   - Package name: نفس اللي في `capacitor.config.ts` (`applicationId`).
3. نزّل **`google-services.json`** وحطه في `android/app/google-services.json`.
4. **Project settings → Service accounts → Generate new private key** → نزّل الـ JSON.
5. ```bash
   supabase secrets set FCM_SERVICE_ACCOUNT="$(cat service-account.json)"
   supabase functions deploy send-push
   ```
6. اربط ويب هوك تاني على `notifications` / Insert → `send-push`.
7. `npx cap sync android` وابنِ APK جديد.

> إذن الكاميرا والإنترنت والـ CAMERA موجودين في `AndroidManifest.xml` بالفعل.

---

## ٤. التحليلات (GA4)

1. [analytics.google.com](https://analytics.google.com) → Property جديدة → Web stream.
2. انسخ **Measurement ID** (`G-XXXXXXXXXX`).
3. **Vercel → Settings → Environment Variables**:
   ```
   VITE_GA_ID = G-XXXXXXXXXX
   ```
4. أعد النشر.

من غير المتغيّر ده، `analytics.ts` **مابيحمّلش أي سكربت خارجي إطلاقاً** — الموقع
نضيف تماماً. ولما تفعّله، بيحترم إشارات Do Not Track، وبيبعت أرقام بس:
مفيش أسماء ولا إيميلات ولا محتوى رسائل.

الأحداث المتتبّعة: `view_item` (فتح بيت) · `search` · `begin_checkout` ·
`purchase_intent` · `sign_up` · `login` · **`login_required`** (زائر اصطدم
بحائط تسجيل الدخول — أهم إشارة تسرّب في القمع).

---

## ٥. النسخ الاحتياطي

`.github/workflows/backup.yml` بياخد نسخة يومية ٢ فجراً UTC ويحتفظ بيها ٣٠ يوم.

**محتاج سر واحد:**
1. **Supabase → Settings → Database → Connection string → URI**.
2. **GitHub → Settings → Secrets and variables → Actions → New secret**
   - الاسم: `SUPABASE_DB_URL`
   - القيمة: رابط الاتصال (مع الباسورد).
3. جرّبه فوراً: **Actions → Database backup → Run workflow**.

الـ workflow بيفشل بصوت عالي لو النسخة أصغر من ١٠ كيلوبايت — عشان نسخة
احتياطية بتفشل بصمت أسوأ من مفيش نسخة.

---

## ٦. الفحص قبل أي نشر

```bash
npm run verify
```

بيشغّل: فحص الأنواع ← اختبارات الوحدات ← البناء.
والبناء **بيفشل** لو حصل `Circular chunk` — ده نوع العطل اللي وقّع الموقع قبل كده.

```bash
npm run test:e2e
```

بيقلّع نسخة الإنتاج في متصفح حقيقي ويفشل على أي استثناء غير ملتقط.

الـ CI (`.github/workflows/ci.yml`) بيشغّل ده كله على كل push و PR تلقائياً.
