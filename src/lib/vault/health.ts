// The bilingual (English + Thai) health card. PURE. The words a medic must understand are fixed here and always shown in both languages;
// what the traveler types (medicines, other conditions, names) is shown as typed. Everything stays on the traveler's phone.
export type Bi = [en: string, th: string];
export type Option = { id: string; en: string; th: string };

export const HEALTH_LABELS = {
  title: ["Emergency health information", "ข้อมูลสุขภาพฉุกเฉิน"] as Bi,
  name: ["Name", "ชื่อ"] as Bi,
  dob: ["Date of birth", "วันเกิด"] as Bi,
  blood: ["Blood group", "หมู่เลือด"] as Bi,
  allergies: ["Allergies", "แพ้"] as Bi,
  conditions: ["Medical conditions", "โรคประจำตัว / ภาวะทางการแพทย์"] as Bi,
  meds: ["Medicines I take", "ยาที่ใช้เป็นประจำ"] as Bi,
  contacts: ["Emergency contacts", "ผู้ติดต่อฉุกเฉิน"] as Bi,
  insurance: ["Travel insurance", "ประกันการเดินทาง"] as Bi,
  policy: ["Policy number", "เลขที่กรมธรรม์"] as Bi,
  phone: ["24-hour phone", "โทรศัพท์ 24 ชั่วโมง"] as Bi,
  none: ["None known", "ไม่มี"] as Bi,
  other: ["Other", "อื่น ๆ"] as Bi,
  note: ["Written by the traveler. This is not a medical record: please confirm with the person if you can.", "ข้อมูลที่ผู้เดินทางกรอกเอง ไม่ใช่เวชระเบียน กรุณายืนยันกับผู้ป่วยถ้าทำได้"] as Bi,
  ask: ["Please call the contact and the insurer, and tell them where I am.", "กรุณาโทรหาผู้ติดต่อฉุกเฉินและบริษัทประกัน และแจ้งว่าฉันอยู่ที่ไหน"] as Bi,
};
export const BLOOD: Option[] = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((g) => ({ id: g, en: `Group ${g}`, th: `หมู่เลือด ${g.replace("+", " (Rh บวก)").replace("-", " (Rh ลบ)")}` }));
export const ALLERGIES: Option[] = [
  { id: "penicillin", en: "Penicillin", th: "เพนิซิลลิน" }, { id: "antibiotics", en: "Other antibiotics", th: "ยาปฏิชีวนะอื่น ๆ" }, { id: "nsaids", en: "Aspirin / anti-inflammatory drugs (NSAIDs)", th: "แอสไพริน / ยาแก้อักเสบกลุ่ม NSAIDs" },
  { id: "peanuts", en: "Peanuts", th: "ถั่วลิสง" }, { id: "treenuts", en: "Tree nuts", th: "ถั่วเปลือกแข็ง" }, { id: "shellfish", en: "Shellfish", th: "อาหารทะเลที่มีเปลือก (กุ้ง ปู หอย)" },
  { id: "eggs", en: "Eggs", th: "ไข่" }, { id: "milk", en: "Milk", th: "นม" }, { id: "latex", en: "Latex", th: "ลาเท็กซ์ (ยาง)" }, { id: "stings", en: "Bee or wasp stings", th: "ผึ้งหรือต่อต่อย" },
];
export const CONDITIONS: Option[] = [
  { id: "diabetes", en: "Diabetes", th: "เบาหวาน" }, { id: "asthma", en: "Asthma", th: "หอบหืด" }, { id: "heart", en: "Heart disease", th: "โรคหัวใจ" }, { id: "bp", en: "High blood pressure", th: "ความดันโลหิตสูง" },
  { id: "epilepsy", en: "Epilepsy", th: "โรคลมชัก" }, { id: "kidney", en: "Kidney disease", th: "โรคไต" }, { id: "pregnant", en: "Pregnancy", th: "ตั้งครรภ์" }, { id: "thinner", en: "Takes blood thinners", th: "ใช้ยาละลายลิ่มเลือด" },
  { id: "pacemaker", en: "Pacemaker or implanted device", th: "เครื่องกระตุ้นหัวใจหรืออุปกรณ์ฝังในร่างกาย" }, { id: "g6pd", en: "G6PD deficiency", th: "ภาวะพร่องเอนไซม์ G6PD" },
];

export type HealthData = {
  name: string; dob: string; blood: string; allergies: string[]; allergyOther: string; conditions: string[]; conditionOther: string; meds: string;
  contacts: { name: string; phone: string; rel: string }[]; insurer: string; policy: string; insurerPhone: string;
};
export const emptyHealth = (): HealthData => ({ name: "", dob: "", blood: "", allergies: [], allergyOther: "", conditions: [], conditionOther: "", meds: "", contacts: [{ name: "", phone: "", rel: "" }, { name: "", phone: "", rel: "" }], insurer: "", policy: "", insurerPhone: "" });

const t = (v: unknown, n: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, n) : "");
const ids = (v: unknown, opts: Option[]) => (Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === "string" && opts.some((o) => o.id === x)))] : []);
/** The saved card, cleaned: unknown choices are dropped, text is cut, nothing else is kept. (The page runs the same rules in the browser.) */
export function cleanHealth(raw: unknown): HealthData {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>, d = emptyHealth();
  const contacts = (Array.isArray(o.contacts) ? o.contacts : []).slice(0, 3).map((c) => { const x = (c ?? {}) as Record<string, unknown>; return { name: t(x.name, 60), phone: t(x.phone, 30).replace(/[^\d+()\- ]/g, ""), rel: t(x.rel, 40) }; });
  return { ...d, name: t(o.name, 80), dob: /^\d{4}-\d{2}-\d{2}$/.test(String(o.dob ?? "")) ? String(o.dob) : "", blood: BLOOD.some((b) => b.id === o.blood) ? String(o.blood) : "", allergies: ids(o.allergies, ALLERGIES), allergyOther: t(o.allergyOther, 200),
    conditions: ids(o.conditions, CONDITIONS), conditionOther: t(o.conditionOther, 200), meds: t(o.meds, 400), contacts: contacts.length ? contacts : d.contacts, insurer: t(o.insurer, 80), policy: t(o.policy, 60), insurerPhone: t(o.insurerPhone, 30).replace(/[^\d+()\- ]/g, "") };
}
export const hasHealthData = (h: HealthData) => !!(h.name || h.blood || h.allergies.length || h.allergyOther || h.conditions.length || h.conditionOther || h.meds || h.contacts.some((c) => c.name || c.phone) || h.insurer || h.policy);
