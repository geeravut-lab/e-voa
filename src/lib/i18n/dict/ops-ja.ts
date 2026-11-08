import type { Dict } from "./en";
// 日本語: 申請キュー（運用コンソール）のテキスト。
export const opsJa: Partial<Dict> = {
  ops_summary: "キューの概要", ops_sla_overdue: "期限超過", ops_sla_risk: "6時間以内に期限", ops_addons_failed: "失敗した追加サービス", ops_revenue_today: "本日の売上",
  ops_g_attention: "要対応", ops_g_active: "処理中", ops_g_unpaid: "未払い", ops_g_decided: "完了", ops_g_all: "すべて", ops_due: "期限", ops_late: "遅延", ops_empty: "ここには何もありません",
  ops_actions: "操作", ops_decisions_note: "承認と却下はタイ入国管理局からのみ行われ、スタッフは設定できません。", ops_no_actions: "このステータスでは操作できません。",
  ops_fix_reason: "旅行者が修正すべき内容", ops_request_fix: "旅行者に修正を依頼", ops_retry_send: "入国管理局へ再送信", ops_cancel_reason: "キャンセルの理由", ops_cancel: "申請をキャンセル",
  ops_documents: "書類", ops_open: "開く", ops_none: "なし", ops_docs_audited: "書類を開くと監査ログに記録されます。", ops_outbox: "入国管理局へ送信中",
  ops_refund_amount: "金額（THB）", ops_refund_reason: "理由", ops_refund_exception: "返金（例外）", ops_addon_retry: "もう一度発行する", ops_addon_refund: "この追加サービスを返金",
  ops_notes: "社内メモ", ops_note: "メモを書く", ops_add_note: "メモを追加", ops_notes_hint: "スタッフ専用です。旅行者にメモは見えません。",
  ops_sim_title: "入国管理局の回答をシミュレート", ops_sim_hint: "テストモード：この申請は内蔵シミュレーターに送られました。入国管理局の回答を選んでください。",
  ops_sim_approve: "承認（シミュレーション）", ops_sim_reject: "却下（シミュレーション）", ops_sim_update: "追加情報を依頼（シミュレーション）", ops_sim_reason: "旅行者に表示する理由（任意）",
  ops_filters: "フィルター", ops_f_search: "参照番号", ops_f_assignee: "担当者", ops_f_any: "誰でも", ops_f_me: "自分", ops_f_none: "なし（未割り当て）", ops_f_package: "プラン", ops_f_pkg_any: "すべてのプラン",
  ops_f_late: "期限超過のみ", ops_f_apply: "フィルターを適用", ops_saved: "保存したフィルター", ops_save_filter: "このフィルターを保存", ops_filter_name: "フィルター名", ops_delete: "削除", ops_delete_filter: "保存したフィルターを削除",
  ops_unassigned: "未割り当て", ops_assigned_to: "対応中：", ops_assign_title: "担当者", ops_assign_save: "保存",
  ops_bulk_title: "選択した申請", ops_selected_n: "{n} 件選択中", ops_select_all: "すべて選択", ops_select_none: "選択を解除", ops_select_row: "選択", ops_bulk_op: "選択したものに対する操作",
  ops_bulk_assign_me: "自分に割り当て", ops_bulk_assign: "担当者を割り当て…", ops_bulk_unassign: "担当者を外す", ops_bulk_note: "同じメモを追加", ops_bulk_retry: "入国管理局へ再送信（失敗したもののみ）",
  ops_bulk_apply: "選択したものに適用", ops_bulk_done: "{done} 件完了、{skipped} 件スキップ。", ops_pick_assignee: "担当者を選ぶ",
};
