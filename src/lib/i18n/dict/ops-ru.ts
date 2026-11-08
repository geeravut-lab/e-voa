import type { Dict } from "./en";
// Русский: очередь заявок (операционная консоль).
export const opsRu: Partial<Dict> = {
  ops_summary: "Сводка по очереди", ops_sla_overdue: "Просрочено", ops_sla_risk: "Срок в течение 6 ч", ops_addons_failed: "Неудавшиеся доп. услуги", ops_revenue_today: "Выручка за сегодня",
  ops_g_attention: "Требует внимания", ops_g_active: "В работе", ops_g_unpaid: "Не оплачено", ops_g_decided: "Завершено", ops_g_all: "Все", ops_due: "срок", ops_late: "ПРОСРОЧЕНО", ops_empty: "Здесь ничего нет",
  ops_actions: "Действия", ops_decisions_note: "Одобрение и отказ приходят только от иммиграционной службы Таиланда; сотрудники не могут их задавать.", ops_no_actions: "В этом статусе действия невозможны.",
  ops_fix_reason: "Что путешественнику нужно исправить", ops_request_fix: "Попросить путешественника исправить", ops_retry_send: "Отправить в иммиграционную службу снова", ops_cancel_reason: "Причина отмены", ops_cancel: "Отменить заявку",
  ops_documents: "Документы", ops_open: "Открыть", ops_none: "Нет", ops_docs_audited: "Открытие документа записывается в журнал аудита.", ops_outbox: "Отправка в иммиграционную службу",
  ops_refund_amount: "Сумма (THB)", ops_refund_reason: "Причина", ops_refund_exception: "Возврат (исключение)", ops_addon_retry: "Попробовать оформить снова", ops_addon_refund: "Вернуть деньги за эту услугу",
  ops_notes: "Внутренние заметки", ops_note: "Написать заметку", ops_add_note: "Добавить заметку", ops_notes_hint: "Только для сотрудников. Путешественники заметки не видят.",
  ops_sim_title: "Имитация ответа иммиграционной службы", ops_sim_hint: "Тестовый режим: заявка отправлена во встроенный имитатор. Выберите, что ответила бы иммиграционная служба.",
  ops_sim_approve: "Одобрить (имитация)", ops_sim_reject: "Отклонить (имитация)", ops_sim_update: "Запросить дополнительные сведения (имитация)", ops_sim_reason: "Причина для путешественника (необязательно)",
  ops_filters: "Фильтры", ops_f_search: "Номер заявки", ops_f_assignee: "Ответственный", ops_f_any: "Любой", ops_f_me: "Я", ops_f_none: "Никто (не назначено)", ops_f_package: "Пакет", ops_f_pkg_any: "Любой пакет",
  ops_f_late: "Только просроченные", ops_f_apply: "Применить фильтр", ops_saved: "Сохранённые фильтры", ops_save_filter: "Сохранить этот фильтр", ops_filter_name: "Название фильтра", ops_delete: "Удалить", ops_delete_filter: "Удалить сохранённый фильтр",
  ops_unassigned: "Не назначено", ops_assigned_to: "В работе у:", ops_assign_title: "Кто занимается", ops_assign_save: "Сохранить",
  ops_bulk_title: "Выбранные заявки", ops_selected_n: "Выбрано: {n}", ops_select_all: "Выбрать все", ops_select_none: "Снять выбор", ops_select_row: "Выбрать", ops_bulk_op: "Что сделать с выбранными",
  ops_bulk_assign_me: "Назначить мне", ops_bulk_assign: "Назначить…", ops_bulk_unassign: "Снять ответственного", ops_bulk_note: "Добавить одинаковую заметку", ops_bulk_retry: "Отправить в иммиграционную службу снова (только неудавшиеся)",
  ops_bulk_apply: "Применить к выбранным", ops_bulk_done: "Выполнено: {done}, пропущено: {skipped}.", ops_pick_assignee: "Выберите человека",
};
