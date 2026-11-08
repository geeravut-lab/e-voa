import { EXTRA_LANGS, type PerLang } from "./types";
import { PACK_A } from "./lang";

/** The motorbike / jet-ski / car rental helper: a checklist and the photos to take before using the vehicle. General advice, in three written languages. */
export type CheckItem = { id: string; text: PerLang<string> };
export type CheckGroup = { id: string; title: PerLang<string>; items: CheckItem[] };

export const RENTAL: CheckGroup[] = [
  { id: "before", title: { en: "Before you rent", th: "ก่อนเช่า", "zh-CN": "租之前" }, items: [
    { id: "licence", text: { en: "You have a licence that is valid for this vehicle: an International Driving Permit that includes motorcycles, or a Thai licence. Without it, many insurers do not pay.", th: "คุณมีใบอนุญาตขับขี่ที่ใช้ได้กับยานพาหนะนี้ คือใบขับขี่สากลที่รวมรถจักรยานยนต์ หรือใบขับขี่ไทย ถ้าไม่มี ประกันจำนวนมากไม่จ่าย", "zh-CN": "您持有适用于该车辆的驾照：包含摩托车的国际驾照或泰国驾照。没有的话，许多保险公司不予赔付。" } },
    { id: "insurance", text: { en: "Ask what the rental price covers: damage, theft, injury, and the amount you pay yourself. Ask for it in writing and check your travel insurance covers riding.", th: "ถามว่าค่าเช่าครอบคลุมอะไร ความเสียหาย การโจรกรรม การบาดเจ็บ และส่วนที่คุณต้องจ่ายเอง ขอเป็นลายลักษณ์อักษร และตรวจว่าประกันการเดินทางครอบคลุมการขี่", "zh-CN": "询问租金包含什么：损坏、被盗、受伤，以及您自己承担的金额。请对方书面写明，并确认您的旅行保险涵盖骑行。" } },
    { id: "deposit", text: { en: "Never leave your passport as a deposit. Offer a cash deposit or a copy of your passport instead, and keep the receipt.", th: "ห้ามฝากพาสปอร์ตเป็นเงินมัดจำ ให้วางเงินสดหรือสำเนาพาสปอร์ตแทน และเก็บใบเสร็จไว้", "zh-CN": "绝不要把护照留作押金。可改付现金押金或留护照复印件，并保留收据。" } },
    { id: "contract", text: { en: "Read the contract and the price list. Take a photo of them. Note the shop's name, address and phone number.", th: "อ่านสัญญาและป้ายราคา ถ่ายรูปไว้ จดชื่อร้าน ที่อยู่ และเบอร์โทร", "zh-CN": "阅读合同和价目表并拍照。记下店名、地址和电话。" } },
    { id: "helmet", text: { en: "Take a helmet that fits and a lock. Wearing a helmet is the law and protects you.", th: "รับหมวกกันน็อกที่พอดีและที่ล็อก การสวมหมวกกันน็อกเป็นกฎหมายและช่วยปกป้องคุณ", "zh-CN": "领取合适的头盔和车锁。戴头盔是法律规定，也能保护您。" } },
  ] },
  { id: "pickup", title: { en: "At pick-up", th: "ตอนรับรถ", "zh-CN": "取车时" }, items: [
    { id: "check", text: { en: "Test the brakes, lights, horn, indicators, tyres and mirrors. Do not take a vehicle that is not safe.", th: "ทดสอบเบรก ไฟ แตร ไฟเลี้ยว ยาง และกระจก อย่ารับรถที่ไม่ปลอดภัย", "zh-CN": "测试刹车、灯、喇叭、转向灯、轮胎和后视镜。不安全的车不要接。" } },
    { id: "photos", text: { en: "Photograph or film the whole vehicle with the photo helper below, before you leave the shop, including every scratch that is already there.", th: "ถ่ายรูปหรือวิดีโอรถทั้งคันด้วยตัวช่วยถ่ายรูปด้านล่าง ก่อนออกจากร้าน รวมถึงรอยขีดข่วนทุกจุดที่มีอยู่แล้ว", "zh-CN": "离开店铺前，用下方的拍照助手拍下整辆车，包括原有的每一处划痕。" } },
    { id: "fuel", text: { en: "Note the fuel level and the odometer. Agree who fills the tank and how the vehicle is returned.", th: "จดระดับน้ำมันและเลขไมล์ ตกลงว่าใครเติมน้ำมันและคืนรถอย่างไร", "zh-CN": "记下油量和里程。约定谁加油以及如何还车。" } },
    { id: "damage", text: { en: "Ask the shop to write the existing damage on the contract, or send you a photo of it by message.", th: "ขอให้ร้านเขียนความเสียหายที่มีอยู่ลงในสัญญา หรือส่งรูปให้ทางข้อความ", "zh-CN": "请店家把原有损坏写进合同，或通过消息发给您照片。" } },
  ] },
  { id: "ride", title: { en: "On the road", th: "ระหว่างขับขี่", "zh-CN": "骑行途中" }, items: [
    { id: "left", text: { en: "Traffic keeps left. Go slowly at first, especially in rain and on unfamiliar roads.", th: "ขับชิดซ้าย ค่อย ๆ ขับในช่วงแรก โดยเฉพาะตอนฝนตกและบนถนนที่ไม่คุ้นเคย", "zh-CN": "泰国靠左行驶。起初请慢行，尤其是下雨和路况不熟时。" } },
    { id: "alcohol", text: { en: "Do not ride after drinking. It is dangerous, illegal and insurance will not pay.", th: "อย่าขับขี่หลังดื่มสุรา อันตราย ผิดกฎหมาย และประกันไม่จ่าย", "zh-CN": "饮酒后不要骑行。这既危险又违法，保险也不会赔付。" } },
    { id: "docs", text: { en: "Carry your licence and the rental papers. Keep the shop's phone number and the emergency numbers on your phone.", th: "พกใบขับขี่และเอกสารการเช่า เก็บเบอร์ร้านและเบอร์ฉุกเฉินไว้ในโทรศัพท์", "zh-CN": "随身携带驾照和租车文件。把店家电话和紧急电话存在手机里。" } },
  ] },
  { id: "return", title: { en: "When you return it", th: "ตอนคืนรถ", "zh-CN": "还车时" }, items: [
    { id: "together", text: { en: "Return it during opening hours and check it with the staff present. Photograph it again from every side.", th: "คืนรถในเวลาทำการและตรวจพร้อมพนักงาน ถ่ายรูปอีกครั้งทุกด้าน", "zh-CN": "在营业时间内还车，并与店员一起检查。再次从各个角度拍照。" } },
    { id: "receipt", text: { en: "Ask for a written confirmation that the vehicle came back without damage, and get your deposit back at once.", th: "ขอหนังสือยืนยันว่าคืนรถโดยไม่มีความเสียหาย และรับเงินมัดจำคืนทันที", "zh-CN": "请对方书面确认车辆无损坏归还，并当场退还押金。" } },
    { id: "dispute", text: { en: "If the shop claims damage, stay calm, show your photos, and call the Tourist Police 1155. Do not pay a large amount on the spot and do not leave your passport.", th: "ถ้าร้านอ้างว่ามีความเสียหาย ใจเย็น แสดงรูปถ่ายของคุณ และโทรหาตำรวจท่องเที่ยว 1155 อย่าจ่ายเงินจำนวนมากทันทีและอย่าทิ้งพาสปอร์ตไว้", "zh-CN": "如果店家声称有损坏，请保持冷静、出示您的照片并致电旅游警察 1155。不要当场支付大额费用，也不要留下护照。" } },
  ] },
];
export type PhotoSlot = { id: string; label: PerLang<string> };
export const PHOTO_SLOTS: PhotoSlot[] = [
  { id: "front", label: { en: "Front", th: "ด้านหน้า", "zh-CN": "车头" } },
  { id: "back", label: { en: "Back", th: "ด้านหลัง", "zh-CN": "车尾" } },
  { id: "left", label: { en: "Left side", th: "ด้านซ้าย", "zh-CN": "左侧" } },
  { id: "right", label: { en: "Right side", th: "ด้านขวา", "zh-CN": "右侧" } },
  { id: "plate", label: { en: "Number plate", th: "ป้ายทะเบียน", "zh-CN": "车牌" } },
  { id: "dash", label: { en: "Fuel and odometer", th: "น้ำมันและเลขไมล์", "zh-CN": "油量和里程" } },
  { id: "damage1", label: { en: "Existing damage 1", th: "ความเสียหายที่มีอยู่ 1", "zh-CN": "原有损坏 1" } },
  { id: "damage2", label: { en: "Existing damage 2", th: "ความเสียหายที่มีอยู่ 2", "zh-CN": "原有损坏 2" } },
];

for (const l of EXTRA_LANGS) {
  const p = PACK_A[l]; if (!p) continue;
  for (const g of RENTAL) { const t = p.rental.groups[g.id]; if (t) g.title[l] = t; for (const it of g.items) { const x = p.rental.items[it.id]; if (x) it.text[l] = x; } }
  for (const sl of PHOTO_SLOTS) { const t = p.rental.slots[sl.id]; if (t) sl.label[l] = t; }
}
