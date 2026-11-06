import type { PerLang } from "./types";

export type Step = { h: string; p: string };

/** Before you apply: the list shown on /prepare. Keep in step with the required_documents setting and the pre-check rules (passport 180 days, stay up to 15 days). */
export const PREPARE: PerLang<{ intro: string; items: Step[] }> = {
  en: { intro: "Have these ready before you start. It takes about 10 minutes.", items: [
    { h: "Passport", p: "Valid for at least 6 months after the day you arrive. Keep it with you: you need the photo page and the two lines of letters at its bottom." },
    { h: "A face photo", p: "Facing the camera, plain light background, good light, no filters or glasses glare. We check light and sharpness and shrink the file for you." },
    { h: "Return or onward flight ticket", p: "A ticket that leaves Thailand within the permitted stay (up to 15 days)." },
    { h: "Where you will stay", p: "A hotel or accommodation booking with the name and address, for at least your first nights." },
    { h: "Proof of funds", p: "A bank statement or similar showing you can pay for your stay." },
    { h: "Travel insurance", p: "Upload your policy, or add insurance as an extra and we attach it for you." },
    { h: "Your flight details", p: "Flight number and date. Type them and we fill in the airline, airport and time when we can." },
    { h: "A way to pay", p: "A bank card. Payment is in Thai baht." },
  ] },
  th: { intro: "เตรียมสิ่งเหล่านี้ให้พร้อมก่อนเริ่ม ใช้เวลาประมาณ 10 นาที", items: [
    { h: "พาสปอร์ต", p: "เหลืออายุอย่างน้อย 6 เดือนหลังวันที่คุณมาถึง ถือไว้ใกล้มือ เพราะต้องใช้หน้าข้อมูลและสองบรรทัดตัวอักษรที่อยู่ด้านล่าง" },
    { h: "รูปถ่ายหน้าตรง", p: "หน้าตรง พื้นหลังสีอ่อนเรียบ แสงดี ไม่ใช้ฟิลเตอร์หรือให้แว่นสะท้อนแสง เราตรวจแสงและความคมชัด และย่อไฟล์ให้" },
    { h: "ตั๋วเครื่องบินขากลับหรือเดินทางต่อ", p: "ตั๋วที่ออกจากประเทศไทยภายในระยะเวลาที่อนุญาตให้พำนัก (ไม่เกิน 15 วัน)" },
    { h: "ที่พักในประเทศไทย", p: "ใบจองโรงแรมหรือที่พัก มีชื่อและที่อยู่ อย่างน้อยสำหรับคืนแรก ๆ" },
    { h: "หลักฐานทางการเงิน", p: "รายการเดินบัญชีหรือเอกสารที่แสดงว่าคุณมีเงินพอสำหรับการเดินทาง" },
    { h: "ประกันการเดินทาง", p: "อัปโหลดกรมธรรม์ของคุณ หรือซื้อประกันเป็นบริการเสริมแล้วเราแนบให้" },
    { h: "ข้อมูลเที่ยวบิน", p: "เลขเที่ยวบินและวันที่ พิมพ์แล้วเราจะกรอกสายการบิน สนามบิน และเวลาให้เมื่อทำได้" },
    { h: "วิธีชำระเงิน", p: "บัตรธนาคาร ชำระเป็นเงินบาท" },
  ] },
  "zh-CN": { intro: "开始前请准备好以下内容，大约需要 10 分钟。", items: [
    { h: "护照", p: "抵达当天起至少还有 6 个月有效期。请随身携带：需要资料页以及页底的两行字符。" },
    { h: "正面照片", p: "正对镜头、浅色纯色背景、光线充足，不用滤镜，避免眼镜反光。我们会检查光线和清晰度，并为您压缩文件。" },
    { h: "返程或续程机票", p: "在允许停留期内（最长 15 天）离开泰国的机票。" },
    { h: "住宿信息", p: "酒店或住宿预订单，含名称和地址，至少覆盖最初几晚。" },
    { h: "资金证明", p: "银行流水或类似文件，证明您有能力支付行程费用。" },
    { h: "旅行保险", p: "上传您的保单，或作为附加服务购买保险，我们会自动附上。" },
    { h: "航班信息", p: "航班号和日期。输入后我们会尽量自动填写航空公司、机场和时间。" },
    { h: "支付方式", p: "银行卡，以泰铢结算。" },
  ] },
};

