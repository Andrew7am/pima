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
| `080_fix_payment_methods_revoke.sql` | **إخفاء أرقام الملاك عن الضيوف** | 🚨 أي حد يقرأ أرقام الملاك |

> ⚠️ `080` يصحّح `070`. الأخير كان بيكتب
> `REVOKE SELECT (payment_methods) …` وده **بلا أثر** في PostgreSQL طالما الدور
> عنده صلاحية على الجدول كله — بينفّذ بنجاح وميعملش حاجة. `080` بيسحب صلاحية
> الجدول وبيدي الأعمدة المسموحة بس.
>
> **مهم:** أي عمود جديد يتضاف لجدول `houses` بعد كده **مش** هيكون مقروء للضيوف
> تلقائياً (صلاحيات الأعمدة مابتغطيش الجديد). أعد تشغيل بلوك `DO $$` في `080`
> بعد أي `ADD COLUMN`.

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

### هـ. إيميلات المصادقة (تأكيد التسجيل واسترجاع كلمة السر)

دي حاجة تانية غير اللي فوق. الإشعارات بتمشي من الـEdge Function؛ إيميلات
المصادقة **Supabase نفسه** بيبعتها، وبيستخدم بريده المدمج المحدود جداً (بضع
رسايل في الساعة، ومكتوب صراحة إنه للتطوير). لو فعّلت تأكيد الإيميل من غير SMTP
حقيقي، التسجيل هيقف عملياً: الناس هتسجّل ومش هيوصلها حاجة.

نفس حساب Resend بتاع الإشعارات — دومين واحد متوثّق ومفتاح واحد يتغيّر.

**١. مفتاح للإرسال:** Resend ← **API Keys ← Create** بصلاحية Sending access.

**٢. وصّله:** لوحة Supabase ← **Project Settings ← Authentication ← SMTP
Settings ← Enable Custom SMTP**:

| الحقل | القيمة |
|---|---|
| Host | `smtp.resend.com` |
| Port | `587` |
| Username | `resend` |
| Password | مفتاح Resend (`re_...`) |
| Sender email | `no-reply@pimastay.com` |
| Sender name | `بيما` |

**٣. القوالب العربية:** Supabase بيبعت قوالب إنجليزية افتراضية — سطر أزرق مفيهوش
اسم بيما ولا كلمة عربي. أول إيميل يشوفه أي حد بيسجّل، يعني أول انطباع عن المنصة.
القوالب البديلة في `supabase/templates/`. لوحة Supabase ← **Authentication ←
Email Templates**، ولكل واحد انسخ محتوى الملف في الـMessage body والـsubject
المكتوب في أول سطر منه:

| القالب في اللوحة | الملف |
|---|---|
| Confirm signup | `confirm-signup.html` |
| Reset password | `reset-password.html` |
| Magic Link | `magic-link.html` |
| Change email address | `email-change.html` |
| Reauthentication | `reauthentication.html` |

**٤. فعّل التأكيد:** **Authentication ← Providers ← Email ← Confirm email = ON**

شاشة التسجيل في التطبيق **بالفعل** بتتعامل مع الحالة دي — بتعرض «افتح بريدك»
وفيها إعادة إرسال بمهلة ٦٠ ثانية. مفيش كود محتاج يتكتب.

**٥. وإنت في نفس الشاشة:** خلّي **Minimum password length = 8** (الكود بقى ٨ من
ناحيته)، وفعّل **Leaked password protection** لو ظاهرة.

**٦. اتأكد:** سجّل حساب بإيميل حقيقي. المفروض يوصل إيميل عربي RTL خلال ثواني.
لو مجاش، Resend ← **Logs** بيقول اتبعت ولا اترفض وليه.

> محلياً: `supabase/config.toml` فيه القوالب متظبّطة وبتشتغل مع `supabase start`
> لوحدها، والرسايل بتقع في Inbucket على `http://127.0.0.1:54324` بدل ما تتبعت
> فعلاً — وده اللي إنت عايزه وإنت بتطوّر.

---

## ٣. الإشعارات الخارجية (Push / FCM)

فيه **قناتين**، الاتنين بيمشوا على نفس مشروع Firebase ونفس جدول
`device_tokens` ونفس دالة `send-push` — يعني إعداد واحد بيشغّل الاتنين:

| القناة | مين بتوصله | الكود | الإعداد |
|---|---|---|---|
| تطبيق أندرويد | مستخدمي الـAPK | جاهز | ناقص `google-services.json` |
| متصفح (ويب) | زوّار pimastay.com | جاهز | ناقصه متغيرات `VITE_FIREBASE_*` |

> كان مكتوب هنا قبل كده إن «الكود جاهز بالكامل» — وده كان صح للأندرويد بس.
> `registerPushNotifications` بيرجع من أول سطر على الويب، فأي حد على الموقع
> مكانش بيوصله أي إشعار خارجي خالص. اتضاف مسار الويب في `src/lib/push.ts`
> (+ `public/firebase-messaging-sw.js`).

### أ) الأندرويد — ناقص **ملف واحد**:

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

### ب) المتصفح (ويب) — من نفس المشروع:

1. **Project settings → General → Add app → Web** (نفس مشروع Firebase بتاع
   الأندرويد — متعملش مشروع تاني).
2. من نفس الصفحة انسخ الـ config وحط القيم في متغيرات البيئة على Vercel:
   `VITE_FIREBASE_API_KEY` · `VITE_FIREBASE_PROJECT_ID` ·
   `VITE_FIREBASE_SENDER_ID` · `VITE_FIREBASE_APP_ID`
