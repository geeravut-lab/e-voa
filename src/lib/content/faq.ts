import type { PerLang } from "./types";

export type Faq = { q: string; a: string };

/** Answers only say what this service does and what its own screens show; anything that depends on Thai law points to Thai Immigration or the Fees / eligibility pages. */
export const FAQ: PerLang<Faq[]> = {
  en: [
    { q: "What is ThaiPass e-VOA?", a: "A private service that helps you prepare, check and send your Visa on Arrival application to Thai Immigration before you fly, so you do not queue to apply at the airport." },
    { q: "Is this a government website?", a: "No. We are a private service provider. The decision on your application is made by Thai Immigration. See the Official channels page to recognise our real addresses." },
    { q: "Can I use it? Which nationalities?", a: "Use Check eligibility: it answers from the official lists we load. If the answer says it cannot answer yet, ask the Thai embassy or Thai Immigration." },
    { q: "How long does it take?", a: "Regular: a decision in about 2–3 days. Express: within 24 hours of sending. Order Regular at least 72 hours, and Express at least 24 hours, before you land. The screen shows which one is still possible." },
    { q: "How much does it cost?", a: "The Fees page shows the visa fee and our service fee for each package, per traveler. Extras (insurance, SIM/eSIM, VIP, health) are optional and priced separately." },
    { q: "Can I get a refund?", a: "The visa fee and the service fee are not refunded after payment. Extras you have not used are refunded, automatically if an extra cannot be issued or if the application is rejected." },
    { q: "What do I need to apply?", a: "A passport valid for at least 6 months after arrival, a face photo, a return flight ticket, an accommodation booking, proof of funds and travel insurance (you can buy insurance as an extra). Each document is checked before we send." },
    { q: "Can I apply for my family or friends?", a: "Yes. Add every traveler to one trip and pay once. Each traveler has their own application and status." },
    { q: "How do I show my E-VOA at the airport?", a: "Open My E-VOA pass: it shows a QR code, works without internet once opened, can be saved as a picture and printed. The official E-VOA file can be downloaded too." },
    { q: "My application says Action needed. What now?", a: "Open the application: it tells you what is missing or wrong. Upload or correct it, then press Send again. You can also change the travel dates while nothing has been sent to Immigration." },
    { q: "Can I check my status without signing in?", a: "Yes: use Check my application with the reference, passport number and date of birth." },
    { q: "How is my data protected?", a: "Passport numbers and documents are encrypted, uploaded files are deleted automatically after your trip, and only the people who need them can open them. See the Privacy notice." },
  ],
  th: [
    { q: "ThaiPass e-VOA คืออะไร", a: "เป็นบริการของเอกชนที่ช่วยคุณเตรียม ตรวจสอบ และส่งใบสมัครวีซ่าออนอาร์ไรวัลไปยังสำนักงานตรวจคนเข้าเมืองก่อนบิน คุณจึงไม่ต้องไปต่อคิวยื่นที่สนามบิน" },
    { q: "นี่คือเว็บไซต์ของรัฐบาลหรือไม่", a: "ไม่ใช่ เราเป็นผู้ให้บริการเอกชน ผลการพิจารณาใบสมัครเป็นของสำนักงานตรวจคนเข้าเมือง ดูหน้า \"ช่องทางทางการ\" เพื่อจำที่อยู่จริงของเรา" },
    { q: "ฉันใช้ได้ไหม สัญชาติอะไรบ้าง", a: "ใช้เมนู \"เช็คสิทธิ์\" ระบบตอบจากรายชื่อทางการที่เราใส่ไว้ หากขึ้นว่ายังตอบไม่ได้ ให้สอบถามสถานทูตไทยหรือสำนักงานตรวจคนเข้าเมือง" },
    { q: "ใช้เวลานานแค่ไหน", a: "แพ็กเกจปกติทราบผลประมาณ 2–3 วัน แพ็กเกจด่วนภายใน 24 ชั่วโมงหลังส่ง สั่งแพ็กเกจปกติล่วงหน้าอย่างน้อย 72 ชั่วโมง และแพ็กเกจด่วนอย่างน้อย 24 ชั่วโมงก่อนเครื่องลง หน้าจอจะบอกว่าแพ็กเกจไหนยังเลือกได้" },
    { q: "ราคาเท่าไร", a: "หน้า \"ค่าธรรมเนียมและการคืนเงิน\" แสดงค่าธรรมเนียมวีซ่าและค่าบริการของแต่ละแพ็กเกจต่อผู้เดินทางหนึ่งคน บริการเสริม (ประกัน ซิม/eSIM VIP สุขภาพ) เป็นตัวเลือกและคิดราคาแยก" },
    { q: "ขอคืนเงินได้ไหม", a: "ค่าธรรมเนียมวีซ่าและค่าบริการไม่คืนหลังชำระเงิน บริการเสริมที่ยังไม่ได้ใช้คืนเงินได้ และคืนอัตโนมัติหากออกบริการไม่ได้หรือใบสมัครถูกปฏิเสธ" },
    { q: "ต้องเตรียมอะไรบ้าง", a: "พาสปอร์ตที่เหลืออายุอย่างน้อย 6 เดือนหลังวันมาถึง รูปถ่ายหน้าตรง ตั๋วเครื่องบินขากลับ ใบจองที่พัก หลักฐานทางการเงิน และประกันการเดินทาง (ซื้อประกันเป็นบริการเสริมได้) เราตรวจเอกสารทุกอย่างก่อนส่ง" },
    { q: "ยื่นให้ครอบครัวหรือเพื่อนได้ไหม", a: "ได้ เพิ่มผู้เดินทางทุกคนในทริปเดียว แล้วชำระครั้งเดียว ผู้เดินทางแต่ละคนมีใบสมัครและสถานะของตนเอง" },
    { q: "แสดง E-VOA ที่สนามบินอย่างไร", a: "เปิด \"E-VOA Pass ของฉัน\" จะเห็น QR code เปิดครั้งหนึ่งแล้วใช้ได้แม้ไม่มีอินเทอร์เน็ต บันทึกเป็นรูปและพิมพ์ได้ และดาวน์โหลดไฟล์ E-VOA ฉบับทางการได้ด้วย" },
    { q: "ใบสมัครขึ้นว่า \"ต้องแก้ไข\" ต้องทำอย่างไร", a: "เปิดใบสมัคร ระบบบอกว่าขาดหรือผิดอะไร อัปโหลดหรือแก้ไข แล้วกด \"ส่งอีกครั้ง\" และเปลี่ยนวันเดินทางได้ตราบที่ยังไม่ได้ส่งไปยังตม." },
    { q: "ตรวจสถานะโดยไม่ต้องเข้าสู่ระบบได้ไหม", a: "ได้ ใช้เมนู \"ตรวจสถานะใบสมัคร\" ใส่เลขอ้างอิง เลขพาสปอร์ต และวันเกิด" },
    { q: "ข้อมูลของฉันปลอดภัยแค่ไหน", a: "เลขพาสปอร์ตและเอกสารถูกเข้ารหัส ไฟล์ที่อัปโหลดถูกลบอัตโนมัติหลังการเดินทาง และเปิดดูได้เฉพาะผู้ที่จำเป็น ดู \"นโยบายความเป็นส่วนตัว\"" },
  ],
  "zh-CN": [
    { q: "ThaiPass e-VOA 是什么？", a: "这是一项私营服务，帮助您在出发前准备、检查并向泰国移民局提交落地签申请，免去机场排队申请。" },
    { q: "这是政府网站吗？", a: "不是。我们是私营服务商，申请结果由泰国移民局决定。请查看“官方渠道”页面，认清我们的真实地址。" },
    { q: "我可以使用吗？哪些国籍？", a: "请使用“资格查询”：它依据我们录入的官方名单回答。若显示暂无法回答，请咨询泰国使领馆或泰国移民局。" },
    { q: "需要多长时间？", a: "标准：约 2–3 天出结果；加急：提交后 24 小时内。标准套餐至少在降落前 72 小时、加急至少在 24 小时前申请，页面会显示哪种仍可选。" },
    { q: "费用是多少？", a: "“费用”页面按每位旅客显示各套餐的签证费和我们的服务费。附加服务（保险、SIM/eSIM、VIP、健康）为可选项，单独计价。" },
    { q: "可以退款吗？", a: "付款后签证费和服务费不予退还。未使用的附加服务可退款；附加服务无法出单或申请被拒时自动退款。" },
    { q: "申请需要准备什么？", a: "抵达后至少还有 6 个月有效期的护照、正面免冠照片、返程机票、住宿预订、资金证明和旅行保险（保险可作为附加服务购买）。提交前我们会逐项检查。" },
    { q: "可以替家人或朋友申请吗？", a: "可以。把所有旅客加到同一个行程中，一次付款。每位旅客有各自的申请和状态。" },
    { q: "在机场如何出示 E-VOA？", a: "打开“我的 E-VOA 通行证”，会显示二维码；打开一次后无网络也可查看，可保存为图片并打印，也可下载官方 E-VOA 文件。" },
    { q: "申请显示“需要处理”怎么办？", a: "打开申请，系统会告诉您缺少或有误的内容。上传或更正后点“重新提交”。在提交移民局之前也可以更改出行日期。" },
    { q: "不登录能查询状态吗？", a: "可以，使用“查询申请状态”，填写申请编号、护照号码和出生日期。" },
    { q: "我的数据如何保护？", a: "护照号码和文件均加密，上传文件在行程结束后自动删除，只有必要的人员才能查看。详见“隐私声明”。" },
  ],
};
