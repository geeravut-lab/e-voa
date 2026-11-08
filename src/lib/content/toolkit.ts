import { EXTRA_LANGS, type ExtraLang, type PerLang } from "./types";
import { PACK_A } from "./lang";

/**
 * "While you are in Thailand": the texts behind the emergency page, the phrase card, the rules check, the TDAC helper and Stay Guard.
 * Written as general guidance from public sources in November 2026. Laws, fees, hours and phone numbers change: every page says so and points to the
 * official channels, and a person who knows the subject should re-check this file before launch and from time to time. Update LAST_REVIEWED when you do.
 */
export const LAST_REVIEWED = "2026-11";

// ---------------------------------------------------------------- emergency numbers (the static offline page public/offline-emergency.html must list the same numbers; a test checks it)
export type Emergency = { number: string; label: PerLang<string>; use: PerLang<string> };
export const EMERGENCY: Emergency[] = [
  { number: "1155", label: { en: "Tourist Police", th: "ตำรวจท่องเที่ยว", "zh-CN": "旅游警察" }, use: { en: "Police who help foreign visitors; English is spoken.", th: "ตำรวจที่ช่วยเหลือนักท่องเที่ยวต่างชาติ พูดภาษาอังกฤษได้", "zh-CN": "协助外国游客的警察，可用英语沟通。" } },
  { number: "191", label: { en: "Police", th: "ตำรวจ", "zh-CN": "警察" }, use: { en: "Any emergency that needs the police. The operator may speak only Thai.", th: "เหตุฉุกเฉินที่ต้องการตำรวจ ผู้รับสายอาจพูดได้เฉพาะภาษาไทย", "zh-CN": "任何需要警察的紧急情况。接线员可能只会说泰语。" } },
  { number: "1669", label: { en: "Ambulance / medical emergency", th: "รถพยาบาล / เหตุฉุกเฉินทางการแพทย์", "zh-CN": "救护车 / 医疗急救" }, use: { en: "Serious illness or injury.", th: "เจ็บป่วยหรือบาดเจ็บรุนแรง", "zh-CN": "严重疾病或受伤。" } },
  { number: "199", label: { en: "Fire", th: "ดับเพลิง", "zh-CN": "消防" }, use: { en: "Fire and rescue.", th: "เหตุไฟไหม้และกู้ภัย", "zh-CN": "火灾与救援。" } },
  { number: "1672", label: { en: "Tourism Authority of Thailand (TAT)", th: "การท่องเที่ยวแห่งประเทศไทย (ททท.)", "zh-CN": "泰国旅游局 (TAT)" }, use: { en: "Help and information for tourists.", th: "ช่วยเหลือและให้ข้อมูลนักท่องเที่ยว", "zh-CN": "为游客提供帮助和信息。" } },
  { number: "1178", label: { en: "Immigration Bureau hotline", th: "สายด่วนสำนักงานตรวจคนเข้าเมือง", "zh-CN": "移民局热线" }, use: { en: "Questions about visas, stay and extensions.", th: "สอบถามเรื่องวีซ่า ระยะพำนัก และการต่อวีซ่า", "zh-CN": "咨询签证、停留期限和延期。" } },
];
export const EMERGENCY_NOTE: PerLang<string> = {
  en: "If one number does not connect, try 191 or 1155. Numbers are as published by Thai authorities and can change; check the Official channels page.",
  th: "ถ้าสายหนึ่งไม่ติด ให้ลอง 191 หรือ 1155 หมายเลขเป็นไปตามที่หน่วยงานไทยประกาศและอาจเปลี่ยนแปลง ตรวจสอบที่หน้าช่องทางทางการ",
  "zh-CN": "如果某个号码打不通，请试试 191 或 1155。号码以泰国官方公布为准，可能变动，请查看“官方渠道”页面。",
};