3. **Cloud Messaging → Web Push certificates → Generate key pair** → حط الناتج
   في `VITE_FIREBASE_VAPID_KEY`.
4. اعمل ديبلوي. المستخدم بيشغّلها بنفسه من **حسابي ← إشعارات المتصفح**.

> القيم الخمسة دي **عامة** بطبيعتها (بتتشاف في الباندل) — دي بتعرّف المشروع
> مش بتأذن بالإرسال. اللي بيأذن بالإرسال هو الـservice account، وهو موجود
> بس في أسرار `send-push`.

> **ليه مفيش طلب إذن أول ما الموقع يفتح؟** المتصفح بيسمح بطلب واحد بس —
> ولو المستخدم رفض، الصفحة مش هتقدر تسأل تاني أبداً، والإذن بيتقفل على المتصفح
> ده للأبد. عشان كده الطلب مربوط بزرار صريح في الإعدادات مش بالتحميل.

> **قفل الإشعارات** بيمسح توكن المتصفح ده بس — مش بيلغي إذن المتصفح (الصفحة
> مش بتقدر تلغيه، المستخدم بس من إعدادات الموقع). يعني موبايل ولابتوب على نفس
> الحساب كل واحد يقدر يسكّت نفسه لوحده.

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

في نسختين، وكل واحدة بتغطي اللي التانية مش بتغطيه. **الاتنين مطلوبين.**

### أ. اليومية على GitHub Actions

`.github/workflows/backup.yml` بياخد نسخة يومية ٢ فجراً UTC ويحتفظ بيها ٣٠ يوم.

**محتاج سر واحد:**
1. **Supabase → Settings → Database → Connection string → URI**.
2. **GitHub → Settings → Secrets and variables → Actions → New secret**
   - الاسم: `SUPABASE_DB_URL`
   - القيمة: رابط الاتصال (مع الباسورد).
3. جرّبه فوراً: **Actions → Database backup → Run workflow**.

الـ workflow بيفشل بصوت عالي لو النسخة أصغر من ١٠ كيلوبايت — عشان نسخة
احتياطية بتفشل بصمت أسوأ من مفيش نسخة.

> ⚠️ **تأكد إن السر متظبّط فعلاً.** من غيره الـ workflow بيفشل كل ليلة، وفشل
> متكرر بقى عادي محدش بيبصله. افتح **Actions → Database backup** وشوف آخر تشغيل.

### ب. الكاملة المحلية — `scripts/backup-db.ps1`

الفرق مش في التكرار، في **المحتوى**:

| | GitHub Actions | السكربت المحلي |
|---|---|---|
| بيانات التطبيق (`public`) | ✅ ٣٢ جدول | ✅ ٣٢ جدول |
| **حسابات الدخول (`auth`)** | ❌ `--schema=public` | ✅ ٢٣ جدول |
| التخزين والـrealtime | ❌ | ✅ |
| مدة الحفظ | ٣٠ يوم (أرتيفاكت) | على جهازك، مالهاش نهاية |

**اللي المقارنة دي معناها:** لو استعدت من نسخة GitHub بس، كل الحجوزات والبيوت
هترجع — بس **محدش هيقدر يسجّل دخول**، لأن الحسابات مش فيها، وكل
`bookings.user_id` هيبقى بيشاور على مستخدم مش موجود. النسخة المحلية هي اللي
بترجّع منصة شغالة.

**أول مرة:**

```powershell
$env:PIMA_DB_URL = "postgresql://postgres.xxx:PASSWORD@...supabase.com:5432/postgres"
.\scripts\backup-db.ps1
```

**خلّيها تلقائية (كل جمعة ٢ الفجر):**

```powershell
.\scripts\backup-db.ps1 -Install
```

بيسجّل مهمة في Task Scheduler وبيحفظ رابط الاتصال كمتغيّر بيئة للمستخدم — مش
جوه تعريف المهمة، عشان الباسورد ما يظهرش في واجهة Task Scheduler.

**إيه اللي بيتحقق منه:** نسخة محدش فتحها هي تخمين. السكربت بيمسح أي ملف ما
عداش التلاتة: الحجم أكبر من ٢٠ كيلو، `gzip -t` على الأرشيف كله (بيمسك اتصال
اتقطع في النص)، وأسماء الجداول المتوقعة موجودة (بيمسك نسخة من قاعدة تانية).

### ج. الاستعادة — `scripts/restore-db.ps1`

**جرّبها وإنت مرتاح، مش يوم الكارثة.**

```powershell
.\scripts\restore-db.ps1 -TargetUrl "postgresql://...الوجهة..."
```

الوجهة لازم **قاعدة فاضية** (مشروع Supabase جديد). السكربت بيفصل الأخطاء:

- **أخطاء في `public`** — دي بياناتك، أي خطأ هنا يعني فشل.
- **أخطاء في سكيمات Supabase** (`storage`, `realtime`, `auth`) — طبيعية لو
  الوجهة Postgres عادي؛ على مشروع Supabase حقيقي بتختفي.

وفي الآخر بيسأل القاعدة نفسها عدّت إيه فيها بالفعل، مش بيصدّق سجل العملية.

اتجرّبت دورة كاملة: نسخ ← استعادة ← تحقق، بصفر أخطاء في `public`.

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