/** Arriving: general steps. Details differ by airport and can change: signs and staff come first. */
export const ARRIVAL: PerLang<{ intro: string; steps: Step[]; airports: Step[]; note: string }> = {
  en: { intro: "What usually happens when you land with an approved E-VOA.", steps: [
    { h: "Before you land", p: "Open My E-VOA pass once while you have internet, and save the picture. Have your passport ready." },
    { h: "Follow the signs", p: "Follow the signs for arrivals, visa on arrival or e-VOA. Ask a staff member if you are not sure." },
    { h: "Show your E-VOA and passport", p: "The officer checks your passport and your E-VOA (the QR code can be scanned from your phone or a printout)." },
    { h: "Photo and fingerprints", p: "You may be asked for a photo or fingerprints at the desk." },
    { h: "Baggage and customs", p: "Collect your bags and go through customs. Keep your return ticket and accommodation details handy." },
  ], airports: [
    { h: "Bangkok · Suvarnabhumi (BKK)", p: "Thailand's main international airport." },
    { h: "Bangkok · Don Mueang (DMK)", p: "Second Bangkok airport, many regional and low-cost flights." },
    { h: "Phuket (HKT)", p: "International flights to the island." },
    { h: "Chiang Mai (CNX)", p: "International flights to the north." },
  ], note: "Counters, lanes and rules differ by airport and can change. The signs and the officers at the airport have the final say. Which airports accept E-VOA is decided by Thai Immigration." },
  th: { intro: "สิ่งที่มักเกิดขึ้นเมื่อคุณลงเครื่องพร้อม E-VOA ที่อนุมัติแล้ว", steps: [
    { h: "ก่อนเครื่องลง", p: "เปิด \"E-VOA Pass ของฉัน\" ครั้งหนึ่งขณะมีอินเทอร์เน็ต และบันทึกเป็นรูป เตรียมพาสปอร์ตให้พร้อม" },
    { h: "ตามป้าย", p: "ตามป้ายขาเข้า วีซ่าออนอาร์ไรวัล หรือ e-VOA ถามเจ้าหน้าที่หากไม่แน่ใจ" },
    { h: "แสดง E-VOA และพาสปอร์ต", p: "เจ้าหน้าที่ตรวจพาสปอร์ตและ E-VOA ของคุณ (สแกน QR code จากโทรศัพท์หรือเอกสารที่พิมพ์ได้)" },
    { h: "ถ่ายรูปและพิมพ์ลายนิ้วมือ", p: "ที่เคาน์เตอร์ คุณอาจถูกขอให้ถ่ายรูปหรือสแกนลายนิ้วมือ" },
    { h: "รับกระเป๋าและศุลกากร", p: "รับกระเป๋าแล้วผ่านศุลกากร เตรียมตั๋วขากลับและรายละเอียดที่พักไว้ใกล้มือ" },
  ], airports: [
    { h: "กรุงเทพฯ · สุวรรณภูมิ (BKK)", p: "ท่าอากาศยานระหว่างประเทศหลักของไทย" },
    { h: "กรุงเทพฯ · ดอนเมือง (DMK)", p: "ท่าอากาศยานแห่งที่สองของกรุงเทพฯ มีเที่ยวบินภูมิภาคและโลว์คอสต์จำนวนมาก" },
    { h: "ภูเก็ต (HKT)", p: "เที่ยวบินระหว่างประเทศสู่เกาะภูเก็ต" },
    { h: "เชียงใหม่ (CNX)", p: "เที่ยวบินระหว่างประเทศสู่ภาคเหนือ" },
  ], note: "เคาน์เตอร์ ช่องทาง และกฎเกณฑ์ต่างกันตามสนามบินและอาจเปลี่ยนแปลง ป้ายและเจ้าหน้าที่ที่สนามบินเป็นข้อสรุปสุดท้าย สนามบินที่รับ E-VOA เป็นไปตามที่สำนักงานตรวจคนเข้าเมืองกำหนด" },
  "zh-CN": { intro: "持已批准的 E-VOA 降落后通常的流程。", steps: [
    { h: "降落前", p: "在有网络时打开一次“我的 E-VOA 通行证”并保存图片，准备好护照。" },
    { h: "跟随指示牌", p: "跟随入境、落地签或 e-VOA 指示牌，不确定时询问工作人员。" },
    { h: "出示 E-VOA 和护照", p: "工作人员检查护照和 E-VOA（可扫描手机或打印件上的二维码）。" },
    { h: "拍照和按指纹", p: "在柜台可能需要拍照或采集指纹。" },
    { h: "提取行李与海关", p: "取行李并通过海关，请随身准备返程机票和住宿信息。" },
  ], airports: [
    { h: "曼谷 · 素万那普 (BKK)", p: "泰国主要国际机场。" },
    { h: "曼谷 · 廊曼 (DMK)", p: "曼谷第二机场，区域和廉航航班较多。" },
    { h: "普吉 (HKT)", p: "飞往普吉岛的国际航班。" },
    { h: "清迈 (CNX)", p: "飞往泰北的国际航班。" },
  ], note: "各机场的柜台、通道和规定不同且可能变化，以机场现场指示和工作人员为准。哪些机场受理 E-VOA 由泰国移民局决定。" },
};
