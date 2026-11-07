import type { PerLang } from "@/lib/content/types";
// Words of the offline vault page in the three written languages (other languages show English). Typed values never go through here.
export type VaultText = Record<string, string>;
const en: VaultText = {
  title: "Offline vault and health card", intro: "Keep the papers you may need in Thailand, and your health information, on this phone. They open without internet.",
  local: "Everything stays on this phone, locked with your passcode. ThaiPass never receives it.", forget: "If you forget the passcode, the contents cannot be recovered. A short passcode only protects against casual opening: choose a long one.",
  create_title: "Create a passcode", create_btn: "Create the vault", pass1: "Passcode (at least 6 characters)", pass2: "Repeat the passcode", pass_short: "Use at least 6 characters.", pass_mismatch: "The two passcodes are different.",
  unlock_title: "Enter your passcode", unlock_btn: "Open", wrong: "That passcode is wrong.", working: "Working…", lock: "Lock", unsupported: "This browser cannot keep encrypted files here. Open the page in Chrome or Safari, not inside another app.",
  tab_docs: "Documents", tab_health: "Health card", add_doc: "Add a document or note", doc_type: "Kind", doc_title: "Title", doc_note: "Note (optional)", doc_file: "Photo or PDF (optional)",
  type_passport: "Passport page", type_evoa: "E-VOA / visa", type_insurance: "Insurance", type_booking: "Hotel or booking", type_ticket: "Flight ticket", type_other: "Other",
  save: "Save", saved: "Saved.", empty: "Nothing saved yet.", open: "Open", download: "Download", del: "Delete", del_confirm: "Delete this item from the phone?", close: "Close",
  too_big: "The file is too big (4 MB at most).", bad_type: "Use a photo (JPG, PNG, WebP) or a PDF.", too_many: "You can keep up to 40 items.", need_title: "Give it a title.",
  health_hint: "Pick what applies. A medic reads it in English and Thai.", h_name: "Name", h_dob: "Date of birth", h_blood: "Blood group", h_allergies: "Allergies", h_conditions: "Medical conditions", h_other: "Other (write it)", h_meds: "Medicines I take",
  h_contact: "Emergency contact", h_c_name: "Name", h_c_phone: "Phone", h_c_rel: "Relationship", h_insurer: "Insurance company", h_policy: "Policy number", h_ins_phone: "24-hour phone", h_none: "—",
  show_card: "Show the card", edit: "Edit", erase_all: "Erase everything on this phone", erase_confirm: "Erase all documents and the health card from this phone? This cannot be undone.", erased: "Everything was erased.",
  emergency: "Emergency numbers", back_app: "Back to the app", idle: "Locked after a few minutes without use.", card_for_medic: "Show this to the person helping you",
};
const th: VaultText = {
  title: "ตู้เอกสารออฟไลน์และบัตรสุขภาพ", intro: "เก็บเอกสารที่อาจต้องใช้ในประเทศไทย และข้อมูลสุขภาพของคุณไว้ในโทรศัพท์เครื่องนี้ เปิดดูได้โดยไม่ต้องมีอินเทอร์เน็ต",
  local: "ทุกอย่างอยู่ในโทรศัพท์เครื่องนี้ ล็อกด้วยรหัสผ่านของคุณ ThaiPass ไม่ได้รับข้อมูลเหล่านี้", forget: "ถ้าลืมรหัสผ่าน จะกู้ข้อมูลไม่ได้ รหัสสั้น ๆ ป้องกันได้แค่การเปิดดูโดยไม่ตั้งใจ ควรตั้งให้ยาว",
  create_title: "ตั้งรหัสผ่าน", create_btn: "สร้างตู้เอกสาร", pass1: "รหัสผ่าน (อย่างน้อย 6 ตัวอักษร)", pass2: "พิมพ์รหัสผ่านอีกครั้ง", pass_short: "ใช้อย่างน้อย 6 ตัวอักษร", pass_mismatch: "รหัสผ่านทั้งสองไม่ตรงกัน",
  unlock_title: "ใส่รหัสผ่าน", unlock_btn: "เปิด", wrong: "รหัสผ่านไม่ถูกต้อง", working: "กำลังทำงาน…", lock: "ล็อก", unsupported: "เบราว์เซอร์นี้เก็บไฟล์เข้ารหัสไม่ได้ ให้เปิดหน้านี้ใน Chrome หรือ Safari ไม่ใช่ภายในแอปอื่น",
  tab_docs: "เอกสาร", tab_health: "บัตรสุขภาพ", add_doc: "เพิ่มเอกสารหรือบันทึก", doc_type: "ประเภท", doc_title: "ชื่อเรื่อง", doc_note: "บันทึก (ไม่บังคับ)", doc_file: "รูปถ่ายหรือ PDF (ไม่บังคับ)",
  type_passport: "หน้าพาสปอร์ต", type_evoa: "E-VOA / วีซ่า", type_insurance: "ประกัน", type_booking: "โรงแรมหรือการจอง", type_ticket: "ตั๋วเครื่องบิน", type_other: "อื่น ๆ",
  save: "บันทึก", saved: "บันทึกแล้ว", empty: "ยังไม่มีรายการ", open: "เปิด", download: "ดาวน์โหลด", del: "ลบ", del_confirm: "ลบรายการนี้ออกจากโทรศัพท์หรือไม่", close: "ปิด",
  too_big: "ไฟล์ใหญ่เกินไป (สูงสุด 4 MB)", bad_type: "ใช้รูปถ่าย (JPG, PNG, WebP) หรือ PDF", too_many: "เก็บได้สูงสุด 40 รายการ", need_title: "กรุณาตั้งชื่อเรื่อง",
  health_hint: "เลือกข้อที่ตรงกับคุณ เจ้าหน้าที่แพทย์จะอ่านได้ทั้งภาษาอังกฤษและไทย", h_name: "ชื่อ", h_dob: "วันเกิด", h_blood: "หมู่เลือด", h_allergies: "แพ้", h_conditions: "โรคประจำตัว", h_other: "อื่น ๆ (พิมพ์เอง)", h_meds: "ยาที่ใช้เป็นประจำ",
  h_contact: "ผู้ติดต่อฉุกเฉิน", h_c_name: "ชื่อ", h_c_phone: "โทรศัพท์", h_c_rel: "ความสัมพันธ์", h_insurer: "บริษัทประกัน", h_policy: "เลขที่กรมธรรม์", h_ins_phone: "โทรศัพท์ 24 ชั่วโมง", h_none: "—",
  show_card: "แสดงบัตร", edit: "แก้ไข", erase_all: "ลบทุกอย่างออกจากโทรศัพท์เครื่องนี้", erase_confirm: "ลบเอกสารและบัตรสุขภาพทั้งหมดออกจากโทรศัพท์เครื่องนี้หรือไม่ ย้อนกลับไม่ได้", erased: "ลบทุกอย่างแล้ว",
  emergency: "เบอร์ฉุกเฉิน", back_app: "กลับไปที่แอป", idle: "จะล็อกอัตโนมัติเมื่อไม่ได้ใช้งานสักครู่", card_for_medic: "แสดงให้ผู้ที่กำลังช่วยเหลือคุณดู",
};
const zh: VaultText = {
  title: "离线保险箱与健康卡", intro: "把您在泰国可能用到的证件和健康信息保存在这部手机上，无需网络即可打开。",
  local: "所有内容都保存在这部手机上，并用您的密码加锁。ThaiPass 不会收到这些内容。", forget: "忘记密码将无法恢复内容。短密码只能防止被随手打开：请设置较长的密码。",
  create_title: "设置密码", create_btn: "创建保险箱", pass1: "密码（至少 6 个字符）", pass2: "再次输入密码", pass_short: "请至少使用 6 个字符。", pass_mismatch: "两次输入的密码不一致。",
  unlock_title: "输入密码", unlock_btn: "打开", wrong: "密码不正确。", working: "处理中…", lock: "锁定", unsupported: "此浏览器无法在此保存加密文件。请在 Chrome 或 Safari 中打开，不要在其他应用内打开。",
  tab_docs: "证件", tab_health: "健康卡", add_doc: "添加证件或备忘", doc_type: "类型", doc_title: "标题", doc_note: "备注（可选）", doc_file: "照片或 PDF（可选）",
  type_passport: "护照资料页", type_evoa: "E-VOA / 签证", type_insurance: "保险", type_booking: "酒店或预订", type_ticket: "机票", type_other: "其他",
  save: "保存", saved: "已保存。", empty: "还没有保存任何内容。", open: "打开", download: "下载", del: "删除", del_confirm: "从手机中删除此项吗？", close: "关闭",
  too_big: "文件太大（最大 4 MB）。", bad_type: "请使用照片（JPG、PNG、WebP）或 PDF。", too_many: "最多可保存 40 项。", need_title: "请填写标题。",
  health_hint: "勾选适用的项目。医护人员可用英语和泰语阅读。", h_name: "姓名", h_dob: "出生日期", h_blood: "血型", h_allergies: "过敏", h_conditions: "疾病/健康状况", h_other: "其他（自行填写）", h_meds: "常用药物",
  h_contact: "紧急联系人", h_c_name: "姓名", h_c_phone: "电话", h_c_rel: "关系", h_insurer: "保险公司", h_policy: "保单号", h_ins_phone: "24 小时电话", h_none: "—",
  show_card: "显示健康卡", edit: "编辑", erase_all: "清除这部手机上的所有内容", erase_confirm: "确定清除这部手机上的所有证件和健康卡吗？此操作无法撤销。", erased: "已全部清除。",
  emergency: "紧急电话", back_app: "返回应用", idle: "闲置几分钟后会自动锁定。", card_for_medic: "请出示给正在帮助您的人",
};
export const VAULT_TEXT: PerLang<VaultText> = { en, th, "zh-CN": zh };
