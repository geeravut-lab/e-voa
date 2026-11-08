import { EXTRA_LANGS, type PerLang } from "./types";
import { PACK_B } from "./lang";

/**
 * "Something went wrong": what to do first, in order, for the situations travelers meet most. General guidance written from public advice (Thai authorities, embassies, insurers)
 * in November 2026. Laws, fees and procedures change and each case is decided by the officers and the insurer: every page says so and points to the emergency numbers.
 * Staff can replace this list at /admin/toolkit (kind "incidents"); this is the fallback.
 */
export type Incident = {
  id: string;                         // the address: /incident/<id>
  call: string[];                     // emergency numbers to show first (they must exist on the emergency page)
  title: PerLang<string>;
  summary: PerLang<string>;
  steps: PerLang<string[]>;           // in order; each is one short action
};

export const INCIDENTS: Incident[] = [
  { id: "road-accident", call: ["1669", "191", "1155"],
    title: { en: "A road or motorbike accident", th: "อุบัติเหตุบนท้องถนนหรือมอเตอร์ไซค์", "zh-CN": "道路或摩托车事故" },
    summary: { en: "Keep yourself safe, get help for anyone hurt, and make sure there is a police report.", th: "ดูแลความปลอดภัยของตัวเอง ขอความช่วยเหลือสำหรับผู้บาดเจ็บ และให้มีใบแจ้งความ", "zh-CN": "先确保安全，为伤者求助，并确保有警方报告。" },
    steps: {
      en: ["If anyone is hurt, call 1669 (ambulance) first. For the police call 191 or the Tourist Police 1155.", "Move out of traffic if you can do so safely. Do not leave the scene.", "Photograph the vehicles, the plates, the road and any damage or injury. Note names, phone numbers and the plate of everyone involved.", "Wait for the police and ask for a police report. Your insurer and the rental shop will need it.", "Call your travel insurer's emergency number early (it is on your policy) and tell the rental shop if the vehicle is rented.", "Do not agree to pay cash on the spot, and do not sign a paper in Thai you cannot read, without the police, your insurer or an interpreter."],
      th: ["ถ้ามีผู้บาดเจ็บ โทร 1669 (รถพยาบาล) ก่อน ส่วนตำรวจโทร 191 หรือตำรวจท่องเที่ยว 1155", "ถ้าปลอดภัย ให้ย้ายออกจากถนน อย่าออกจากที่เกิดเหตุ", "ถ่ายรูปยานพาหนะ ป้ายทะเบียน ถนน ความเสียหายและบาดแผล จดชื่อ เบอร์โทร และทะเบียนรถของทุกฝ่าย", "รอตำรวจและขอใบแจ้งความ บริษัทประกันและร้านเช่ารถจะต้องใช้", "โทรหาศูนย์ช่วยเหลือฉุกเฉินของบริษัทประกันการเดินทางแต่เนิ่น ๆ (อยู่ในกรมธรรม์) และแจ้งร้านเช่าถ้าเป็นรถเช่า", "อย่าตกลงจ่ายเงินสดทันที และอย่าเซ็นเอกสารภาษาไทยที่อ่านไม่ออก โดยไม่มีตำรวจ บริษัทประกัน หรือล่ามอยู่ด้วย"],
      "zh-CN": ["如有人受伤，请先拨打 1669（救护车）。报警请拨 191 或旅游警察 1155。", "如能安全移动，请离开车道。不要离开事故现场。", "拍下车辆、车牌、道路及损坏或伤情。记下各方姓名、电话和车牌。", "等待警察并索取警方报告，保险公司和租车行都会需要。", "尽早致电旅行保险的紧急电话（在保单上），如是租来的车请告知租车行。", "没有警察、保险公司或翻译在场时，不要当场付现金，也不要在看不懂的泰文文件上签字。"],
    } },
  { id: "medical", call: ["1669"],
    title: { en: "Serious illness or injury", th: "เจ็บป่วยหรือบาดเจ็บรุนแรง", "zh-CN": "严重疾病或受伤" },
    summary: { en: "Get care first. Sort out the money and the paperwork with your insurer as soon as you can.", th: "รับการรักษาก่อน แล้วจัดการเรื่องเงินและเอกสารกับบริษัทประกันโดยเร็ว", "zh-CN": "先接受治疗，再尽快与保险公司处理费用和文件。" },
    steps: {
      en: ["For a serious emergency call 1669 or go to the nearest hospital. Do not wait for insurance to answer.", "Take your passport, your insurance policy and a phone. Say clearly that you are a visitor.", "Call your insurer's emergency line as soon as you can: they may arrange a guarantee so the hospital does not ask you to pay in full.", "Ask for a medical report, itemised bills and receipts. You need them for a claim.", "Ask the doctor to explain the treatment and the cost before you agree to non-urgent steps.", "If you cannot read or understand a form, ask for an interpreter before you sign."],
      th: ["กรณีฉุกเฉินรุนแรง โทร 1669 หรือไปโรงพยาบาลที่ใกล้ที่สุด อย่ารอให้ประกันรับสาย", "นำพาสปอร์ต กรมธรรม์ประกัน และโทรศัพท์ไปด้วย แจ้งชัดเจนว่าเป็นนักท่องเที่ยว", "โทรหาศูนย์ฉุกเฉินของบริษัทประกันโดยเร็ว อาจออกหนังสือค้ำประกันเพื่อไม่ต้องจ่ายเต็มจำนวนที่โรงพยาบาล", "ขอใบรับรองแพทย์ ใบแจ้งหนี้แบบละเอียด และใบเสร็จ ต้องใช้เคลมประกัน", "ให้แพทย์อธิบายการรักษาและค่าใช้จ่ายก่อนตกลงขั้นตอนที่ไม่เร่งด่วน", "ถ้าอ่านหรือไม่เข้าใจแบบฟอร์ม ให้ขอล่ามก่อนเซ็น"],
      "zh-CN": ["严重紧急情况请拨 1669 或前往最近的医院，不要等保险公司回复。", "带上护照、保险单和手机，并明确说明您是游客。", "尽快致电保险公司紧急热线：他们可能会安排担保，使医院不要求您全额先付。", "索取医疗报告、费用明细和收据，理赔时需要。", "非紧急的治疗，先请医生说明方案和费用再同意。", "看不懂表格时，请先要求翻译再签字。"],
    } },
  { id: "lost-passport", call: ["1155"],
    title: { en: "Lost or stolen passport", th: "พาสปอร์ตหายหรือถูกขโมย", "zh-CN": "护照丢失或被盗" },
    summary: { en: "Report it to the police, then your embassy, then Immigration. Keep copies of everything.", th: "แจ้งตำรวจ แล้วสถานทูต แล้วสำนักงานตรวจคนเข้าเมือง และเก็บสำเนาทุกอย่าง", "zh-CN": "先报警，再联系大使馆，然后办理移民局手续，并保留所有复印件。" },
    steps: {
      en: ["Go to the nearest police station and ask for a police report (a lost-property or theft report). The Tourist Police 1155 can help you.", "Contact your embassy or consulate for an emergency or replacement travel document. Take the police report, photos and any copy of your passport.", "Ask Thai Immigration how your permitted stay is carried over to the new passport. Do this before the stay ends.", "Show your E-VOA Pass and its reference number on the E-VOA Pass page: it proves your approval.", "Tell your airline and your insurer, and change flights if you need to.", "Next time keep a photo of the passport page in your phone and a paper copy apart from the passport."],
      th: ["ไปสถานีตำรวจที่ใกล้ที่สุดและขอใบแจ้งความ (เอกสารแจ้งของหายหรือถูกขโมย) ตำรวจท่องเที่ยว 1155 ช่วยได้", "ติดต่อสถานทูตหรือสถานกงสุลเพื่อขอหนังสือเดินทางฉุกเฉินหรือเอกสารเดินทางทดแทน นำใบแจ้งความ รูปถ่าย และสำเนาพาสปอร์ต (ถ้ามี) ไปด้วย", "สอบถามสำนักงานตรวจคนเข้าเมืองว่าจะโอนระยะเวลาพำนักที่อนุญาตไปยังพาสปอร์ตเล่มใหม่อย่างไร ทำก่อนครบกำหนดพำนัก", "แสดง E-VOA Pass และเลขอ้างอิงที่หน้า E-VOA Pass ซึ่งยืนยันว่าคุณได้รับอนุมัติ", "แจ้งสายการบินและบริษัทประกัน และเปลี่ยนเที่ยวบินถ้าจำเป็น", "ครั้งต่อไป เก็บรูปหน้าพาสปอร์ตไว้ในโทรศัพท์และสำเนากระดาษแยกจากพาสปอร์ต"],
      "zh-CN": ["前往最近的警察局索取警方报告（遗失或被盗证明）。旅游警察 1155 可以提供帮助。", "联系您所在国的大使馆或领事馆申请紧急或替代旅行证件，带上警方报告、照片和护照复印件（如有）。", "向泰国移民局咨询如何把获准停留转到新护照上，请在停留期结束前办理。", "在 E-VOA Pass 页面出示通行证及参考编号，可证明您已获批。", "告知航空公司和保险公司，必要时改签航班。", "以后请把护照资料页拍照存在手机里，并把纸质复印件与护照分开保管。"],
    } },
  { id: "lost-phone-cards", call: [],
    title: { en: "Lost or stolen phone, wallet or bank cards", th: "โทรศัพท์ กระเป๋าสตางค์ หรือบัตรธนาคารหายหรือถูกขโมย", "zh-CN": "手机、钱包或银行卡丢失或被盗" },
    summary: { en: "Block cards and lock the phone within minutes, then report it for your insurance.", th: "อายัดบัตรและล็อกโทรศัพท์ภายในไม่กี่นาที แล้วแจ้งความเพื่อใช้กับประกัน", "zh-CN": "几分钟内冻结银行卡并锁定手机，然后报案以便保险理赔。" },
    steps: {
      en: ["Call your bank or use its app to block every card at once. The number is on the bank's website, not necessarily on the card.", "Lock or erase the phone with Find My (Apple) or Find Hub (Android). Ask your mobile operator to block the SIM.", "Change the passwords of your e-mail, banking and social accounts, starting with the e-mail.", "Turn on two-step sign-in everywhere you can, and warn friends not to answer messages from your account.", "Report it at a police station and keep the report: insurers ask for it.", "Check your bank statements over the next weeks and report any payment you did not make."],
      th: ["โทรหาธนาคารหรือใช้แอปเพื่ออายัดบัตรทุกใบพร้อมกัน เบอร์อยู่ในเว็บไซต์ธนาคาร ไม่จำเป็นต้องอยู่บนบัตร", "ล็อกหรือลบข้อมูลโทรศัพท์ด้วย Find My (Apple) หรือ Find Hub (Android) และให้ผู้ให้บริการมือถือระงับซิม", "เปลี่ยนรหัสผ่านอีเมล บัญชีธนาคาร และโซเชียล เริ่มจากอีเมลก่อน", "เปิดการยืนยันตัวตนสองขั้นตอนทุกที่ที่ทำได้ และเตือนเพื่อนอย่าตอบข้อความจากบัญชีของคุณ", "แจ้งความที่สถานีตำรวจและเก็บเอกสารไว้ บริษัทประกันจะขอ", "ตรวจรายการเดินบัญชีในอีกหลายสัปดาห์ถัดไป และแจ้งรายการที่คุณไม่ได้ทำ"],
      "zh-CN": ["致电银行或用其应用一次性冻结所有银行卡。电话号码请查银行官网，不一定印在卡上。", "用“查找”（苹果）或“查找我的设备”（安卓）锁定或清除手机，并让运营商停用 SIM 卡。", "更改邮箱、银行和社交账号的密码，先从邮箱开始。", "尽可能开启两步验证，并提醒朋友不要回复来自您账号的消息。", "到警察局报案并保留报案记录，保险公司会要求提供。", "之后几周留意银行账单，发现不是您本人的支出请及时上报。"],
    } },
  { id: "theft", call: ["191", "1155"],
    title: { en: "Theft, robbery or assault", th: "ถูกลักทรัพย์ ปล้น หรือทำร้ายร่างกาย", "zh-CN": "盗窃、抢劫或遭袭击" },
    summary: { en: "Your safety first, then the Tourist Police, a written report and your embassy.", th: "ความปลอดภัยของคุณมาก่อน แล้วตำรวจท่องเที่ยว ใบแจ้งความ และสถานทูต", "zh-CN": "先保证自身安全，再联系旅游警察、取得书面报告并通知大使馆。" },
    steps: {
      en: ["Get to a safe, busy place. Do not chase the person. If you are hurt call 1669; for the police call 191 or the Tourist Police 1155.", "Write down or record what you remember: time, place, what happened, how the person looked, what was taken.", "Report it to the police and ask for a written report, even for small thefts: you need it for insurance.", "Block cards and lock the phone if they were taken (see the lost phone and cards guide).", "Tell your embassy if your passport or papers were taken, or if you were hurt.", "Tell your insurer and keep every receipt."],
      th: ["ไปยังที่ปลอดภัยและมีคน อย่าไล่ตามคนร้าย ถ้าบาดเจ็บโทร 1669 แจ้งตำรวจโทร 191 หรือตำรวจท่องเที่ยว 1155", "จดหรืออัดเสียงสิ่งที่จำได้ เวลา สถานที่ เหตุการณ์ ลักษณะคนร้าย และสิ่งที่ถูกเอาไป", "แจ้งตำรวจและขอใบแจ้งความที่เป็นลายลักษณ์อักษร แม้ของหายเล็กน้อย ต้องใช้กับประกัน", "อายัดบัตรและล็อกโทรศัพท์ถ้าถูกเอาไป (ดูคู่มือโทรศัพท์และบัตรหาย)", "แจ้งสถานทูตถ้าพาสปอร์ตหรือเอกสารหาย หรือคุณได้รับบาดเจ็บ", "แจ้งบริษัทประกันและเก็บใบเสร็จทุกใบ"],
      "zh-CN": ["前往安全且人多的地方，不要追赶对方。受伤请拨 1669；报警请拨 191 或旅游警察 1155。", "写下或录下您记得的内容：时间、地点、经过、对方的样子、被拿走的物品。", "向警方报案并索取书面报告，即使是小额盗窃也要，保险理赔需要。", "如银行卡或手机被拿走，请冻结银行卡并锁定手机（见手机和银行卡丢失指南）。", "如护照或证件被拿走，或您受伤，请通知大使馆。", "通知保险公司并保留所有收据。"],
    } },
  { id: "scam", call: ["1155", "1672"],
    title: { en: "Scams and overcharging", th: "ถูกหลอกลวงหรือเรียกเก็บเงินเกินจริง", "zh-CN": "诈骗与被乱收费" },
    summary: { en: "Stop paying, keep your passport, record what happened and call the Tourist Police.", th: "หยุดจ่ายเงิน เก็บพาสปอร์ตไว้กับตัว บันทึกเหตุการณ์ และโทรหาตำรวจท่องเที่ยว", "zh-CN": "停止付款、保管好护照、记录经过并致电旅游警察。" },
    steps: {
      en: ["Do not pay more, and do not hand over your passport as a deposit. Stay calm and polite.", "Take photos or a video of the vehicle, the damage, the price list, the contract and the people. Note the place and time.", "Call the Tourist Police 1155 (English): they often mediate. The TAT line 1672 also helps tourists.", "If you paid by card, call your bank at once and ask to dispute the payment. Keep the receipt.", "Do not follow a stranger to \"help\" you or accept a ride or tour from someone who approached you with an unusual offer.", "Leave a record: report at a police station and tell your embassy if you were threatened."],
      th: ["อย่าจ่ายเพิ่ม และอย่าฝากพาสปอร์ตไว้เป็นเงินมัดจำ ใจเย็นและสุภาพ", "ถ่ายรูปหรือวิดีโอยานพาหนะ ความเสียหาย ป้ายราคา สัญญา และผู้เกี่ยวข้อง จดสถานที่และเวลา", "โทรหาตำรวจท่องเที่ยว 1155 (พูดอังกฤษได้) ซึ่งมักช่วยไกล่เกลี่ย สายของ ททท. 1672 ก็ช่วยนักท่องเที่ยวได้", "ถ้าจ่ายด้วยบัตร โทรหาธนาคารทันทีและขอโต้แย้งรายการ เก็บใบเสร็จไว้", "อย่าตามคนแปลกหน้าที่ขอ \"ช่วย\" หรือรับข้อเสนอพาเที่ยวหรือโดยสารที่แปลกจากคนที่เข้ามาทัก", "บันทึกไว้เป็นหลักฐาน แจ้งความที่สถานีตำรวจ และแจ้งสถานทูตถ้าถูกข่มขู่"],
      "zh-CN": ["不要多付钱，也不要把护照留作押金。保持冷静和礼貌。", "拍下车辆、损坏、价目表、合同和相关人员的照片或视频，并记下地点和时间。", "致电旅游警察 1155（可用英语），他们常会出面调解。泰国旅游局 1672 也可为游客提供帮助。", "如果是刷卡付款，请立即致电银行申请争议处理，并保留收据。", "不要跟着陌生人去“帮忙”，也不要接受主动搭讪者提供的异常搭车或旅游邀请。", "留下记录：到警察局报案，如受到威胁请通知大使馆。"],
    } },
  { id: "detained", call: ["1155"],
    title: { en: "Stopped, arrested or detained", th: "ถูกเรียกตรวจ จับกุม หรือควบคุมตัว", "zh-CN": "被拦查、逮捕或拘留" },
    summary: { en: "Stay calm, ask for your embassy and an interpreter, and do not sign what you do not understand.", th: "ใจเย็น ขอติดต่อสถานทูตและล่าม และอย่าเซ็นสิ่งที่ไม่เข้าใจ", "zh-CN": "保持冷静，要求联系大使馆并提供翻译，不要签署看不懂的文件。" },
    steps: {
      en: ["Stay calm and polite. Do not argue or resist, and do not offer money to an officer: that is an offence.", "Show your passport or a copy and your E-VOA Pass if asked.", "Ask to contact your embassy or consulate: you can ask for this. Ask for an interpreter.", "Do not sign any paper you cannot read or do not understand.", "Call or have someone call the Tourist Police 1155, your family or a lawyer.", "Write down the names or numbers of the officers, the place and the times."],
      th: ["ใจเย็นและสุภาพ อย่าโต้เถียงหรือขัดขืน และอย่าเสนอเงินให้เจ้าหน้าที่ ซึ่งเป็นความผิด", "แสดงพาสปอร์ตหรือสำเนา และ E-VOA Pass ถ้าถูกขอ", "ขอติดต่อสถานทูตหรือสถานกงสุลของคุณ ซึ่งคุณขอได้ และขอล่าม", "อย่าเซ็นเอกสารที่อ่านไม่ออกหรือไม่เข้าใจ", "โทรหา หรือให้คนโทรหาตำรวจท่องเที่ยว 1155 ครอบครัว หรือทนายความ", "จดชื่อหรือหมายเลขเจ้าหน้าที่ สถานที่ และเวลา"],
      "zh-CN": ["保持冷静和礼貌。不要争辩或反抗，也不要向官员提供金钱，那是违法的。", "如被要求，出示护照或复印件以及 E-VOA Pass。", "要求联系您所在国的大使馆或领事馆（您可以提出），并要求提供翻译。", "不要签署您看不懂或不理解的任何文件。", "致电或请人致电旅游警察 1155、家人或律师。", "记下官员的姓名或编号、地点和时间。"],
    } },
  { id: "flood-storm", call: ["1669", "191"],
    title: { en: "Flood, storm or earthquake", th: "น้ำท่วม พายุ หรือแผ่นดินไหว", "zh-CN": "洪水、风暴或地震" },
    summary: { en: "Follow the local authorities, move to safe ground and keep your phone charged.", th: "ปฏิบัติตามเจ้าหน้าที่ในพื้นที่ ไปยังที่ปลอดภัย และชาร์จโทรศัพท์ให้เต็ม", "zh-CN": "听从当地部门指示，转移到安全地带，并保持手机有电。" },
    steps: {
      en: ["Follow the instructions of local officials, your hotel and the official alerts. Check the warnings on the Weather and air page.", "Move to higher ground or a sturdy building away from the sea, rivers and windows. In an earthquake drop, cover and hold on; do not use lifts.", "Never walk or drive through flood water, and stay away from fallen power lines.", "Keep your phone charged, and keep your passport, medicine and some cash in a bag you can carry.", "Call 1669 for injuries, 191 for police. Tell family and your embassy that you are safe.", "Check with your airline and your insurer about changed flights and costs."],
      th: ["ปฏิบัติตามเจ้าหน้าที่ในพื้นที่ โรงแรม และประกาศเตือนภัยทางการ ดูคำเตือนที่หน้าสภาพอากาศและฝุ่น", "ไปยังที่สูงหรืออาคารที่แข็งแรง ห่างจากทะเล แม่น้ำ และหน้าต่าง ถ้าเกิดแผ่นดินไหวให้ก้มต่ำ หาที่กำบัง และจับให้มั่น อย่าใช้ลิฟต์", "อย่าเดินหรือขับรถผ่านน้ำท่วม และอยู่ห่างสายไฟที่ตกลงมา", "ชาร์จโทรศัพท์ให้เต็ม เก็บพาสปอร์ต ยา และเงินสดบางส่วนไว้ในกระเป๋าที่พกได้", "โทร 1669 กรณีบาดเจ็บ 191 สำหรับตำรวจ แจ้งครอบครัวและสถานทูตว่าคุณปลอดภัย", "สอบถามสายการบินและบริษัทประกันเรื่องเที่ยวบินที่เปลี่ยนและค่าใช้จ่าย"],
      "zh-CN": ["听从当地官员、酒店和官方警报的指示。请在“天气与空气”页面查看预警。", "转移到高处或坚固的建筑物，远离海边、河边和窗户。地震时应蹲下、掩护、抓牢，不要乘电梯。", "切勿涉水行走或驾车通过洪水，远离掉落的电线。", "保持手机有电，把护照、药品和一些现金放在便于携带的包里。", "受伤请拨 1669，报警拨 191。告知家人和大使馆您是安全的。", "向航空公司和保险公司确认航班变更及费用。"],
    } },
];
export const INCIDENT_NOTE: PerLang<string> = {
  en: "General guidance from public advice, last reviewed in {when}. Procedures differ by case and officers decide: follow the instructions of the authorities, your embassy and your insurer. This is not legal or medical advice.",
  th: "คำแนะนำทั่วไปจากข้อมูลสาธารณะ ตรวจทานล่าสุด {when} ขั้นตอนต่างกันตามกรณีและเจ้าหน้าที่เป็นผู้ตัดสิน ให้ทำตามคำสั่งของทางการ สถานทูต และบริษัทประกัน ไม่ใช่คำแนะนำทางกฎหมายหรือการแพทย์",
  "zh-CN": "基于公开建议的一般性指引，最近一次审核时间：{when}。各案程序不同，由官员裁量：请遵循当局、大使馆和保险公司的指示。本内容不构成法律或医疗意见。",
};

for (const l of EXTRA_LANGS) {
  const p = PACK_B[l]; if (!p) continue;
  for (const i of INCIDENTS) { const t = p.incidents[i.id]; if (t) { i.title[l] = t.title; i.summary[l] = t.summary; i.steps[l] = t.steps; } }
  INCIDENT_NOTE[l] = p.incidentNote;
}
