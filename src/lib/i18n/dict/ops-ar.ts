import type { Dict } from "./en";
// العربية: نصوص قائمة الطلبات (وحدة التشغيل).
export const opsAr: Partial<Dict> = {
  ops_summary: "ملخص القائمة", ops_sla_overdue: "تجاوز الموعد", ops_sla_risk: "يستحق خلال 6 ساعات", ops_addons_failed: "خدمات إضافية فاشلة", ops_revenue_today: "إيراد اليوم",
  ops_g_attention: "يحتاج إلى انتباه", ops_g_active: "قيد المعالجة", ops_g_unpaid: "غير مدفوع", ops_g_decided: "منتهٍ", ops_g_all: "الكل", ops_due: "الموعد", ops_late: "متأخر", ops_empty: "لا شيء هنا",
  ops_actions: "الإجراءات", ops_decisions_note: "الموافقة والرفض يأتيان من الهجرة التايلندية فقط؛ ولا يستطيع الموظفون تحديدهما.", ops_no_actions: "لا يمكن اتخاذ أي إجراء في هذه الحالة.",
  ops_fix_reason: "ما الذي يجب على المسافر تصحيحه", ops_request_fix: "اطلب من المسافر التصحيح", ops_retry_send: "إرسال إلى الهجرة مرة أخرى", ops_cancel_reason: "سبب الإلغاء", ops_cancel: "إلغاء الطلب",
  ops_documents: "المستندات", ops_open: "فتح", ops_none: "لا شيء", ops_docs_audited: "يُسجَّل فتح المستند في سجل التدقيق.", ops_outbox: "الإرسال إلى الهجرة",
  ops_refund_amount: "المبلغ (THB)", ops_refund_reason: "السبب", ops_refund_exception: "استرداد (استثناء)", ops_addon_retry: "حاول الإصدار مرة أخرى", ops_addon_refund: "استرداد هذه الخدمة الإضافية",
  ops_notes: "ملاحظات داخلية", ops_note: "اكتب ملاحظة", ops_add_note: "إضافة ملاحظة", ops_notes_hint: "للموظفين فقط. لا يرى المسافرون الملاحظات أبدًا.",
  ops_sim_title: "محاكاة ردّ الهجرة", ops_sim_hint: "وضع الاختبار: أُرسل هذا الطلب إلى المحاكي المدمج. اختر ما ستردّ به الهجرة.",
  ops_sim_approve: "موافقة (محاكاة)", ops_sim_reject: "رفض (محاكاة)", ops_sim_update: "طلب مزيد من المعلومات (محاكاة)", ops_sim_reason: "السبب الذي يظهر للمسافر (اختياري)",
  ops_filters: "عوامل التصفية", ops_f_search: "الرقم المرجعي", ops_f_assignee: "المسؤول", ops_f_any: "أي شخص", ops_f_me: "أنا", ops_f_none: "لا أحد (غير مسند)", ops_f_package: "الباقة", ops_f_pkg_any: "أي باقة",
  ops_f_late: "المتأخرة فقط", ops_f_apply: "تطبيق التصفية", ops_saved: "عوامل التصفية المحفوظة", ops_save_filter: "حفظ هذه التصفية", ops_filter_name: "اسم التصفية", ops_delete: "حذف", ops_delete_filter: "حذف التصفية المحفوظة",
  ops_unassigned: "غير مسند", ops_assigned_to: "يعمل عليه:", ops_assign_title: "من يعمل عليه", ops_assign_save: "حفظ",
  ops_bulk_title: "الطلبات المحددة", ops_selected_n: "تم تحديد {n}", ops_select_all: "تحديد الكل", ops_select_none: "إلغاء التحديد", ops_select_row: "تحديد", ops_bulk_op: "ماذا تفعل بالمحدد",
  ops_bulk_assign_me: "إسناد إليّ", ops_bulk_assign: "إسناد إلى…", ops_bulk_unassign: "إزالة المسؤول", ops_bulk_note: "إضافة الملاحظة نفسها", ops_bulk_retry: "إرسال إلى الهجرة مرة أخرى (الفاشلة فقط)",
  ops_bulk_apply: "تطبيق على المحدد", ops_bulk_done: "اكتمل {done}، وتم تخطي {skipped}.", ops_pick_assignee: "اختر شخصًا",
};
