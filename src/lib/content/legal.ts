import type { PerLang, Section } from "./types";

/** Version stored with every consent. Change it whenever the texts below change in substance, so it is clear which text a traveler accepted. */
export const LEGAL_VERSION = "2026-11-draft1";

export const PRIVACY: PerLang<Section[]> = {
  en: [
    { h: "Who we are", p: ["ThaiPass e-VOA is a private service that helps travelers prepare and submit their Visa on Arrival application to Thai Immigration. We are not a government website. The decision on every application is made by Thai Immigration."] },
    { h: "What we collect", p: ["Name, date of birth, nationality, passport details, photo and the documents you upload (return ticket, accommodation, proof of funds, insurance), contact details, your travel details, the add-ons you choose, your signature on the declaration, and technical data needed to keep the service safe (for example a shortened, one-way hash of your network address for rate limits). We never see or store your card number: payments are handled by our payment provider."] },
    { h: "Why we use it", p: ["To prepare and send your application to Thai Immigration, to take payment, to deliver the extras you choose, to tell you the status, to give support, to prevent fraud and misuse, and to meet legal obligations."] },
    { h: "Who receives it", p: ["Thai Immigration (your application and documents), our payment provider (payment details), the partners of the extras you choose (only what that service needs), and our infrastructure providers who host the service for us. We do not sell your data."] },
    { h: "How long we keep it", p: ["Passport numbers and uploaded files are encrypted. Uploaded files are deleted automatically a set number of days after your arrival date (90 days unless the settings say otherwise). Payment and receipt records are kept as long as accounting law requires."] },
    { h: "Your rights", p: ["You may ask to see, correct or delete your data, or to withdraw a consent, by contacting us through the channels on the Official channels page. Withdrawing consent can make it impossible to continue an application. You may also complain to the data protection authority of Thailand."] },
    { h: "Sending data abroad", p: ["Your data is processed on servers that may be outside your country and outside Thailand. We use encryption and contracts with our providers to protect it."] },
  ],
  th: [
    { h: "เราคือใคร", p: ["ThaiPass e-VOA เป็นบริการของเอกชนที่ช่วยผู้เดินทางเตรียมและยื่นใบสมัครวีซ่าออนอาร์ไรวัลไปยังสำนักงานตรวจคนเข้าเมือง ไม่ใช่เว็บไซต์ของรัฐบาล การพิจารณาใบสมัครทุกฉบับเป็นอำนาจของสำนักงานตรวจคนเข้าเมือง"] },
    { h: "ข้อมูลที่เราเก็บ", p: ["ชื่อ วันเกิด สัญชาติ ข้อมูลพาสปอร์ต รูปถ่าย และเอกสารที่คุณอัปโหลด (ตั๋วขากลับ ที่พัก หลักฐานทางการเงิน ประกัน) ข้อมูลติดต่อ รายละเอียดการเดินทาง บริการเสริมที่เลือก ลายเซ็นในคำประกาศ และข้อมูลทางเทคนิคเพื่อความปลอดภัย (เช่น ค่าแฮชทางเดียวแบบย่อของที่อยู่เครือข่ายเพื่อจำกัดการใช้งานเกินปกติ) เราไม่เห็นและไม่เก็บเลขบัตรของคุณ การชำระเงินดำเนินการโดยผู้ให้บริการชำระเงิน"] },
    { h: "ใช้ทำอะไร", p: ["เพื่อเตรียมและส่งใบสมัครไปยังสำนักงานตรวจคนเข้าเมือง รับชำระเงิน ส่งมอบบริการเสริมที่เลือก แจ้งสถานะ ดูแลลูกค้า ป้องกันการฉ้อโกงและการใช้งานในทางที่ผิด และปฏิบัติตามกฎหมาย"] },
    { h: "ใครได้รับข้อมูล", p: ["สำนักงานตรวจคนเข้าเมือง (ใบสมัครและเอกสาร) ผู้ให้บริการชำระเงิน (ข้อมูลการชำระเงิน) พาร์ตเนอร์ของบริการเสริมที่คุณเลือก (เฉพาะข้อมูลที่บริการนั้นจำเป็น) และผู้ให้บริการโครงสร้างพื้นฐานที่โฮสต์ระบบให้เรา เราไม่ขายข้อมูลของคุณ"] },
    { h: "เก็บนานแค่ไหน", p: ["เลขพาสปอร์ตและไฟล์ที่อัปโหลดถูกเข้ารหัส ไฟล์ที่อัปโหลดจะถูกลบอัตโนมัติเมื่อพ้นจำนวนวันที่กำหนดหลังวันที่คุณมาถึง (90 วัน เว้นแต่การตั้งค่าระบุเป็นอย่างอื่น) ข้อมูลการชำระเงินและใบเสร็จเก็บตามระยะเวลาที่กฎหมายบัญชีกำหนด"] },
    { h: "สิทธิของคุณ", p: ["คุณขอดู แก้ไข หรือลบข้อมูล หรือถอนความยินยอมได้ โดยติดต่อเราตามช่องทางในหน้า \"ช่องทางทางการ\" การถอนความยินยอมอาจทำให้ดำเนินการใบสมัครต่อไม่ได้ และคุณมีสิทธิร้องเรียนต่อหน่วยงานคุ้มครองข้อมูลส่วนบุคคลของประเทศไทย"] },
    { h: "การส่งข้อมูลไปต่างประเทศ", p: ["ข้อมูลของคุณถูกประมวลผลบนเซิร์ฟเวอร์ที่อาจอยู่นอกประเทศของคุณและนอกประเทศไทย เราใช้การเข้ารหัสและข้อตกลงกับผู้ให้บริการเพื่อคุ้มครองข้อมูล"] },
  ],
  "zh-CN": [
    { h: "我们是谁", p: ["ThaiPass e-VOA 是一项私营服务，帮助旅客准备并向泰国移民局提交落地签申请。我们不是政府网站，每份申请的最终决定由泰国移民局作出。"] },
    { h: "我们收集什么", p: ["姓名、出生日期、国籍、护照信息、照片以及您上传的文件（返程机票、住宿、资金证明、保险）、联系方式、行程信息、所选附加服务、声明上的签名，以及保障服务安全所需的技术数据（例如网络地址的单向缩短哈希，用于限流）。我们不会看到或保存您的银行卡号，支付由支付服务商处理。"] },
    { h: "用途", p: ["准备并向泰国移民局提交申请、收款、交付您所选的附加服务、通知状态、提供支持、防范欺诈与滥用，以及履行法律义务。"] },
    { h: "谁会收到", p: ["泰国移民局（申请与文件）、支付服务商（付款信息）、您所选附加服务的合作伙伴（仅限该服务所需信息），以及为我们托管服务的基础设施提供商。我们不会出售您的数据。"] },
    { h: "保存多久", p: ["护照号码和上传文件均加密保存。上传文件会在抵达日期后的设定天数（默认 90 天）自动删除。付款和收据记录按会计法规要求的期限保存。"] },
    { h: "您的权利", p: ["您可通过“官方渠道”页面所列方式联系我们，要求查看、更正、删除数据或撤回同意。撤回同意可能导致无法继续办理申请。您也可以向泰国个人数据保护主管机关投诉。"] },
    { h: "数据出境", p: ["您的数据可能在您所在国家及泰国境外的服务器上处理。我们通过加密以及与服务商的合同来保护数据。"] },
  ],
};

