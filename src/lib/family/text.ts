import type { PerLang } from "@/lib/content/types";
import { EXTRA_LANGS, forLang } from "@/lib/content/types";
import { PACK_B } from "@/lib/content/lang";
import type { Lang } from "@/lib/i18n/langs";
// Words of the family check-in: the screens and the e-mails to contacts. Written in English, Thai and Chinese; the other languages show English until someone translates them.
import type { FamText } from "./text-type";
export type { FamText };
const en: FamText = {
  title: "Family check-in", hint: "Tell the people who worry about you that you are fine, and let them know if you go quiet. You choose who sees what.",
  safe_btn: "I am safe", help_btn: "I need help", checked: "Last check-in: {time} (Thai time)", never: "You have not checked in yet.", next_due: "Next check-in due: {time}",
  help_title: "Send “I need help”", help_text: "Your contacts get an e-mail at once. It tells them to try calling you and gives the emergency numbers. This does NOT call the police for you: call 1155 or 191 yourself if you are in danger.",
  help_pos: "Include my position in the message (about 100 m)", help_send: "Send “I need help” now", help_cancel: "Cancel", help_sent: "Your contacts were told.", safe_sent: "Saved. Your contacts will see it.", no_contacts: "You have no contact who accepted yet, so nobody was told.",
  sched_title: "Check-in schedule", sched_on: "Ask me to check in regularly, and tell my contacts if I do not", sched_every: "Check in every", sched_hours: "{n} hours", sched_grace: "Wait this long before telling my contacts", sched_until: "Until (the last day of my trip)", sched_save: "Save the schedule", sched_saved: "Schedule saved.",
  sched_hint: "We remind you when a check-in is due. If you still have not checked in after the waiting time, your contacts get an e-mail. A flat battery or no signal can cause this: check in as soon as you can.",
  contacts_title: "People who can see my check-ins", contacts_hint: "Up to 5. Each person must accept by e-mail. They see your first name, when you last checked in and whether you said you are safe. They never see where you are, except on an “I need help” you chose to include your position in.",
  c_name: "Name", c_email: "E-mail", c_lang: "Their language", c_add: "Invite", c_pending: "Waiting for them to accept", c_accepted: "Accepted", c_left: "Stopped", c_resend: "Send a new invitation", c_remove: "Remove", c_link: "Link to send them (shown once):",
  c_nomail: "E-mail is not set up on this service: copy the link and send it to them yourself.", c_invited: "Invitation sent.", c_removed: "Removed.", c_none: "No one yet.",
  history: "Recent check-ins", h_safe: "I am safe", h_help: "I need help", privacy: "Check-ins are kept for 30 days. You can remove a person at any time, and everything is deleted if you delete your account.",
  signin: "Sign in to use the family check-in.", lang_note: "The e-mail to them is sent in this language (English if it is not available).",
  v_title: "Safety check-in", v_pending: "{name} asked you to be a safety contact while travelling in Thailand. If you accept, you can see when {name} last checked in and whether they said they are safe. You can stop at any time.", v_accept: "Accept", v_decline: "No, thank you", v_accepted: "Thank you. You will get an e-mail if {name} needs help or misses a check-in.",
  v_last: "Last check-in", v_never: "{name} has not checked in yet.", v_safe: "said they are safe", v_help: "pressed “I need help”", v_overdue: "A check-in is overdue. This is often a flat battery or no signal.", v_ok: "No check-in is overdue.", v_ended: "This check-in has ended.", v_invalid: "This link is not valid.", v_left: "You will no longer get updates.", v_leave: "Stop receiving updates",
  v_todo: "If you are worried: call or message them first. If you cannot reach them, call the Tourist Police 1155 (English) or 191 in Thailand, and contact their embassy.", v_note: "This page shows only what the traveler chose to share. It is not a tracking service.",
  m_invite_subject: "{name} asked you to be a safety contact", m_invite_body: "{name} is travelling in Thailand and would like you to be a safety contact on ThaiPass e-VOA. You would see their first name, when they last checked in, and whether they said they are safe. You can stop at any time.", m_invite_btn: "Review and accept",
  m_help_subject: "{name} pressed “I need help”", m_help_body: "{name} pressed “I need help” at {time} (Thai time). Try to call them now. If you cannot reach them, call the Tourist Police 1155 (English) or 191 in Thailand, and contact their embassy.", m_help_pos: "Their position, about 100 m: {pos}", m_pos_link: "Open in a map",
  m_missed_subject: "{name} has not checked in", m_missed_body: "{name} was due to check in at {due} (Thai time) and has not. This is often a flat battery or no signal. Try to call or message them. If you are worried, call the Tourist Police 1155 (English) or 191 in Thailand. Last check-in: {last}.",
  m_back_subject: "{name} checked in: all good", m_back_body: "{name} checked in at {time} (Thai time) and said they are safe.", m_open: "Open the status page", m_footer: "You received this because {name} added you as a safety contact. You can stop on the status page at any time.",
  n_remind_title: "Time to check in", n_remind_body: "Tap “I am safe” so your contacts know you are fine. If you do not, your contacts will be told in {hours} hour(s).", n_alert_title: "We told your contacts", n_alert_body: "You missed a check-in, so {n} contact(s) were e-mailed. Check in now so they know you are safe.",
};
const th: FamText = {
  title: "เช็กอินกับครอบครัว", hint: "บอกคนที่เป็นห่วงว่าคุณปลอดภัย และให้เขารู้ถ้าคุณขาดการติดต่อ คุณเลือกเองว่าใครเห็นอะไร",
  safe_btn: "ฉันปลอดภัย", help_btn: "ฉันต้องการความช่วยเหลือ", checked: "เช็กอินล่าสุด: {time} (เวลาไทย)", never: "คุณยังไม่ได้เช็กอิน", next_due: "ต้องเช็กอินครั้งถัดไป: {time}",
  help_title: "ส่ง “ฉันต้องการความช่วยเหลือ”", help_text: "ผู้ติดต่อของคุณจะได้รับอีเมลทันที บอกให้ลองโทรหาคุณและมีเบอร์ฉุกเฉิน ปุ่มนี้ไม่ได้โทรหาตำรวจให้ ถ้าอยู่ในอันตรายให้โทร 1155 หรือ 191 เอง",
  help_pos: "ใส่ตำแหน่งของฉันในข้อความ (คลาดเคลื่อนประมาณ 100 ม.)", help_send: "ส่ง “ฉันต้องการความช่วยเหลือ” ตอนนี้", help_cancel: "ยกเลิก", help_sent: "แจ้งผู้ติดต่อของคุณแล้ว", safe_sent: "บันทึกแล้ว ผู้ติดต่อของคุณจะเห็น", no_contacts: "ยังไม่มีผู้ติดต่อที่ตอบรับ จึงยังไม่มีใครได้รับแจ้ง",
  sched_title: "ตารางเช็กอิน", sched_on: "ให้เตือนฉันเช็กอินเป็นระยะ และแจ้งผู้ติดต่อถ้าฉันไม่เช็กอิน", sched_every: "เช็กอินทุก", sched_hours: "{n} ชั่วโมง", sched_grace: "รอนานเท่านี้ก่อนแจ้งผู้ติดต่อ", sched_until: "ถึงวันที่ (วันสุดท้ายของทริป)", sched_save: "บันทึกตาราง", sched_saved: "บันทึกตารางแล้ว",
  sched_hint: "เราจะเตือนเมื่อถึงเวลาเช็กอิน ถ้าผ่านเวลารอแล้วยังไม่เช็กอิน ผู้ติดต่อของคุณจะได้รับอีเมล สาเหตุอาจเป็นแบตหมดหรือไม่มีสัญญาณ ให้เช็กอินทันทีที่ทำได้",
  contacts_title: "คนที่เห็นการเช็กอินของฉันได้", contacts_hint: "สูงสุด 5 คน แต่ละคนต้องตอบรับทางอีเมล เขาเห็นชื่อต้นของคุณ เวลาที่เช็กอินล่าสุด และว่าคุณบอกว่าปลอดภัยหรือไม่ เขาไม่เห็นว่าคุณอยู่ที่ไหน ยกเว้นตอนกด “ต้องการความช่วยเหลือ” ที่คุณเลือกใส่ตำแหน่ง",
  c_name: "ชื่อ", c_email: "อีเมล", c_lang: "ภาษาของเขา", c_add: "เชิญ", c_pending: "รอเขาตอบรับ", c_accepted: "ตอบรับแล้ว", c_left: "หยุดรับแล้ว", c_resend: "ส่งคำเชิญใหม่", c_remove: "ลบ", c_link: "ลิงก์ที่ส่งให้เขา (แสดงครั้งเดียว):",
  c_nomail: "บริการนี้ยังไม่ได้ตั้งค่าอีเมล คัดลอกลิงก์แล้วส่งให้เขาเอง", c_invited: "ส่งคำเชิญแล้ว", c_removed: "ลบแล้ว", c_none: "ยังไม่มีใคร",
  history: "การเช็กอินล่าสุด", h_safe: "ฉันปลอดภัย", h_help: "ฉันต้องการความช่วยเหลือ", privacy: "เก็บข้อมูลการเช็กอินไว้ 30 วัน คุณลบใครออกได้ทุกเมื่อ และทุกอย่างจะถูกลบเมื่อคุณลบบัญชี",
  signin: "เข้าสู่ระบบเพื่อใช้เช็กอินกับครอบครัว", lang_note: "อีเมลถึงเขาจะส่งเป็นภาษานี้ (ถ้าไม่มีจะเป็นภาษาอังกฤษ)",
  v_title: "เช็กอินความปลอดภัย", v_pending: "{name} ขอให้คุณเป็นผู้ติดต่อด้านความปลอดภัยระหว่างเดินทางในประเทศไทย ถ้าตอบรับ คุณจะเห็นว่า {name} เช็กอินล่าสุดเมื่อไรและบอกว่าปลอดภัยหรือไม่ หยุดรับได้ทุกเมื่อ", v_accept: "ตอบรับ", v_decline: "ไม่ขอบคุณ", v_accepted: "ขอบคุณ คุณจะได้รับอีเมลถ้า {name} ต้องการความช่วยเหลือหรือไม่ได้เช็กอิน",
  v_last: "เช็กอินล่าสุด", v_never: "{name} ยังไม่ได้เช็กอิน", v_safe: "บอกว่าปลอดภัย", v_help: "กด “ต้องการความช่วยเหลือ”", v_overdue: "เลยเวลาเช็กอินแล้ว สาเหตุมักเป็นแบตหมดหรือไม่มีสัญญาณ", v_ok: "ไม่มีการเช็กอินที่เลยกำหนด", v_ended: "การเช็กอินนี้สิ้นสุดแล้ว", v_invalid: "ลิงก์นี้ไม่ถูกต้อง", v_left: "คุณจะไม่ได้รับการอัปเดตอีก", v_leave: "หยุดรับการอัปเดต",
  v_todo: "ถ้าเป็นห่วง ให้โทรหรือส่งข้อความหาเขาก่อน ถ้าติดต่อไม่ได้ ให้โทรตำรวจท่องเที่ยว 1155 (พูดอังกฤษได้) หรือ 191 ในประเทศไทย และติดต่อสถานทูตของเขา", v_note: "หน้านี้แสดงเฉพาะสิ่งที่ผู้เดินทางเลือกแบ่งปัน ไม่ใช่บริการติดตามตัว",
  m_invite_subject: "{name} ขอให้คุณเป็นผู้ติดต่อด้านความปลอดภัย", m_invite_body: "{name} กำลังเดินทางในประเทศไทยและอยากให้คุณเป็นผู้ติดต่อด้านความปลอดภัยบน ThaiPass e-VOA คุณจะเห็นชื่อต้นของเขา เวลาเช็กอินล่าสุด และว่าเขาบอกว่าปลอดภัยหรือไม่ หยุดรับได้ทุกเมื่อ", m_invite_btn: "ดูและตอบรับ",
  m_help_subject: "{name} กด “ต้องการความช่วยเหลือ”", m_help_body: "{name} กด “ต้องการความช่วยเหลือ” เมื่อ {time} (เวลาไทย) ลองโทรหาเขาทันที ถ้าติดต่อไม่ได้ ให้โทรตำรวจท่องเที่ยว 1155 (พูดอังกฤษได้) หรือ 191 ในประเทศไทย และติดต่อสถานทูตของเขา", m_help_pos: "ตำแหน่งของเขา (คลาดเคลื่อนประมาณ 100 ม.): {pos}", m_pos_link: "เปิดในแผนที่",
  m_missed_subject: "{name} ยังไม่ได้เช็กอิน", m_missed_body: "{name} ต้องเช็กอินเมื่อ {due} (เวลาไทย) แต่ยังไม่ได้เช็กอิน สาเหตุมักเป็นแบตหมดหรือไม่มีสัญญาณ ลองโทรหรือส่งข้อความหาเขา ถ้าเป็นห่วงให้โทรตำรวจท่องเที่ยว 1155 (พูดอังกฤษได้) หรือ 191 ในประเทศไทย เช็กอินล่าสุด: {last}",
  m_back_subject: "{name} เช็กอินแล้ว: ปลอดภัยดี", m_back_body: "{name} เช็กอินเมื่อ {time} (เวลาไทย) และบอกว่าปลอดภัย", m_open: "เปิดหน้าสถานะ", m_footer: "คุณได้รับอีเมลนี้เพราะ {name} เพิ่มคุณเป็นผู้ติดต่อด้านความปลอดภัย คุณหยุดรับได้ที่หน้าสถานะทุกเมื่อ",
  n_remind_title: "ถึงเวลาเช็กอิน", n_remind_body: "แตะ “ฉันปลอดภัย” เพื่อให้ผู้ติดต่อรู้ว่าคุณสบายดี ถ้าไม่แตะ ผู้ติดต่อจะได้รับแจ้งใน {hours} ชั่วโมง", n_alert_title: "เราแจ้งผู้ติดต่อของคุณแล้ว", n_alert_body: "คุณพลาดการเช็กอิน เราจึงส่งอีเมลถึงผู้ติดต่อ {n} คน เช็กอินตอนนี้เพื่อให้เขารู้ว่าคุณปลอดภัย",
};
const zh: FamText = {
  title: "家人平安签到", hint: "让担心您的人知道您平安，并在您失联时通知他们。谁能看到什么由您决定。",
  safe_btn: "我很安全", help_btn: "我需要帮助", checked: "上次签到：{time}（泰国时间）", never: "您还没有签到。", next_due: "下次签到截止：{time}",
  help_title: "发送“我需要帮助”", help_text: "您的联系人会立刻收到电子邮件，提示他们尝试联系您并附上紧急电话。这不会替您报警：如有危险请自行拨打 1155 或 191。",
  help_pos: "在消息中附上我的位置（约 100 米精度）", help_send: "立即发送“我需要帮助”", help_cancel: "取消", help_sent: "已通知您的联系人。", safe_sent: "已保存。您的联系人可以看到。", no_contacts: "还没有已接受邀请的联系人，因此没有人被通知。",
  sched_title: "签到计划", sched_on: "定期提醒我签到，未签到时通知我的联系人", sched_every: "每隔", sched_hours: "{n} 小时", sched_grace: "等待这么久后再通知我的联系人", sched_until: "截止日期（行程最后一天）", sched_save: "保存计划", sched_saved: "计划已保存。",
  sched_hint: "签到时间到了我们会提醒您。如果超过等待时间仍未签到，您的联系人会收到电子邮件。手机没电或没信号都可能导致这种情况：请尽快签到。",
  contacts_title: "可以看到我签到的人", contacts_hint: "最多 5 人。每人都必须通过电子邮件接受邀请。他们能看到您的名字、上次签到时间以及您是否表示平安。除非您在“我需要帮助”中选择附上位置，否则他们看不到您在哪里。",
  c_name: "姓名", c_email: "电子邮件", c_lang: "对方的语言", c_add: "邀请", c_pending: "等待对方接受", c_accepted: "已接受", c_left: "已停止", c_resend: "重新发送邀请", c_remove: "移除", c_link: "发给对方的链接（只显示一次）：",
  c_nomail: "本服务尚未设置电子邮件：请复制链接自行发给对方。", c_invited: "已发送邀请。", c_removed: "已移除。", c_none: "暂无。",
  history: "最近的签到", h_safe: "我很安全", h_help: "我需要帮助", privacy: "签到记录保留 30 天。您可随时移除某人，删除账号时所有内容一并删除。",
  signin: "请登录后使用家人平安签到。", lang_note: "发给对方的邮件将使用此语言（没有时使用英语）。",
  v_title: "平安签到", v_pending: "{name} 邀请您在其泰国旅行期间担任安全联系人。接受后，您可以看到 {name} 上次签到的时间以及是否表示平安。您可随时停止。", v_accept: "接受", v_decline: "不用了", v_accepted: "谢谢。如果 {name} 需要帮助或错过签到，您会收到电子邮件。",
  v_last: "上次签到", v_never: "{name} 还没有签到。", v_safe: "表示平安", v_help: "按下了“我需要帮助”", v_overdue: "签到已逾期。这通常是手机没电或没信号。", v_ok: "没有逾期的签到。", v_ended: "此签到已结束。", v_invalid: "此链接无效。", v_left: "您将不再收到更新。", v_leave: "停止接收更新",
  v_todo: "如果担心：请先打电话或发消息联系对方。联系不上时，请拨打泰国旅游警察 1155（可用英语）或 191，并联系其大使馆。", v_note: "此页面只显示旅客选择分享的内容，不是跟踪服务。",
  m_invite_subject: "{name} 邀请您担任安全联系人", m_invite_body: "{name} 正在泰国旅行，希望您在 ThaiPass e-VOA 上担任其安全联系人。您将看到其名字、上次签到时间以及是否表示平安。您可随时停止。", m_invite_btn: "查看并接受",
  m_help_subject: "{name} 按下了“我需要帮助”", m_help_body: "{name} 于 {time}（泰国时间）按下了“我需要帮助”。请立即联系对方。联系不上时，请拨打泰国旅游警察 1155（可用英语）或 191，并联系其大使馆。", m_help_pos: "对方位置（约 100 米精度）：{pos}", m_pos_link: "在地图中打开",
  m_missed_subject: "{name} 尚未签到", m_missed_body: "{name} 应在 {due}（泰国时间）签到，但尚未签到。这通常是手机没电或没信号。请尝试致电或发消息。如果担心，请拨打泰国旅游警察 1155（可用英语）或 191。上次签到：{last}。",
  m_back_subject: "{name} 已签到：一切平安", m_back_body: "{name} 于 {time}（泰国时间）签到并表示平安。", m_open: "打开状态页面", m_footer: "您收到此邮件是因为 {name} 将您添加为安全联系人。您可随时在状态页面停止接收。",
  n_remind_title: "该签到了", n_remind_body: "点击“我很安全”，让您的联系人知道您一切安好。如果不点击，{hours} 小时后将通知您的联系人。", n_alert_title: "我们已通知您的联系人", n_alert_body: "您错过了一次签到，因此已向 {n} 位联系人发送邮件。请立即签到，让他们知道您平安。",
};
export const FAMILY_TEXT: PerLang<FamText> = { en, th, "zh-CN": zh };
for (const l of EXTRA_LANGS) { const p = PACK_B[l]; if (p) FAMILY_TEXT[l] = { ...en, ...p.family }; }          // a key missing in a translation shows English
export const famText = (lang: Lang): FamText => forLang(FAMILY_TEXT, lang);
export const fam = (s: string, vars: Record<string, string | number> = {}) => s.replace(/\{(\w+)\}/g, (_m, k: string) => String(vars[k] ?? `{${k}}`));
