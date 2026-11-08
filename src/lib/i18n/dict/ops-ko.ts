import type { Dict } from "./en";
// 한국어: 신청 대기열(운영 콘솔) 텍스트.
export const opsKo: Partial<Dict> = {
  ops_summary: "대기열 요약", ops_sla_overdue: "기한 초과", ops_sla_risk: "6시간 이내 기한", ops_addons_failed: "실패한 부가 서비스", ops_revenue_today: "오늘 매출",
  ops_g_attention: "확인 필요", ops_g_active: "진행 중", ops_g_unpaid: "미결제", ops_g_decided: "완료", ops_g_all: "전체", ops_due: "기한", ops_late: "지연", ops_empty: "여기에는 아무것도 없습니다",
  ops_actions: "작업", ops_decisions_note: "승인과 거절은 태국 출입국 관리국에서만 나오며 직원이 설정할 수 없습니다.", ops_no_actions: "이 상태에서는 할 수 있는 작업이 없습니다.",
  ops_fix_reason: "여행자가 고쳐야 할 내용", ops_request_fix: "여행자에게 수정 요청", ops_retry_send: "출입국 관리국에 다시 전송", ops_cancel_reason: "취소 사유", ops_cancel: "신청 취소",
  ops_documents: "서류", ops_open: "열기", ops_none: "없음", ops_docs_audited: "서류를 열면 감사 로그에 기록됩니다.", ops_outbox: "출입국 관리국으로 전송 중",
  ops_refund_amount: "금액(THB)", ops_refund_reason: "사유", ops_refund_exception: "환불(예외)", ops_addon_retry: "다시 발급 시도", ops_addon_refund: "이 부가 서비스 환불",
  ops_notes: "내부 메모", ops_note: "메모 쓰기", ops_add_note: "메모 추가", ops_notes_hint: "직원 전용입니다. 여행자는 메모를 볼 수 없습니다.",
  ops_sim_title: "출입국 관리국의 응답 시뮬레이션", ops_sim_hint: "테스트 모드: 이 신청은 내장 시뮬레이터로 전송되었습니다. 출입국 관리국이 어떻게 답할지 선택하세요.",
  ops_sim_approve: "승인(시뮬레이션)", ops_sim_reject: "거절(시뮬레이션)", ops_sim_update: "추가 정보 요청(시뮬레이션)", ops_sim_reason: "여행자에게 표시할 사유(선택)",
  ops_filters: "필터", ops_f_search: "참조 번호", ops_f_assignee: "담당자", ops_f_any: "누구나", ops_f_me: "나", ops_f_none: "없음(미배정)", ops_f_package: "패키지", ops_f_pkg_any: "모든 패키지",
  ops_f_late: "기한 초과만", ops_f_apply: "필터 적용", ops_saved: "저장한 필터", ops_save_filter: "이 필터 저장", ops_filter_name: "필터 이름", ops_delete: "삭제", ops_delete_filter: "저장한 필터 삭제",
  ops_unassigned: "미배정", ops_assigned_to: "처리 중:", ops_assign_title: "담당자", ops_assign_save: "저장",
  ops_bulk_title: "선택한 신청", ops_selected_n: "{n}건 선택됨", ops_select_all: "모두 선택", ops_select_none: "선택 해제", ops_select_row: "선택", ops_bulk_op: "선택한 항목에 할 작업",
  ops_bulk_assign_me: "나에게 배정", ops_bulk_assign: "배정할 사람…", ops_bulk_unassign: "담당자 해제", ops_bulk_note: "같은 메모 추가", ops_bulk_retry: "출입국 관리국에 다시 전송(실패한 것만)",
  ops_bulk_apply: "선택한 항목에 적용", ops_bulk_done: "{done}건 완료, {skipped}건 건너뜀.", ops_pick_assignee: "사람 선택",
};