export const TERMS: PerLang<Section[]> = {
  en: [
    { h: "What we do", p: ["We help you fill in, check and submit your Visa on Arrival application to Thai Immigration, and we can add optional extras from partners. We are a private company and not part of the government. We cannot promise that an application will be approved: Thai Immigration decides."] },
    { h: "Your duties", p: ["Give true and complete information and genuine documents. You are responsible for mistakes in what you enter. A false statement can lead to refusal of entry."] },
    { h: "Fees and refunds", p: ["The price is shown before you pay and is split into the visa fee, our service fee and any extras. Once paid, the visa fee and the service fee are not refunded. Extras that were not used are refunded under the rules on the Fees page, and automatically if an extra cannot be issued or the application is rejected."] },
    { h: "Time", p: ["Regular applications are decided in about 2–3 days and Express within 24 hours of submission, as stated on the page. These are targets set by the process, not promises. Apply early."] },
    { h: "Extras from partners", p: ["Insurance, SIM/eSIM, VIP and health services are provided by our partners under their own terms, which are shown with each extra."] },
    { h: "Our responsibility", p: ["We do our best to keep the service available and correct. To the extent the law allows, we are not liable for decisions of Thai Immigration, for delays outside our control, or for indirect losses."] },
    { h: "Changes", p: ["We may change these terms. The version you accepted is recorded with your application."] },
  ],
  th: [
    { h: "เราทำอะไร", p: ["เราช่วยคุณกรอก ตรวจสอบ และยื่นใบสมัครวีซ่าออนอาร์ไรวัลไปยังสำนักงานตรวจคนเข้าเมือง และมีบริการเสริมจากพาร์ตเนอร์ให้เลือก เราเป็นบริษัทเอกชน ไม่ได้เป็นส่วนหนึ่งของรัฐบาล เราไม่สามารถรับรองว่าใบสมัครจะได้รับอนุมัติ เพราะเป็นอำนาจของสำนักงานตรวจคนเข้าเมือง"] },
    { h: "หน้าที่ของคุณ", p: ["กรอกข้อมูลที่เป็นจริงและครบถ้วน ใช้เอกสารจริง คุณรับผิดชอบต่อข้อผิดพลาดในข้อมูลที่กรอก ข้อความอันเป็นเท็จอาจทำให้ถูกปฏิเสธการเข้าเมือง"] },
    { h: "ค่าธรรมเนียมและการคืนเงิน", p: ["ราคาแสดงก่อนชำระ แยกเป็นค่าธรรมเนียมวีซ่า ค่าบริการของเรา และบริการเสริม เมื่อชำระแล้ว ค่าธรรมเนียมวีซ่าและค่าบริการไม่สามารถขอคืนได้ บริการเสริมที่ยังไม่ได้ใช้คืนเงินตามกติกาในหน้าค่าธรรมเนียม และคืนอัตโนมัติหากออกบริการไม่ได้หรือใบสมัครถูกปฏิเสธ"] },
    { h: "ระยะเวลา", p: ["แพ็กเกจปกติทราบผลประมาณ 2–3 วัน และแพ็กเกจด่วนภายใน 24 ชั่วโมงหลังส่ง ตามที่ระบุในหน้า ซึ่งเป็นเป้าหมายของกระบวนการ ไม่ใช่คำรับประกัน โปรดสมัครล่วงหน้า"] },
    { h: "บริการเสริมจากพาร์ตเนอร์", p: ["ประกัน ซิม/eSIM บริการ VIP และบริการสุขภาพ จัดให้โดยพาร์ตเนอร์ตามเงื่อนไขของพาร์ตเนอร์เอง ซึ่งแสดงไว้กับแต่ละบริการ"] },
    { h: "ความรับผิดของเรา", p: ["เราพยายามให้บริการพร้อมใช้งานและถูกต้อง ภายใต้ขอบเขตที่กฎหมายอนุญาต เราไม่รับผิดต่อคำวินิจฉัยของสำนักงานตรวจคนเข้าเมือง ความล่าช้าที่อยู่นอกเหนือการควบคุม หรือความเสียหายทางอ้อม"] },
    { h: "การเปลี่ยนแปลง", p: ["เราอาจแก้ไขข้อกำหนดนี้ ฉบับที่คุณยอมรับจะถูกบันทึกไว้กับใบสมัคร"] },
  ],
  "zh-CN": [
    { h: "我们做什么", p: ["我们帮助您填写、检查并向泰国移民局提交落地签申请，并可添加合作伙伴的可选附加服务。我们是私营公司，不属于政府。我们不能保证申请一定获批，决定权在泰国移民局。"] },
    { h: "您的责任", p: ["请提供真实完整的信息和真实的文件。您对所填内容的错误负责，虚假陈述可能导致被拒绝入境。"] },
    { h: "费用与退款", p: ["价格在付款前显示，分为签证费、我们的服务费和附加服务。付款后，签证费和服务费不予退还。未使用的附加服务按“费用”页面规则退款；附加服务无法出单或申请被拒时自动退款。"] },
    { h: "时间", p: ["标准申请约 2–3 天出结果，加急在提交后 24 小时内，如页面所示。这是流程目标而非承诺，请尽早申请。"] },
    { h: "合作伙伴的附加服务", p: ["保险、SIM/eSIM、VIP 和健康服务由合作伙伴按其自身条款提供，条款随每项服务显示。"] },
    { h: "我们的责任", p: ["我们尽力保证服务可用且准确。在法律允许范围内，我们不对泰国移民局的决定、超出我们控制的延误或间接损失负责。"] },
    { h: "变更", p: ["我们可能修改本条款。您接受的版本会随申请一并记录。"] },
  ],
};
