# مسار (Masar) — الخطوة البرمجية الثانية

واجهة React/Vite عربية متجاوبة للويب والموبايل، مع خريطة Leaflet، البحث، GPS، مسار تجريبي، وبلاغات طريق قابلة للمزامنة المباشرة عبر Supabase.

## 1) المتطلبات
- Node.js إصدار LTS حديث (يفضل 20 أو 22)
- حساب Supabase مجاني للتجربة
- متصفح حديث واتصال إنترنت

## 2) تشغيل المشروع
```bash
npm install
cp .env.example .env.local
npm run dev
```
افتح عنوان Vite الظاهر في الطرفية. تحديد الموقع يحتاج `localhost` أو HTTPS وإذن الموقع. على هاتف آخر، ارفع الموقع على استضافة HTTPS.

## 3) تفعيل البلاغات المشتركة
1. أنشئ مشروعاً في https://supabase.com/
2. من SQL Editor شغّل محتوى `supabase/schema.sql`.
3. من إعدادات API انسخ Project URL و anon/public key إلى `.env.local`:
```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_KEY
```
4. أعد تشغيل `npm run dev`.
5. جرّب إرسال بلاغ من متصفحين؛ يفترض أن يظهر البلاغ في الاثنين بعد تفعيل Realtime.
لا تضع `service_role` أو أي سر إداري في المتصفح.

## 4) بناء نسخة النشر
```bash
npm run build
npm run preview
```
مجلد النشر هو `dist/`. يمكن نشره على Vercel أو Netlify أو Cloudflare Pages. أضف متغيرات البيئة نفسها في إعدادات الاستضافة.

## 5) الموجود حالياً / غير الموجود
- موجود: واجهة عربية متجاوبة، خريطة OSM، تحديد الموقع، البحث عن مكان داخل العراق، مسار قيادة تجريبي، بلاغات مشتركة اختيارياً مع Supabase Realtime.
- غير موجود: حركة مرور حية من مزود رسمي، ملاحة صوتية، تسجيل دخول، مراجعة البلاغات، مكافحة التلاعب، تطبيق متجر أصلي، خرائط دون إنترنت.
- OSRM وNominatim المستخدمان في النموذج خدمات عامة تجريبية وليستا ضماناً للإنتاج أو للضغط العالي. راجع سياساتهما واستبدلهما بمزود مناسب أو استضف الخدمة قبل الإطلاق.
- خوادم بلاطات OSM العامة ليست CDN مجاني لمنتج واسع. يجب الالتزام بسياسة البلاطات وإظهار الإسناد.

## 6) اختيار مزود الخرائط للعراق
- Google Navigation SDK coverage table lists Iraq with traffic layer available, driving directions/snap-to-roads shown as unavailable/low in that specific SDK coverage table, and real-time disruptions unavailable. This is not enough by itself to promise Waze-like live incidents; verify actual API products and test routes in target cities.
- Mapbox Directions API supports a driving-traffic profile where coverage exists, but documentation says it falls back to ordinary driving routing where traffic coverage is unsupported. Public docs reviewed do not conclusively establish full Iraq traffic coverage, so test before committing.
- Recommended prototype: keep Leaflet + OSM for map display, use community reports through Supabase, and run a small field test of Google and Mapbox routing/traffic in Baghdad, Basra, Erbil, Najaf, and Diwaniyah before picking a paid provider.
- For a production app, review terms, privacy, API keys, rate limits, billing alerts, and data attribution.
