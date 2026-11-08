import type { Dict } from "./en";
// हिन्दी: आवेदन कतार (ऑप्स कंसोल) के पाठ।
export const opsHi: Partial<Dict> = {
  ops_summary: "कतार का सार", ops_sla_overdue: "समय सीमा पार", ops_sla_risk: "6 घंटे के भीतर देय", ops_addons_failed: "विफल अतिरिक्त सेवाएँ", ops_revenue_today: "आज की आय",
  ops_g_attention: "ध्यान चाहिए", ops_g_active: "प्रक्रिया में", ops_g_unpaid: "अवैतनिक", ops_g_decided: "पूर्ण", ops_g_all: "सभी", ops_due: "देय", ops_late: "देर", ops_empty: "यहाँ कुछ नहीं है",
  ops_actions: "कार्रवाइयाँ", ops_decisions_note: "मंज़ूरी और अस्वीकृति केवल थाई इमिग्रेशन से आती है; कर्मचारी इन्हें तय नहीं कर सकते।", ops_no_actions: "इस स्थिति में कोई कार्रवाई संभव नहीं है।",
  ops_fix_reason: "यात्री को क्या ठीक करना है", ops_request_fix: "यात्री से ठीक करने को कहें", ops_retry_send: "इमिग्रेशन को फिर भेजें", ops_cancel_reason: "रद्द करने का कारण", ops_cancel: "आवेदन रद्द करें",
  ops_documents: "दस्तावेज़", ops_open: "खोलें", ops_none: "कोई नहीं", ops_docs_audited: "दस्तावेज़ खोलना ऑडिट लॉग में दर्ज होता है।", ops_outbox: "इमिग्रेशन को भेजा जा रहा है",
  ops_refund_amount: "राशि (THB)", ops_refund_reason: "कारण", ops_refund_exception: "रिफ़ंड (अपवाद)", ops_addon_retry: "फिर जारी करने का प्रयास", ops_addon_refund: "इस अतिरिक्त सेवा का रिफ़ंड करें",
  ops_notes: "आंतरिक टिप्पणियाँ", ops_note: "टिप्पणी लिखें", ops_add_note: "टिप्पणी जोड़ें", ops_notes_hint: "केवल कर्मचारियों के लिए। यात्री टिप्पणियाँ कभी नहीं देखते।",
  ops_sim_title: "इमिग्रेशन के उत्तर का अनुकरण", ops_sim_hint: "परीक्षण मोड: यह आवेदन अंतर्निहित सिम्युलेटर को भेजा गया। चुनें कि इमिग्रेशन क्या उत्तर देगा।",
  ops_sim_approve: "मंज़ूर करें (अनुकरण)", ops_sim_reject: "अस्वीकार करें (अनुकरण)", ops_sim_update: "अधिक जानकारी माँगें (अनुकरण)", ops_sim_reason: "यात्री को दिखाया जाने वाला कारण (वैकल्पिक)",
  ops_filters: "फ़िल्टर", ops_f_search: "संदर्भ संख्या", ops_f_assignee: "किसे सौंपा गया", ops_f_any: "कोई भी", ops_f_me: "मैं", ops_f_none: "कोई नहीं (असौंपा)", ops_f_package: "पैकेज", ops_f_pkg_any: "कोई भी पैकेज",
  ops_f_late: "केवल समय सीमा पार", ops_f_apply: "फ़िल्टर लागू करें", ops_saved: "सहेजे गए फ़िल्टर", ops_save_filter: "यह फ़िल्टर सहेजें", ops_filter_name: "फ़िल्टर का नाम", ops_delete: "हटाएँ", ops_delete_filter: "सहेजा गया फ़िल्टर हटाएँ",
  ops_unassigned: "असौंपा", ops_assigned_to: "इस पर काम कर रहे हैं:", ops_assign_title: "कौन काम कर रहा है", ops_assign_save: "सहेजें",
  ops_bulk_title: "चुने गए आवेदन", ops_selected_n: "{n} चुने गए", ops_select_all: "सभी चुनें", ops_select_none: "चयन हटाएँ", ops_select_row: "चुनें", ops_bulk_op: "चुने हुए के साथ क्या करें",
  ops_bulk_assign_me: "मुझे सौंपें", ops_bulk_assign: "इन्हें सौंपें…", ops_bulk_unassign: "ज़िम्मेदार हटाएँ", ops_bulk_note: "वही टिप्पणी जोड़ें", ops_bulk_retry: "इमिग्रेशन को फिर भेजें (केवल विफल वाले)",
  ops_bulk_apply: "चुने हुए पर लागू करें", ops_bulk_done: "{done} पूर्ण, {skipped} छोड़े गए।", ops_pick_assignee: "एक व्यक्ति चुनें",
};