// ---------------------------------------------------------------- Thai phrase card: tap a phrase and show the Thai to the person you are talking to
export type Phrase = { id: string; urgent?: boolean; th: string; roman: string; en: string; zh: string; more?: Partial<Record<ExtraLang, string>> };          // more: the meaning in the six later languages
export const PHRASES: Phrase[] = [
  { id: "help", urgent: true, th: "ช่วยด้วย", roman: "chûai dûai", en: "Help!", zh: "救命！" },
  { id: "ambulance", urgent: true, th: "เรียกรถพยาบาลหน่อย", roman: "riak rót pha-yaa-baan nòi", en: "Please call an ambulance.", zh: "请叫救护车。" },
  { id: "police", urgent: true, th: "เรียกตำรวจหน่อย", roman: "riak dtam-rùat nòi", en: "Please call the police.", zh: "请报警。" },
  { id: "hospital", urgent: true, th: "ต้องไปโรงพยาบาล", roman: "dtông bpai roong-pha-yaa-baan", en: "I need to go to the hospital.", zh: "我需要去医院。" },
  { id: "unwell", urgent: true, th: "ไม่สบาย", roman: "mâi sa-baai", en: "I am not well.", zh: "我不舒服。" },
  { id: "allergy", urgent: true, th: "แพ้ยา", roman: "pɛ́ɛ yaa", en: "I am allergic to medicine.", zh: "我对药物过敏。" },
  { id: "passport", th: "หนังสือเดินทางหาย", roman: "nǎng-sʉ̌ʉ dəən-taang hǎai", en: "I lost my passport.", zh: "我的护照丢了。" },
  { id: "write", th: "กรุณาเขียนให้หน่อย", roman: "ga-ru-naa kǐan hâi nòi", en: "Please write it down.", zh: "请写下来。" },
  { id: "understand", th: "ไม่เข้าใจ", roman: "mâi kâo-jai", en: "I do not understand.", zh: "我不明白。" },
  { id: "here", th: "ไปที่นี่", roman: "bpai têe-nîi", en: "Take me here (show the address).", zh: "请带我到这里（出示地址）。" },
  { id: "stop", th: "จอดตรงนี้", roman: "jòt dtrong-níi", en: "Stop here.", zh: "请在这里停车。" },
  { id: "meter", th: "ขอเปิดมิเตอร์ด้วย", roman: "kǒr bpèrt mi-dtêr dûai", en: "Please use the meter.", zh: "请打表。" },
  { id: "howmuch", th: "เท่าไหร่", roman: "tâo-rài", en: "How much?", zh: "多少钱？" },
  { id: "expensive", th: "แพงไป", roman: "pɛɛng bpai", en: "Too expensive.", zh: "太贵了。" },
  { id: "toilet", th: "ห้องน้ำอยู่ที่ไหน", roman: "hɔ̂ng-náam yùu têe-nǎi", en: "Where is the toilet?", zh: "洗手间在哪里？" },
  { id: "notspicy", th: "ไม่เผ็ด", roman: "mâi phèt", en: "Not spicy, please.", zh: "不要辣。" },
  { id: "thanks", th: "ขอบคุณ", roman: "kòp-kun", en: "Thank you.", zh: "谢谢。" },
  { id: "sorry", th: "ขอโทษ", roman: "kǒr-tôht", en: "Sorry / excuse me.", zh: "对不起 / 打扰一下。" },
];

