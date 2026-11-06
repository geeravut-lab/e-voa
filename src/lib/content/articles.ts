import type { PerLang, Section } from "./types";

export type Article = { slug: string; date: string; title: string; summary: string; body: Section[] };

/**
 * Guides for travelers. They explain how the service works and general good practice; anything that depends on Thai law or on a particular airport points to Thai Immigration
 * or says "check at the time". Written as drafts: a person who knows the subject should read them before launch.
 */
export const ARTICLES: PerLang<Article[]> = {
  en: [
    { slug: "how-thailand-e-voa-works", date: "2026-11-08", title: "How the Thailand e-VOA works, step by step", summary: "From checking your nationality to showing your pass at the airport.",
      body: [
        { h: "1. Check that you can apply", p: ["Use Check eligibility to see whether your nationality is on the Visa on Arrival list we load from the official announcement. If it says it cannot answer yet, ask the Thai embassy or Thai Immigration."] },
        { h: "2. Choose Regular or Express", p: ["Regular is decided in about 2–3 days, Express within 24 hours of sending. Order Regular at least 72 hours, and Express at least 24 hours, before you land."] },
        { h: "3. Fill in the form and upload documents", p: ["Add every traveler on the trip. Photograph the passport page and we read the details on your phone. Upload a face photo, return ticket, accommodation booking, proof of funds and insurance."] },
        { h: "4. Pay once", p: ["The price is split into the visa fee, our service fee and any extras you chose. You see the total and the refund rule before you pay."] },
        { h: "5. We check and send", p: ["We check each application before sending it to Thai Immigration. If something is missing you are told exactly what, and you can fix it and send again."] },
        { h: "6. Show your E-VOA at the airport", p: ["When it is approved, open My E-VOA pass. It works without internet once opened, and you can save it as a picture or print it."] },
      ] },
    { slug: "documents-checklist", date: "2026-11-08", title: "The documents to prepare for a Thailand Visa on Arrival", summary: "A short list so the application takes about ten minutes.",
      body: [
        { h: "Passport", p: ["It should be valid for at least six months after the day you arrive. You need the photo page and the two lines of letters at its bottom."] },
        { h: "A good face photo", p: ["Face the camera in good light with a plain, light background. We check light, sharpness, background and whether one face is clearly in the picture."] },
        { h: "Tickets and booking", p: ["A flight ticket that leaves Thailand within the permitted stay (up to 15 days), and a booking that shows where you will stay."] },
        { h: "Money and insurance", p: ["Proof that you can pay for your stay, and travel insurance. If you do not have insurance you can add it as an extra and we attach it."] },
        { h: "Why every document matters", p: ["Missing or unreadable documents are the most common reason an application is sent back. Taking a minute to check each file saves days."] },
      ] },
    { slug: "arriving-in-thailand", date: "2026-11-08", title: "Arriving in Thailand: what to have ready", summary: "Practical tips for the minutes after you land.",
      body: [
        { h: "Before you land", p: ["Open My E-VOA pass once while you still have internet and save the picture. Keep your passport, return ticket and accommodation details where you can reach them."] },
        { h: "At the airport", p: ["Follow the signs and ask staff if unsure. Counters, lanes and rules differ between airports and can change, so the signs and officers at the airport have the final say. See the Airport guide for the airports we list."] },
        { h: "If something goes wrong", p: ["Keep your reference number. Use Check my application to see the status without signing in, or write to us through the Official channels page."] },
      ] },
    { slug: "sim-or-esim-in-thailand", date: "2026-11-08", title: "SIM or eSIM for Thailand: which one?", summary: "How to choose, and what to check before you buy.",
      body: [
        { h: "eSIM", p: ["An eSIM is delivered as a QR code, so there is nothing to collect. Your phone must support eSIM and be network-unlocked. Install it following the instructions we show; many people do it before the flight."] },
        { h: "Physical SIM", p: ["A SIM card is picked up at the airport counter with your passport. It works in any unlocked phone, but you must find the counter after landing."] },
        { h: "What to check", p: ["The number of days, the data included and what happens when it is used up. Extras on this site list these details before you choose."] },
      ] },
    { slug: "travel-insurance-for-thailand", date: "2026-11-08", title: "Why travel insurance is part of your Thailand trip", summary: "What it covers, and how it fits with your application.",
      body: [
        { h: "It is usually requested", p: ["Travel insurance is on the list of documents for the Visa on Arrival application. We attach the policy for you if you buy it as an extra."] },
        { h: "What to look at", p: ["The amount of medical cover, the days covered and the exclusions. The details of each plan are shown with the plan."] },
        { h: "After you buy", p: ["You get the policy number and the e-card in your application page, and the certificate is attached to the application automatically."] },
      ] },
  ],
  th: [
    { slug: "how-thailand-e-voa-works", date: "2026-11-08", title: "e-VOA ประเทศไทยทำงานอย่างไร ทีละขั้นตอน", summary: "ตั้งแต่ตรวจสิทธิ์ตามสัญชาติ จนถึงแสดงบัตรที่สนามบิน",
      body: [
        { h: "1. ตรวจว่ายื่นได้ไหม", p: ["ใช้เมนู \"เช็คสิทธิ์\" เพื่อดูว่าสัญชาติของคุณอยู่ในรายชื่อวีซ่าออนอาร์ไรวัลที่เราใส่จากประกาศทางการหรือไม่ หากขึ้นว่ายังตอบไม่ได้ ให้สอบถามสถานทูตไทยหรือสำนักงานตรวจคนเข้าเมือง"] },
        { h: "2. เลือกแพ็กเกจปกติหรือด่วน", p: ["แพ็กเกจปกติทราบผลประมาณ 2–3 วัน แพ็กเกจด่วนภายใน 24 ชั่วโมงหลังส่ง สั่งแพ็กเกจปกติล่วงหน้าอย่างน้อย 72 ชั่วโมง และแพ็กเกจด่วนอย่างน้อย 24 ชั่วโมงก่อนเครื่องลง"] },
        { h: "3. กรอกฟอร์มและอัปโหลดเอกสาร", p: ["เพิ่มผู้เดินทางทุกคนในทริปเดียว ถ่ายรูปหน้าพาสปอร์ตแล้วระบบอ่านข้อมูลบนโทรศัพท์ของคุณ อัปโหลดรูปถ่ายหน้าตรง ตั๋วขากลับ ใบจองที่พัก หลักฐานทางการเงิน และประกัน"] },
        { h: "4. ชำระเงินครั้งเดียว", p: ["ราคาแยกเป็นค่าธรรมเนียมวีซ่า ค่าบริการของเรา และบริการเสริมที่เลือก คุณเห็นยอดรวมและกติกาการคืนเงินก่อนชำระ"] },
        { h: "5. เราตรวจและส่ง", p: ["เราตรวจใบสมัครแต่ละใบก่อนส่งไปยังสำนักงานตรวจคนเข้าเมือง หากขาดอะไรจะบอกชัดเจน คุณแก้ไขแล้วส่งอีกครั้งได้"] },
        { h: "6. แสดง E-VOA ที่สนามบิน", p: ["เมื่ออนุมัติแล้ว เปิด \"E-VOA Pass ของฉัน\" เปิดครั้งหนึ่งแล้วใช้ได้แม้ไม่มีอินเทอร์เน็ต บันทึกเป็นรูปหรือพิมพ์ได้"] },
      ] },
    { slug: "documents-checklist", date: "2026-11-08", title: "เอกสารที่ต้องเตรียมสำหรับวีซ่าออนอาร์ไรวัลไทย", summary: "รายการสั้น ๆ ให้การยื่นใช้เวลาราว 10 นาที",
      body: [
        { h: "พาสปอร์ต", p: ["ควรเหลืออายุอย่างน้อยหกเดือนหลังวันที่คุณมาถึง ต้องใช้หน้าข้อมูลและสองบรรทัดตัวอักษรที่อยู่ด้านล่าง"] },
        { h: "รูปถ่ายหน้าตรงที่ดี", p: ["หันหน้าตรงเข้ากล้องในที่แสงดี พื้นหลังสีอ่อนเรียบ เราตรวจแสง ความคมชัด พื้นหลัง และว่ามีใบหน้าเดียวชัดเจนในรูป"] },
        { h: "ตั๋วและใบจอง", p: ["ตั๋วเครื่องบินที่ออกจากประเทศไทยภายในระยะที่อนุญาตให้พำนัก (ไม่เกิน 15 วัน) และใบจองที่แสดงที่พัก"] },
        { h: "เงินและประกัน", p: ["หลักฐานว่าคุณมีเงินพอสำหรับการเดินทาง และประกันการเดินทาง หากยังไม่มีประกัน ซื้อเป็นบริการเสริมแล้วเราแนบให้"] },
        { h: "ทำไมทุกเอกสารสำคัญ", p: ["เอกสารขาดหรืออ่านไม่ออกเป็นเหตุที่ใบสมัครถูกตีกลับบ่อยที่สุด ใช้เวลาตรวจแต่ละไฟล์สักนาทีช่วยประหยัดเวลาได้หลายวัน"] },
      ] },
    { slug: "arriving-in-thailand", date: "2026-11-08", title: "ลงเครื่องที่ประเทศไทย: ต้องเตรียมอะไรไว้", summary: "เคล็ดลับสำหรับไม่กี่นาทีหลังเครื่องลง",
      body: [
        { h: "ก่อนเครื่องลง", p: ["เปิด \"E-VOA Pass ของฉัน\" ครั้งหนึ่งขณะยังมีอินเทอร์เน็ต และบันทึกเป็นรูป เก็บพาสปอร์ต ตั๋วขากลับ และรายละเอียดที่พักไว้ในที่หยิบง่าย"] },
        { h: "ที่สนามบิน", p: ["ตามป้ายและถามเจ้าหน้าที่หากไม่แน่ใจ เคาน์เตอร์ ช่องทาง และกฎเกณฑ์ต่างกันตามสนามบินและอาจเปลี่ยนแปลง ป้ายและเจ้าหน้าที่ที่สนามบินเป็นข้อสรุปสุดท้าย ดู \"คู่มือสนามบิน\" สำหรับสนามบินที่เราระบุ"] },
        { h: "หากมีปัญหา", p: ["เก็บเลขอ้างอิงไว้ ใช้ \"ตรวจสถานะใบสมัคร\" เพื่อดูสถานะโดยไม่ต้องเข้าสู่ระบบ หรือติดต่อเราผ่านหน้า \"ช่องทางทางการ\""] },
      ] },
    { slug: "sim-or-esim-in-thailand", date: "2026-11-08", title: "ซิมหรือ eSIM สำหรับไปไทย เลือกแบบไหน", summary: "วิธีเลือก และสิ่งที่ควรเช็กก่อนซื้อ",
      body: [
        { h: "eSIM", p: ["eSIM ส่งมาเป็น QR code ไม่ต้องไปรับ โทรศัพท์ต้องรองรับ eSIM และปลดล็อกเครือข่ายแล้ว ติดตั้งตามขั้นตอนที่เราแสดง หลายคนติดตั้งก่อนขึ้นเครื่อง"] },
        { h: "ซิมการ์ด", p: ["รับซิมที่เคาน์เตอร์ในสนามบินพร้อมแสดงพาสปอร์ต ใช้ได้กับโทรศัพท์ที่ปลดล็อกทุกเครื่อง แต่ต้องหาเคาน์เตอร์หลังเครื่องลง"] },
        { h: "สิ่งที่ต้องเช็ก", p: ["จำนวนวัน ปริมาณเน็ตที่ได้ และจะเกิดอะไรเมื่อใช้หมด บริการเสริมในเว็บนี้แสดงรายละเอียดเหล่านี้ก่อนให้คุณเลือก"] },
      ] },
    { slug: "travel-insurance-for-thailand", date: "2026-11-08", title: "ทำไมประกันการเดินทางเป็นส่วนหนึ่งของทริปไทย", summary: "คุ้มครองอะไร และเกี่ยวกับใบสมัครอย่างไร",
      body: [
        { h: "มักถูกขอเป็นเอกสาร", p: ["ประกันการเดินทางอยู่ในรายการเอกสารของใบสมัครวีซ่าออนอาร์ไรวัล หากซื้อเป็นบริการเสริม เราแนบกรมธรรม์ให้"] },
        { h: "สิ่งที่ควรดู", p: ["วงเงินคุ้มครองทางการแพทย์ จำนวนวันที่คุ้มครอง และข้อยกเว้น รายละเอียดของแต่ละแผนแสดงไว้กับแผนนั้น"] },
        { h: "หลังซื้อ", p: ["คุณได้เลขกรมธรรม์และ e-card ในหน้าใบสมัคร และใบรับรองถูกแนบกับใบสมัครอัตโนมัติ"] },
      ] },
  ],
  "zh-CN": [
    { slug: "how-thailand-e-voa-works", date: "2026-11-08", title: "泰国 e-VOA 如何办理：分步说明", summary: "从查询国籍资格到在机场出示通行证。",
      body: [
        { h: "1. 先确认能否申请", p: ["使用“资格查询”，看您的国籍是否在我们依据官方公告录入的落地签名单中。若显示暂无法回答，请咨询泰国使领馆或泰国移民局。"] },
        { h: "2. 选择标准或加急", p: ["标准约 2–3 天出结果，加急在提交后 24 小时内。标准套餐至少在降落前 72 小时、加急至少在 24 小时前申请。"] },
        { h: "3. 填写表格并上传文件", p: ["把行程中的每位旅客都加进来。拍摄护照资料页，我们在您手机上读取信息。上传正面照片、返程机票、住宿预订、资金证明和保险。"] },
        { h: "4. 一次付款", p: ["价格分为签证费、我们的服务费和您选的附加服务。付款前您会看到合计金额和退款规则。"] },
        { h: "5. 我们检查并提交", p: ["提交泰国移民局前我们会检查每份申请。如有缺漏会明确告知，您可更正后重新提交。"] },
        { h: "6. 在机场出示 E-VOA", p: ["获批后打开“我的 E-VOA 通行证”，打开一次后无网络也可查看，可保存为图片或打印。"] },
      ] },
    { slug: "documents-checklist", date: "2026-11-08", title: "办理泰国落地签需要准备的文件", summary: "一份简短清单，让申请大约十分钟完成。",
      body: [
        { h: "护照", p: ["抵达当天起应至少还有六个月有效期。需要资料页以及页底的两行字符。"] },
        { h: "合格的正面照片", p: ["光线充足、正对镜头、浅色纯色背景。我们会检查光线、清晰度、背景以及画面中是否清楚地只有一张人脸。"] },
        { h: "机票与住宿", p: ["在允许停留期（最长 15 天）内离开泰国的机票，以及能说明住宿地点的预订单。"] },
        { h: "资金与保险", p: ["能证明您有能力支付行程费用的文件，以及旅行保险。没有保险可作为附加服务购买，我们会为您附上。"] },
        { h: "为什么每份文件都重要", p: ["文件缺失或无法辨认是申请被退回最常见的原因。花一分钟检查每个文件可以节省好几天。"] },
      ] },
    { slug: "arriving-in-thailand", date: "2026-11-08", title: "抵达泰国：需要准备什么", summary: "降落后那几分钟的实用提示。",
      body: [
        { h: "降落前", p: ["趁还有网络时打开一次“我的 E-VOA 通行证”并保存图片。把护照、返程机票和住宿信息放在随手可取的地方。"] },
        { h: "在机场", p: ["跟随指示牌，不确定时询问工作人员。各机场的柜台、通道和规定不同且可能变化，以机场现场指示和工作人员为准。请参阅“机场指南”中列出的机场。"] },
        { h: "遇到问题时", p: ["保留申请编号。使用“查询申请状态”无需登录即可查看状态，或通过“官方渠道”页面联系我们。"] },
      ] },
    { slug: "sim-or-esim-in-thailand", date: "2026-11-08", title: "赴泰用 SIM 卡还是 eSIM？", summary: "如何选择，以及购买前要检查什么。",
      body: [
        { h: "eSIM", p: ["eSIM 以二维码形式发送，无需领取。您的手机必须支持 eSIM 且已解除网络锁。按我们显示的步骤安装，很多人在登机前就装好。"] },
        { h: "实体 SIM 卡", p: ["在机场柜台凭护照领取。任何解锁手机都可使用，但降落后需要找到柜台。"] },
        { h: "要检查什么", p: ["天数、包含的流量，以及用完后会怎样。本站的附加服务会在您选择前列出这些信息。"] },
      ] },
    { slug: "travel-insurance-for-thailand", date: "2026-11-08", title: "为什么旅行保险是泰国行程的一部分", summary: "保障什么，以及与申请的关系。",
      body: [
        { h: "通常会被要求提供", p: ["旅行保险在落地签申请的文件清单中。如果您作为附加服务购买，我们会为您附上保单。"] },
        { h: "要看什么", p: ["医疗保额、保障天数和免责条款。每个方案的详情随方案显示。"] },
        { h: "购买之后", p: ["您会在申请页面看到保单号和电子保单，证明文件会自动附到申请中。"] },
      ] },
  ],
};
