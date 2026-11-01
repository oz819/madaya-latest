# واجهة الخادم (API) — للتطبيق الحالي ولتطبيق React Native لاحقًا

كل منطق العمل والصلاحيات في قاعدة البيانات (Postgres + RLS على Supabase)، لا في الواجهة. أي عميل (الويب، أو تطبيق Expo لاحقًا) يستخدم نفس الـ API:
- **REST** على الجداول عبر PostgREST (`/rest/v1/{table}`) — القراءة والكتابة مقيّدة تلقائيًا بمركز المستخدم الحالي.
- **RPC** للعمليات (`/rest/v1/rpc/{function}`).
- **Auth** من Supabase (كود بالبريد أو كلمة مرور).
- مسارات الخادم `/api/*` فقط لما يحتاج مفتاح الخدمة.

## الهوية والمركز
| الدالة | من | ماذا تفعل |
|---|---|---|
| `my_context()` | مسجّل | المستخدم، المركز الحالي (الاسم، الشعار، الألوان، الحالة، الخطة)، دوره فيه، كل مراكزه، وسبب المنع إن وُجد |
| `switch_center(p_center_id)` | مسجّل | تبديل المركز الحالي (يجب أن يكون عضوًا فعّالًا) |
| `public_center(p_slug, p_domain)` | الجميع | بيانات المركز العامة لصفحته |
| `create_center(p_name, p_slug, p_country, p_city, p_owner_name, …)` | مسجّل ومؤكَّد البريد | ينشئ مركزًا، صاحبه مديره |
| `invite_info(p_token)` / `accept_invite(p_token, p_name)` | الجميع / مسجّل | معلومات الدعوة / قبولها |
| `super_centers()` / `super_set_center(p_id, p_status, p_plan)` | مدير المنصة | قائمة المراكز / تفعيل وإيقاف وتغيير الخطة |

## الجداول (كلها بـ center_id ومعزولة بالمركز)
`circles`, `students`, `quran_entries`, `attendance`, `talqeen_sessions`, `arabic_books`, `student_arabic_enrollments`, `arabic_entries`, `edu_notes`, `circle_lessons`, `activities`, `exams`, `report_sends`, `guardian_links`, `student_transfers`, `registration_requests`, `audit_log`, `ranking_settings`, `user_settings`, `center_invites`, `push_subscriptions`.
`profiles` = أعضاء المركز الحالي (view). `centers` = مراكز المستخدم. `quran_surahs` مشترك.

المزامنة بدون إنترنت (`lib/offline/store.ts`): الكتابة upsert بمعرّفات من الجهاز (uuid)، والسحب بـ `updated_at`. نفس النمط يصلح لتطبيق الجوال (SQLite بدل IndexedDB).

## عمليات المدير وغيرها (RPC)
`admin_soft_delete`, `admin_restore`, `admin_purge`, `admin_trash`, `admin_accept_registration`, `admin_reject_registration`, `rotate_guardian_link`, `save_talqeen_session`, `report_data`, `sync_latest_quran_entries`, `sync_latest_arabic_entries`, `guardian_view(p_token)` (عام)، `submit_registration(…, p_center)` (عام).

## مسارات الخادم
| المسار | ماذا |
|---|---|
| `GET/POST /api/admin/teachers` | بريد أعضاء المركز / إضافة معلّم (حساب جديد أو عضوية لحساب موجود) |
| `PATCH /api/admin/teachers/{id}`، `POST …/reset-password` | تعديل الاسم/البريد، كلمة مرور (لحساب خاص بالمركز فقط) |
| `POST /api/admin/invites` | إرسال دعوة بالبريد |
| `POST /api/push/test` | إشعار تجريبي لأجهزتي |
