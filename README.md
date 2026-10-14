# دردشات ♥ (Dardashat)

نسخة تجريبية عامة لدردشة عربية بأربع غرف (العامة، التعارف، الألعاب، التقنية)، ومراسلة خاصة، وحد أقصى 20 مستخدماً متصلاً.

## النشر
Render Web Service (Docker). The archive `Dardashat_Android_Global_Project (1).zip` is the user's original app bundle. Docker builds its Go server and bundled web UI.
Set `DARDASHAT_ADMIN_CODE` to a secret with at least 16 characters. Never commit passwords or secret values to the repository.
`DARDASHAT_CLOUD=1`, `DARDASHAT_DATA_DIR=/data`, and `PORT=10000`.

**تحذير:** خدمات Render المجانية لا تضمن حفظ بيانات الدردشة بصورة دائمة؛ إعادة التشغيل أو إعادة النشر قد تؤدي إلى حذف الحسابات والمحادثات. لا تستعمل هذه النسخة مع معلومات شخصية أو حساسة، ولا تعتمدها للإنتاج قبل إضافة تخزين دائم وإجراءات إدارة ومراقبة مناسبة.
المحادثات الخاصة مرئية للمشاركين فقط في الواجهة، لكنها غير مشفّرة طرفاً لطرف ويمكن لمشغل السيرفر الوصول إلى بياناتها.
