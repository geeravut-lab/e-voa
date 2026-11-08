import type { Dict } from "./en";
// 繁體中文：申請佇列（營運主控台）文字。
export const opsZhTW: Partial<Dict> = {
  ops_summary: "佇列摘要", ops_sla_overdue: "已逾期", ops_sla_risk: "6 小時內到期", ops_addons_failed: "失敗的加購服務", ops_revenue_today: "今日營收",
  ops_g_attention: "需要處理", ops_g_active: "處理中", ops_g_unpaid: "未付款", ops_g_decided: "已完成", ops_g_all: "全部", ops_due: "期限", ops_late: "逾期", ops_empty: "這裡沒有內容",
  ops_actions: "操作", ops_decisions_note: "核准與駁回只由泰國移民局作出，工作人員無法設定。", ops_no_actions: "此狀態下無法進行任何操作。",
  ops_fix_reason: "旅客需要修正的內容", ops_request_fix: "請旅客修正", ops_retry_send: "再次送交移民局", ops_cancel_reason: "取消原因", ops_cancel: "取消申請",
  ops_documents: "文件", ops_open: "開啟", ops_none: "無", ops_docs_audited: "開啟文件會寫入稽核紀錄。", ops_outbox: "正在送交移民局",
  ops_refund_amount: "金額（THB）", ops_refund_reason: "原因", ops_refund_exception: "退款（例外）", ops_addon_retry: "再次嘗試開立", ops_addon_refund: "退還此加購服務",
  ops_notes: "內部備註", ops_note: "寫備註", ops_add_note: "新增備註", ops_notes_hint: "僅限工作人員，旅客看不到備註。",
  ops_sim_title: "模擬移民局的回覆", ops_sim_hint: "測試模式：此申請已送到內建模擬器。請選擇移民局會如何回覆。",
  ops_sim_approve: "核准（模擬）", ops_sim_reject: "駁回（模擬）", ops_sim_update: "要求補充資料（模擬）", ops_sim_reason: "顯示給旅客的原因（選填）",
  ops_filters: "篩選", ops_f_search: "參考編號", ops_f_assignee: "負責人", ops_f_any: "任何人", ops_f_me: "我", ops_f_none: "無（未指派）", ops_f_package: "方案", ops_f_pkg_any: "所有方案",
  ops_f_late: "只看已逾期", ops_f_apply: "套用篩選", ops_saved: "已儲存的篩選", ops_save_filter: "儲存此篩選", ops_filter_name: "篩選名稱", ops_delete: "刪除", ops_delete_filter: "刪除已儲存的篩選",
  ops_unassigned: "未指派", ops_assigned_to: "處理中：", ops_assign_title: "負責人", ops_assign_save: "儲存",
  ops_bulk_title: "已選取的申請", ops_selected_n: "已選取 {n} 筆", ops_select_all: "全選", ops_select_none: "取消選取", ops_select_row: "選取", ops_bulk_op: "對所選項目執行",
  ops_bulk_assign_me: "指派給我", ops_bulk_assign: "指派給…", ops_bulk_unassign: "移除負責人", ops_bulk_note: "加入相同備註", ops_bulk_retry: "再次送交移民局（僅限失敗的）",
  ops_bulk_apply: "套用到所選項目", ops_bulk_done: "{done} 筆完成，{skipped} 筆略過。", ops_pick_assignee: "選擇一位成員",
};