// ---------------------------------------------------------------- rules check
export type RuleItem = { id: string; level: "illegal" | "restricted" | "respect" | "careful"; title: PerLang<string>; text: PerLang<string> };
export const RULES_CHECK: RuleItem[] = [
  { id: "vape", level: "illegal",
    title: { en: "E-cigarettes and vapes", th: "บุหรี่ไฟฟ้า", "zh-CN": "电子烟" },
    text: { en: "Bringing in, owning, selling or using e-cigarettes and e-liquid is against Thai law and the penalties are serious. They can be found by airport X-ray. Leave them at home.", th: "การนำเข้า ครอบครอง ขาย หรือใช้บุหรี่ไฟฟ้าและน้ำยาเป็นความผิดตามกฎหมายไทย และมีโทษร้ายแรง เครื่องเอกซเรย์ที่สนามบินตรวจพบได้ ควรทิ้งไว้ที่บ้าน", "zh-CN": "携带、持有、销售或使用电子烟及烟油违反泰国法律，处罚严厉。机场 X 光机可以检出。请留在家里。" } },
  { id: "drugs", level: "illegal",
    title: { en: "Drugs, and parcels for strangers", th: "ยาเสพติด และพัสดุของคนแปลกหน้า", "zh-CN": "毒品与陌生人托带的包裹" },
    text: { en: "Possession, use and trafficking of drugs carry heavy penalties, including long prison terms. Never carry a bag or parcel for someone you do not know.", th: "การครอบครอง ใช้ และค้ายาเสพติดมีโทษหนัก รวมถึงจำคุกนาน อย่ารับกระเป๋าหรือพัสดุจากคนที่ไม่รู้จัก", "zh-CN": "持有、使用和贩运毒品将面临重罚，包括长期监禁。切勿为不认识的人携带包裹。" } },
  { id: "cannabis", level: "restricted",
    title: { en: "Cannabis", th: "กัญชา", "zh-CN": "大麻" },
    text: { en: "Rules on cannabis changed in 2025 and it is now treated as medical use. Using it in public is an offence. What is legal in your home country is not a guide: check the current rules before you buy or carry anything.", th: "กฎเกี่ยวกับกัญชาเปลี่ยนในปี 2025 และปัจจุบันถือเป็นการใช้ทางการแพทย์ การใช้ในที่สาธารณะเป็นความผิด สิ่งที่ถูกกฎหมายในประเทศของคุณไม่ใช่เกณฑ์ ตรวจสอบกฎล่าสุดก่อนซื้อหรือพกติดตัว", "zh-CN": "大麻规定在 2025 年发生变化，目前按医疗用途管理，在公共场所使用属违法。您本国合法并不代表在这里合法，购买或携带前请核实最新规定。" } },
  { id: "alcohol", level: "restricted",
    title: { en: "Alcohol hours and holy days", th: "เวลาขายแอลกอฮอล์และวันพระใหญ่", "zh-CN": "酒类销售时间与佛教节日" },
    text: { en: "Alcohol may be sold only at certain hours, and sales are limited on some Buddhist holy days and election days. The hours have changed in recent years, so ask your hotel or check locally.", th: "ขายแอลกอฮอล์ได้เฉพาะบางช่วงเวลา และถูกจำกัดในบางวันสำคัญทางพุทธศาสนาและวันเลือกตั้ง เวลาเปลี่ยนไปในช่วงไม่กี่ปีที่ผ่านมา สอบถามโรงแรมหรือตรวจสอบในพื้นที่", "zh-CN": "酒类只能在特定时段销售，部分佛教节日和选举日也有限制。近年来时间有调整，请向酒店询问或在当地确认。" } },
  { id: "smoking", level: "restricted",
    title: { en: "Smoking on beaches and in public places", th: "สูบบุหรี่ที่ชายหาดและที่สาธารณะ", "zh-CN": "海滩和公共场所吸烟" },
    text: { en: "Smoking is banned on many beaches and in places such as restaurants, parks and public transport, with fines. Look for the signs.", th: "ห้ามสูบบุหรี่ในชายหาดหลายแห่งและในสถานที่เช่นร้านอาหาร สวนสาธารณะ และขนส่งสาธารณะ มีโทษปรับ ดูป้ายประกาศ", "zh-CN": "许多海滩以及餐厅、公园、公共交通等场所禁止吸烟，违者罚款。请留意标识。" } },
  { id: "drone", level: "restricted",
    title: { en: "Drones", th: "โดรน", "zh-CN": "无人机" },
    text: { en: "A drone needs registration and permission in Thailand, and flying is banned near airports, palaces and crowds. Read the aviation authority's rules before you bring one.", th: "โดรนต้องลงทะเบียนและขออนุญาตในประเทศไทย และห้ามบินใกล้สนามบิน พระราชวัง และที่ชุมนุมคน อ่านกฎของหน่วยงานการบินก่อนนำมา", "zh-CN": "在泰国使用无人机需要登记并获得许可，机场、王宫和人群附近禁飞。携带前请先阅读民航部门的规定。" } },
  { id: "royal", level: "respect",
    title: { en: "Respect for the royal family", th: "ความเคารพต่อสถาบันพระมหากษัตริย์", "zh-CN": "尊重王室" },
    text: { en: "Insulting or criticising the monarchy is a serious crime, including online posts and jokes. Stand when the royal anthem plays, and never step on money: it carries the King's picture.", th: "การดูหมิ่นหรือวิจารณ์สถาบันพระมหากษัตริย์เป็นความผิดร้ายแรง รวมถึงโพสต์ออนไลน์และมุกตลก ยืนตรงเมื่อเพลงสรรเสริญพระบารมีดังขึ้น และอย่าเหยียบธนบัตรเพราะมีพระบรมสาทิสลักษณ์", "zh-CN": "侮辱或批评王室是严重罪行，包括网络发帖和玩笑。播放王室颂歌时请起立，切勿踩踏钞票，因为上面有国王肖像。" } },
  { id: "temple", level: "respect",
    title: { en: "Temples and Buddha images", th: "วัดและพระพุทธรูป", "zh-CN": "寺庙与佛像" },
    text: { en: "Cover your shoulders and knees and take your shoes off before entering. Never climb on or pose rudely with a Buddha image. Women should not touch a monk or hand things to him directly.", th: "ปกปิดไหล่และเข่า ถอดรองเท้าก่อนเข้า อย่าปีนหรือถ่ายรูปไม่เหมาะสมกับพระพุทธรูป ผู้หญิงไม่ควรสัมผัสพระภิกษุหรือยื่นของให้โดยตรง", "zh-CN": "进入前请遮盖肩膀和膝盖并脱鞋。不要攀爬佛像或做不敬的姿势拍照。女性不应触碰僧人或直接递东西给僧人。" } },
  { id: "photo", level: "careful",
    title: { en: "Photographing restricted places and people", th: "ถ่ายภาพสถานที่หวงห้ามและบุคคล", "zh-CN": "拍摄禁区和他人" },
    text: { en: "Do not photograph military sites or security areas, and ask before you photograph people, monks or children.", th: "ห้ามถ่ายภาพสถานที่ทางทหารหรือพื้นที่รักษาความปลอดภัย และขออนุญาตก่อนถ่ายภาพผู้คน พระภิกษุ หรือเด็ก", "zh-CN": "不要拍摄军事设施或安保区域，拍摄他人、僧人或儿童前请先征得同意。" } },
  { id: "bike", level: "careful",
    title: { en: "Motorbikes and driving", th: "รถจักรยานยนต์และการขับรถ", "zh-CN": "摩托车与驾驶" },
    text: { en: "You need a licence valid for the vehicle (an International Driving Permit that includes motorcycles) and a helmet. Many insurers do not pay if you ride without the right licence. Traffic drives on the left.", th: "ต้องมีใบอนุญาตขับขี่ที่ใช้ได้กับยานพาหนะนั้น (ใบขับขี่สากลที่รวมรถจักรยานยนต์) และสวมหมวกกันน็อก ประกันจำนวนมากไม่จ่ายหากขับขี่โดยไม่มีใบอนุญาตที่ถูกต้อง ขับรถชิดซ้าย", "zh-CN": "需持有适用于该车辆的驾照（包含摩托车的国际驾照）并佩戴头盔。无合适驾照时，许多保险公司不予赔付。泰国靠左行驶。" } },
  { id: "rental", level: "careful",
    title: { en: "Rentals and deposits", th: "การเช่าและเงินมัดจำ", "zh-CN": "租赁与押金" },
    text: { en: "Photograph a rented motorbike or jet ski from every side, with time and place, before you use it. Never leave your passport as a deposit.", th: "ถ่ายภาพมอเตอร์ไซค์หรือเจ็ตสกีที่เช่าให้ครบทุกด้านพร้อมเวลาและสถานที่ก่อนใช้ ห้ามทิ้งหนังสือเดินทางไว้เป็นเงินมัดจำ", "zh-CN": "使用前请从各个角度拍下租来的摩托车或水上摩托，并带有时间和地点。切勿把护照留作押金。" } },
  { id: "money", level: "careful",
    title: { en: "Cash at the border", th: "เงินสดที่ด่านพรมแดน", "zh-CN": "入境携带现金" },
    text: { en: "Large amounts of foreign cash must be declared to customs, and there is a limit on taking Thai baht out. Check the current amounts on the customs website.", th: "เงินตราต่างประเทศจำนวนมากต้องสำแดงต่อศุลกากร และมีข้อจำกัดในการนำเงินบาทออกนอกประเทศ ตรวจสอบจำนวนล่าสุดที่เว็บไซต์ศุลกากร", "zh-CN": "大额外币现金须向海关申报，带出泰铢也有限额。请在海关网站核实最新金额。" } },
];
export const LEVEL_LABEL: Record<RuleItem["level"], PerLang<string>> = {
  illegal: { en: "Not allowed", th: "ห้าม", "zh-CN": "禁止" },
  restricted: { en: "Restricted", th: "มีข้อจำกัด", "zh-CN": "有限制" },
  respect: { en: "Show respect", th: "แสดงความเคารพ", "zh-CN": "请尊重" },
  careful: { en: "Be careful", th: "ระวัง", "zh-CN": "请注意" },
};
export const RULES_NOTE: PerLang<string> = {
  en: "General guidance from public sources, last reviewed in {when}. Laws change and officers decide each case: check the official channels before you rely on any of it. This is not legal advice.",
  th: "คำแนะนำทั่วไปจากแหล่งข้อมูลสาธารณะ ตรวจทานล่าสุด {when} กฎหมายเปลี่ยนได้และเจ้าหน้าที่ตัดสินเป็นรายกรณี ตรวจสอบช่องทางทางการก่อนยึดถือ นี่ไม่ใช่คำแนะนำทางกฎหมาย",
  "zh-CN": "基于公开资料的一般性指引，最近一次审核时间：{when}。法律会变化，官员会逐案裁量，请在依赖前核对官方渠道。本内容不构成法律意见。",
};

