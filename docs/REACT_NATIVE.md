# ملاحظة: تطبيق React Native (Expo) لاحقًا

لم يُبنَ التطبيق الآن (حسب البرومبت). الجاهز له:
- **نفس الخادم بلا تغيير**: كل العمليات عبر Supabase (REST + RPC + Auth) والصلاحيات في قاعدة البيانات — انظر `docs/API.md`.
- **منطق مشترك قابل للنقل** كما هو (TypeScript بلا DOM): `lib/quran.ts`, `lib/juz.ts`, `lib/progress.ts`, `lib/ranking.ts`, `lib/review.ts`, `lib/exams.ts`, `lib/familyMessages.ts`, `lib/center.ts`, `lib/i18n.ts`. يُفضَّل نقلها إلى حزمة مشتركة (`packages/core`) عند بدء تطبيق الجوال.
- **بدون إنترنت**: `lib/offline/store.ts` منطقه صالح؛ يُبدَّل التخزين من IndexedDB إلى SQLite (`expo-sqlite`).

ما يلزم لاحقًا:
1. Expo SDK الحالي + `@supabase/supabase-js` مع `AsyncStorage`/`expo-secure-store` للجلسة، و`expo-notifications` للإشعارات (بدل Web Push؛ يُضاف عمود نوع الاشتراك لجدول `push_subscriptions`).
2. روابط الدعوة وتأكيد البريد كـ Deep Links (`scheme` في `app.json`) وإضافتها إلى Redirect URLs في Supabase.
3. **Google Play**: حساب مطوّر (25$ مرة واحدة). المراجعة عادة من ساعات إلى 3 أيام، وأول نشر قد يأخذ حتى 7 أيام. الحسابات الشخصية الجديدة تحتاج اختبارًا مغلقًا (12 مختبِرًا لمدة 14 يومًا) قبل النشر العام.
4. **App Store**: حساب Apple Developer (99$ سنويًا)، جهاز Mac أو EAS Build من Expo. المراجعة عادة 1–3 أيام. تطبيقات «تسجيل الدخول فقط» تحتاج حساب تجربة للمراجِع، وسياسة خصوصية، وخيار حذف الحساب من داخل التطبيق.
5. EAS Build/Submit من Expo لبناء ورفع النسختين من نفس الكود.