// ---------------------------------------------------------------- TDAC (Thailand Digital Arrival Card)
export const TDAC_URL = "https://tdac.immigration.go.th";
export const TDAC: PerLang<{ intro: string; steps: string[]; warn: string[]; note: string }> = {
  en: {
    intro: "Foreign visitors fill in the Thailand Digital Arrival Card (TDAC) online before they arrive. It is free and it is separate from your visa: the e-VOA does not replace it.",
    steps: ["Fill it in on the official TDAC website, within the 3 days before you arrive (the arrival day counts).", "Have ready: passport, flight number and arrival date, the country you come from, and the address where you will stay.", "Save or screenshot the confirmation. You may be asked to show it with your passport.", "If your plans change, check how to update the card on the official site."],
    warn: ["The card is free. Websites that charge a fee are not the official one.", "Type the address yourself: do not follow links from messages or ads.", "Never pay anyone to fill it in unless you chose to hire a service knowingly."],
    note: "Requirements can change. Confirm the current rules on the official website.",
  },
  th: {
    intro: "ผู้เข้าเมืองที่เป็นชาวต่างชาติต้องกรอกบัตรเข้าเมืองดิจิทัลของไทย (TDAC) ออนไลน์ก่อนมาถึง ไม่มีค่าใช้จ่ายและแยกจากวีซ่า e-VOA ใช้แทนกันไม่ได้",
    steps: ["กรอกที่เว็บไซต์ TDAC ทางการ ภายใน 3 วันก่อนมาถึง (นับวันที่มาถึงด้วย)", "เตรียมพาสปอร์ต เลขเที่ยวบินและวันที่มาถึง ประเทศที่เดินทางมา และที่อยู่ที่พัก", "บันทึกหรือแคปหน้าจอหลักฐานยืนยัน อาจถูกขอให้แสดงพร้อมพาสปอร์ต", "ถ้าแผนเปลี่ยน ดูวิธีแก้ไขบัตรที่เว็บไซต์ทางการ"],
    warn: ["บัตรนี้ไม่มีค่าใช้จ่าย เว็บไซต์ที่เก็บเงินไม่ใช่เว็บทางการ", "พิมพ์ที่อยู่เว็บเอง อย่ากดลิงก์จากข้อความหรือโฆษณา", "อย่าจ่ายเงินให้ใครกรอกแทน เว้นแต่คุณเลือกใช้บริการนั้นโดยรู้ตัว"],
    note: "ข้อกำหนดอาจเปลี่ยนแปลง ตรวจสอบกฎล่าสุดที่เว็บไซต์ทางการ",
  },
  "zh-CN": {
    intro: "外国访客须在抵达前在线填写泰国数字入境卡（TDAC）。该卡免费，与签证无关，e-VOA 不能替代它。",
    steps: ["在抵达前 3 天内（含抵达当天）于泰国官方 TDAC 网站填写。", "备好护照、航班号和抵达日期、出发国家以及住宿地址。", "保存或截图确认页面，入境时可能需要连同护照出示。", "如行程变更，请在官方网站查看如何更新。"],
    warn: ["该卡免费，收费的网站不是官方网站。", "请自行输入网址，不要点击消息或广告里的链接。", "除非您明知并自愿选择，否则不要花钱请人代填。"],
    note: "要求可能变化，请在官方网站确认最新规定。",
  },
};

// ---------------------------------------------------------------- Stay Guard
export const STAY: PerLang<{ intro: string; how: string; extend: string; overstay: string; stamp: string }> = {
  en: {
    intro: "Stay Guard counts the days you may stay. It reminds you 7, 3 and 1 day before your permitted stay ends.",
    how: "The arrival day counts as day 1. Example: a 15-day stay that starts on the 1st ends on the 15th.",
    stamp: "This is an estimate from the arrival date on your application. The stamp the officer puts in your passport is what counts: if it shows a different date, use that one.",
    extend: "If you need more time, ask an Immigration office before your last day. An extension is usually possible for a fee and is the officer's decision; confirm the current fee and documents with Immigration.",
    overstay: "Staying after the permitted date is an offence: there is a fine for each day, and a long overstay can lead to a ban on coming back. Leave or extend in time.",
  },
  th: {
    intro: "Stay Guard นับจำนวนวันที่คุณอยู่ได้ และเตือนก่อนสิ้นสุดระยะพำนัก 7, 3 และ 1 วัน",
    how: "นับวันที่มาถึงเป็นวันที่ 1 ตัวอย่าง: พำนัก 15 วันที่เริ่มวันที่ 1 จะสิ้นสุดวันที่ 15",
    stamp: "นี่เป็นการประมาณจากวันที่มาถึงในใบสมัคร สิ่งที่นับจริงคือตราประทับที่เจ้าหน้าที่ประทับในหนังสือเดินทาง ถ้าวันที่ต่างกัน ให้ใช้วันที่ในตราประทับ",
    extend: "ถ้าต้องการอยู่นานขึ้น ให้ไปที่สำนักงานตรวจคนเข้าเมืองก่อนวันสุดท้าย โดยทั่วไปต่อได้โดยเสียค่าธรรมเนียมและขึ้นกับดุลพินิจเจ้าหน้าที่ ตรวจสอบค่าธรรมเนียมและเอกสารล่าสุดกับ ตม.",
    overstay: "การอยู่เกินวันที่อนุญาตเป็นความผิด มีค่าปรับรายวัน และการอยู่เกินนานอาจถูกห้ามเข้าประเทศ ควรเดินทางออกหรือต่อให้ทัน",
  },
  "zh-CN": {
    intro: "Stay Guard 帮您计算可停留的天数，并在获准停留结束前 7、3、1 天提醒您。",
    how: "抵达当天算第 1 天。例如：从 1 日开始的 15 天停留，到 15 日结束。",
    stamp: "这是根据申请中的抵达日期得出的估算。以官员盖在护照上的印章为准，如日期不同，请以印章为准。",
    extend: "如需延长，请在最后一天之前前往移民局办理。通常可付费延期，但由官员决定；请向移民局确认当前费用和所需文件。",
    overstay: "超过获准日期停留属违法：按天罚款，长期逾期还可能被禁止再次入境。请及时离境或办理延期。",
  },
};

// ---------------------------------------------------------------- the six later languages (content/lang/<code>-a.ts): added to the built-in lists when this file loads
for (const l of EXTRA_LANGS) {
  const p = PACK_A[l]; if (!p) continue;
  for (const e of EMERGENCY) { const t = p.emergency[e.number]; if (t) { e.label[l] = t[0]; e.use[l] = t[1]; } }
  EMERGENCY_NOTE[l] = p.emergencyNote;
  for (const ph of PHRASES) { const m = p.phrases[ph.id]; if (m) (ph.more ??= {})[l] = m; }
  for (const r of RULES_CHECK) { const t = p.rules[r.id]; if (t) { r.title[l] = t[0]; r.text[l] = t[1]; } }
  for (const k of Object.keys(LEVEL_LABEL) as RuleItem["level"][]) LEVEL_LABEL[k][l] = p.levels[k];
  RULES_NOTE[l] = p.rulesNote; TDAC[l] = p.tdac; STAY[l] = p.stay;
}
