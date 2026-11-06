# Knowledge: ระบบ E-VOA เดิม — TieThai (2019) และ WeGoThailand (2020–2023)

> ถอดจากเอกสารทั้งหมดในโฟลเดอร์ `TieThai & WeGoThiland Documents/` (คู่มือผู้ใช้, คู่มือเอเจนซี่, Procedure, ICD/Swagger ของ VFS และพาร์ทเนอร์ทุกราย,
> Flow diagram, Architecture, เอกสารนำเสนอผู้บริหาร, ตารางค่าคอมมิชชัน และวิดีโอ TieThai)
>
> จุดประสงค์: บันทึกว่าระบบเดิม **ทำงานอย่างไร ทำไมจึงทำแบบนั้น และอะไรที่ควรเก็บ/ควรทิ้ง** เพื่อใช้เป็นฐานของระบบใหม่ "Thailand Global E-VOA"
> ทุกตัวเลขและกฎในไฟล์นี้เป็น **ของระบบเดิม ณ ปีที่เอกสารออก** — กฎของ สตม. ในปัจจุบันต้องยืนยันใหม่ก่อนนำไปใช้ (ดู §14)

---

## 0. สรุปหน้าเดียว

| เรื่อง | ระบบเดิม |
| --- | --- |
| ผลิตภัณฑ์ | ยื่นขอ **E-Visa on Arrival (E-VOA)** ล่วงหน้าออนไลน์ → สตม. pre-approve → ผ่านช่องพิเศษ "E-VOA lane" ที่สนามบิน |
| ช่องทาง | **WeChat Mini Program** เท่านั้น (TieThai → เปลี่ยนชื่อเป็น WeGoThailand) + เว็บพอร์ทัลสำหรับเอเจนซี่ |
| กลุ่มลูกค้า | นักท่องเที่ยว **จีน** (ใช้ WeChat) |
| ผู้พัฒนา | Emerald Tech Advance Co., Ltd. (ร่วมกับ Aggregate Payment Technology ในเครือ Tencent) |
| ตัวกลางวีซ่า | **VFS Global** — ระบบเดิม **ไม่ได้ต่อตรงกับ สตม.** แต่ส่งเข้า VFS แล้ว VFS ส่งต่อ สตม. |
| แพ็กเกจ | Regular (ประมวลผล 2–3 วัน, ยื่น 48–72 ชม. ก่อนเดินทาง) · Express (ภายใน 24 ชม.) |
| ราคา (ปี 2023) | Regular 2,500 THB (วีซ่า 2,000 + service 500) · Express 4,500 THB (วีซ่า 2,000 + service 2,500) — ราคาขายจริงต่อลูกค้า 2,700–2,800 / 4,800–5,000 THB |
| ชำระเงิน | WeChat Pay → บัญชี SCB → โอนรวมให้ VFS ทุกวัน (ตัดยอด 15:00) |
| บริการเสริม | ประกันเดินทาง (CIS), RT-PCR (โรงพยาบาลพริ้นซ์), SIM (TRUE), VIP Fast Track, Beauty & Health (BHS) |
| สถิติ | > 5,000 ใบสมัคร/เดือน ช่วงพีค (ต.ค. 2019 – ม.ค. 2020) |
| สิทธิ์พำนัก | 15 วัน (+ ต่อได้ 7 วัน) |
| สิ่งที่ลูกค้าต้องทำที่สนามบิน | พิมพ์ใบอนุมัติ E-VOA (สตม. บังคับฉบับกระดาษ) + กรอก ตม.6 + พาสปอร์ต → เข้าช่อง E-VOA |

---

## 1. ไทม์ไลน์และวิวัฒนาการ

| ช่วง | เหตุการณ์ |
| --- | --- |
| พ.ค. 2019 | VFS ออก ICD v1.0 (4 API: master, docket, getStatusById, getEVOAById) — TieThai เริ่มให้บริการ |
| ส.ค. 2019 | เปิด **TieThai Travel Agency Web Portal** (`evoa-agent.tiethai.app`) ให้เอเจนซี่สร้างทริปและผูกนักท่องเที่ยว |
| ต.ค. 2019 – ม.ค. 2020 | ช่วงพีค > 5,000 ใบสมัคร/เดือน แล้วหยุดเพราะ COVID-19 |
| 2020 | ปรับเป็น "Welcome to Thailand by TAT / Smart Tourists" — คัดกรอง COVID (ผลตรวจ, Health Kit, COE, ประกัน 100,000 USD) + เชื่อม MorChana |
| 2022 | VFS ICD v1.1–1.2 (เพิ่ม uploadAdditionalDocuments, master documentList) |
| ม.ค.–ก.พ. 2023 | เปลี่ยนชื่อเป็น **WeGoThailand**, สถาปัตยกรรมใหม่ (API Gateway), ICD v1.2.5 เพิ่ม **callback `updateStatusById`** จาก VFS |
| มี.ค.–เม.ย. 2023 | เพิ่ม API บริการเสริม: Insurance (CIS), RT-PCR, SIM, VIP, BHS |
| พ.ค. 2023 | Procedure ฉบับใหม่ (3 สนามบิน: สุวรรณภูมิ, เชียงใหม่, ภูเก็ต + มีพนักงานบริการที่สนามบิน) |

---

## 2. ผู้เกี่ยวข้อง (Actors)

| Actor | บทบาท |
| --- | --- |
| Traveler (ผู้สมัคร) | กรอกข้อมูล อัปโหลดเอกสาร จ่ายเงิน ติดตามผล รับ E-VOA; สมัครแทน "เพื่อน" หรือทั้งกลุ่มได้ |
| Travel Agency | สมัครแทนลูกค้า (ทั้งแบบให้ลูกค้ากรอกเอง หรือกรอกหลังบ้านให้) มีเอเจนซี่ย่อยได้ 3 ชั้น |
| Admin (Emerald) | ดูแลเอเจนซี่ ราคา/ส่วนลด ประเภทเอกสาร master data ตรวจสถานะ ตอบแชท |
| VFS Global | ตัวกลางรับใบสมัคร ตรวจเอกสาร ส่งให้ สตม. ส่ง E-VOA กลับ รับเงินค่าวีซ่า+ค่าบริการ |
| สตม. (Immigration Bureau) | ตรวจสอบ Blacklist/Watchlist และ pre-approve |
| WeChat Pay / SCB | รับชำระเงิน / บัญชีรับเงินและโอนต่อให้ VFS |
| พาร์ทเนอร์บริการเสริม | CIS (ประกัน), PRINC Hospital (RT-PCR), TRUE (SIM), VIP Co./Emerald staff (Fast Track), BHS Company |
| ภาครัฐอื่น (ยุค COVID) | MOTS, MFA, TAT, กระทรวงสาธารณสุขจีน, ตม.จีน — **ไม่เกี่ยวกับระบบใหม่แล้ว** |

---

## 3. ผลิตภัณฑ์และราคา

### 3.1 เปรียบเทียบช่องทางวีซ่า (เอกสาร มี.ค. 2023)

| หัวข้อ | VISA (สถานทูต) | E-VISA | E-VOA (WeGoThailand) |
| --- | --- | --- | --- |
| วิธียื่น | ไปสถานทูตไทยในจีน | ยื่นเว็บไซต์ | ยื่นใน Mini Program |
| เวลา | 7–14 วัน | 3–10 วัน | 2–3 วัน (Regular) / 24 ชม. (Express) |
| ราคา | 1,000 THB | 2,800 THB | 2,700–2,800 (Regular) / 4,800–5,000 (Express) |
| พำนัก | 60 + ต่อ 30 วัน | 60 + ต่อ 30 วัน | **15 + ต่อ 7 วัน** |
| ช่องตรวจคนเข้าเมืองเฉพาะ | ไม่มี | ไม่มี | **มี** |
| พนักงานช่วยที่สนามบิน | ไม่มี | ไม่มี | **มี** |
| Call & Chat 24×7 | ไม่มี | ไม่มี | **มี** |
| บริการเสริม | ไม่มี | ไม่มี | ประกัน, RT-PCR/ตรวจสุขภาพ, SIM, VIP |

### 3.2 โครงสร้างค่าธรรมเนียม (Swagger VFS v1.1 R02)

| แพ็กเกจ | Visa fee (รัฐ) | Service fee | รวมที่ส่งใน docket |
| --- | --- | --- | --- |
| Regular | 2,000 THB | 500 THB | **2,500 THB** |
| Express (หรือเดินทางภายใน 24 ชม.) | 2,000 THB | 2,500 THB | **4,500 THB** |

- ใน docket ใช้ฟิลด์ `IsPriority = 1` สำหรับ Express
- ตามสัญญา VFS ↔ ผู้ให้บริการ (Command Trading Services): Regular service 600 THB, Express 2,500 THB, Visa fee 2,000 THB; ชำระแบบ real-time โอนเข้าบัญชี VFS
- **ค่าคอมมิชชันจาก VFS (รายเดือน)**: < 30,000 ใบ = 0 · 30,000–99,999 = 90 THB/ใบ · ≥ 100,000 = 120 THB/ใบ (ถึงเกณฑ์แล้วจ่ายตั้งแต่ใบแรก; เดือนแรกจ่ายเมื่อ ≥ 15,000 ใบ)
- **ตารางราคาขายส่ง (Nett price) ของ WeGoThailand**: รายเดือน ≤1,000 = 475 (5%) · 1,000–5,000 = 450 (10%) · 5,001–10,000 = 425 (15%) · >10,000 = 400 (20%)
  และแบบซื้อล่วงหน้า 3 เดือน 500–999 = 450 · 1,000–2,499 = 440 · 2,500–5,000 = 400 · >5,000 = 375 (ส่วนลด 10–25%) — ใช้กับเอเจนซี่/คู่ค้าที่ซื้อเป็นจำนวน

### 3.3 กติกาของแพ็กเกจ

- Regular: **ต้องยื่นภายใน 48–72 ชม. ก่อนเดินทาง** (ภายหลังเขียนว่า "2–3 วัน")
- Express: ยื่นได้ภายใน 24 ชม. ก่อนเดินทาง
- บางบริการเสริมถูกจำกัดตามแพ็กเกจ/สนามบิน (§9.1)

---

## 4. เส้นทางของลูกค้า (Traveler Journey) ตั้งแต่ต้นจนจบ

```
ค้นหา/สแกน QR Mini Program → เลือกวีซ่า/ประเภทบริการ (Regular/Express/VIP)
→ ใส่เที่ยวบินขาไป (ขากลับถ้ามี) → เพิ่มผู้สมัคร (ตัวเอง / เพื่อน / จากรายชื่อเพื่อน)
→ สแกนพาสปอร์ต (OCR อ่านอัตโนมัติ แก้ได้) → อัปโหลดเอกสารตามประเภทวีซ่า
→ กรอกแบบฟอร์มวีซ่า + แบบฟอร์มคำประกาศ (ช่องเทา=ระบบเติมจากเอกสาร, ช่อง * = ต้องกรอก)
→ เซ็นชื่อออนไลน์ → ถ่ายรูปวีซ่า → (ยุค COVID: บัตรประชาชน/บัญชีธนาคาร/ผลตรวจ/ประกัน/Health Kit)
→ เลือกบริการเสริม → ใบกำกับ/ใบเสร็จ (อีเมล, บุคคล/บริษัท) → จ่าย WeChat Pay
→ ระบบส่งข้อมูลอัตโนมัติ → สถานะ "正在审核 请稍后" (กำลังตรวจสอบ)
→ ถ้าเอกสารไม่ครบ: รายการเปลี่ยนเป็นสีเหลือง + เหตุผล → ลูกค้าแก้ → ส่งใหม่
→ อนุมัติ: "审核通过 点击查看通关二维码" + แจ้งทาง Email + WeChat
→ เปิดดูใบอนุมัติ E-VOA + E-Card ประกัน → **พิมพ์ใบอนุมัติ** (บังคับฉบับกระดาษ)
→ บนเครื่องบินกรอก ตม.6 → ลงเครื่อง เดินตามป้าย "Visa On Arrival"
→ แสดงใบ E-VOA เพื่อเข้าช่อง E-VOA lane → เคาน์เตอร์เฉพาะ (สุวรรณภูมิ: โซนระหว่าง Gate D5–D6, Passport Control No.2–5)
→ ยื่นใบ E-VOA + ตม.6 + พาสปอร์ต → รับกระเป๋า → ใช้ E-Card ประกันเมื่อเข้าโรงพยาบาล
```

ข้อสังเกตจากวิดีโอ TieThai: เล่าเรื่อง "ไปสถานทูตต้องรอนาน → ใช้ Mini Program → สตม. pre-approve → บินมา → โชว์ QR/ใบอนุมัติที่เคาน์เตอร์ → เที่ยวไทย" — **คุณค่าหลักที่ขายคือ "ไม่ต้องรอคิว"**

---

## 5. ฟังก์ชันของแอปลูกค้า (Mini Program)

| หน้า/ฟังก์ชัน | รายละเอียด |
| --- | --- |
| หน้าหลัก | รายการประเภทวีซ่า (ชื่อ/ราคา/จำนวนวันพำนัก/ประเภทบริการ) + เมนูล่าง: หน้าแรก / วีซ่าของฉัน / Call center / ข้อมูลของฉัน |
| รายละเอียดวีซ่า | อายุวีซ่า, ระยะพำนัก, จำนวนครั้งเข้า, ราคา, ประเภทบริการ (normal / fast pass / VIP), แท็บ: คำอธิบาย / เอกสารที่ต้องใช้ / ขั้นตอน |
| เลือกประเภทบริการ | ราคาเปลี่ยนตามประเภทที่เลือก |
| ตรวจประวัติใบสมัคร | ถ้ามีใบที่ค้างอยู่ → "ทำต่อ" (ปุ่มน้ำเงิน) หรือ "สร้างใหม่" (ปุ่มเขียว) |
| ข้อมูลเที่ยวบิน | ใส่ **วันที่ + เลขเที่ยวบิน** → ระบบเติมสนามบิน/เวลาอัตโนมัติ (Flight Info API); ขากลับถ้ายังไม่แน่นอนให้ใช้ค่า default; one-way/round-trip ตั้งค่าตามประเภทวีซ่า |
| เพิ่มผู้สมัคร | ตัวเอง / เพื่อนใหม่ / เลือกจากรายชื่อเพื่อน — กลุ่มที่บินเที่ยวเดียวกันเพิ่มคนได้เรื่อย ๆ |
| สแกนพาสปอร์ต | เปิดกล้อง → OCR อ่านข้อมูล → ผู้ใช้แก้ได้ |
| รายการเอกสาร | แสดงเอกสารที่ต้องอัปโหลดตามประเภทวีซ่า (ตั้งค่าได้จากหลังบ้าน) มีเครื่องหมาย ★ = บังคับ |
| แบบฟอร์ม | Visa Application Form + Declaration Form, ตรวจทานได้ท้ายหน้า |
| ลายเซ็นออนไลน์ | เซ็นบนจอ / เซ็นใหม่ |
| รูปถ่ายวีซ่า | ถ่ายจากกล้อง |
| แจ้งให้แก้เอกสาร | เจ้าหน้าที่ตรวจแล้วรายการผิด → **สีเหลือง** + รายละเอียดสิ่งที่ต้องแก้ |
| ใบกำกับภาษี/ชำระเงิน | อีเมล, ออกในนามบุคคล/บริษัท, ยอดรวม → WeChat Pay |
| ประวัติวีซ่า | แสดงเฉพาะของตัวเองที่สำเร็จ |
| ข้อมูลของฉัน | พาสปอร์ตของฉัน (ยืนยันชื่อกับฐานข้อมูลตำรวจจีน, วันหมดอายุ), คำสั่งซื้อของฉัน (กรองตามสถานะ + log), เพื่อนของฉัน, เกี่ยวกับเรา |
| Call center | แชทออนไลน์ในแอป (สไตล์ WeChat) |
| แจ้งผล | Email + WeChat message + ในแอป เมื่อได้ callback จาก สตม. |

### 5.1 สถานะคำสั่งซื้อ (ตามคู่มือ WeGoThailand)

`Inputting` (กำลังกรอก) → `Waiting for pay` → `Waiting for confirm by Immigration` → (`Upload files again`) → `Pass` / `Partially pass` (กรณีกลุ่ม) / `Not pass`
และสถานะปลายทางอื่น: `Time out` (ไม่จ่ายเงินทันเวลา), `Confirm time out` (สตม. ไม่ตอบทันเวลา), `Cancel`

สถานะฝั่ง VFS ที่ส่งกลับ (`updateStatusById.statusId`): **1 = Approved · 2 = Rejected · 3 = NeedUpdate** (+ `statusDesc` เหตุผล)

---

## 6. ช่องทางเอเจนซี่ (B2B)

### 6.1 TieThai Agency Web Portal (2019)

1. Login (`evoa-agent.tiethai.app`) → เมนู **AGENCY TOURS** และ **TOURISTS**
2. **สร้างทริป**: ข้อมูลทั่วไป → เที่ยวบินขาไป → ขากลับ (ใส่แค่เลขเที่ยวบิน+วันที่ ระบบเติมที่เหลือ)
3. **สร้างนักท่องเที่ยว**: ใส่เลขพาสปอร์ต → ถ้าเคยใช้ระบบแล้ว ดึงข้อมูลเดิมมาให้อัตโนมัติ
4. **ผูกนักท่องเที่ยวกับทริป** (1 คนผูกได้หลายทริป)
5. **Verify / กรอกข้อมูล / อัปโหลดรูป** ของแต่ละคน → **จ่ายเงินรายคน** ด้วย WeChat Pay QR
6. นักท่องเที่ยวเข้า Mini Program ด้วยรูปหน้าพาสปอร์ต → เห็นทริปที่เอเจนซี่ผูกไว้ → แก้/อัปโหลดเอกสารเพิ่มเองได้

### 6.2 WeGoThailand Agency (2023)

- 2 โหมด:
  - **ให้ลูกค้ากรอกเองใน Mini Program** — เอเจนซี่แจ้งชื่อ+เลขพาสปอร์ตให้แอดมินเพื่อผูกยอด → ราคาเปิดเผย เอเจนซี่ได้ค่าคอมมิชชันอย่างเดียว
  - **เอเจนซี่กรอกหลังบ้านแทน** (`thai.wego-global.com`) — เอเจนซี่บวกค่าดำเนินการเองได้ เก็บเงินลูกค้าเอง (T/T) แล้วสแกน QR จ่ายค่า STV ให้แพลตฟอร์ม
- **เอเจนซี่ 3 ชั้น**: แอดมินดูแลชั้น 1 → ชั้น 1 ดูแลชั้น 2 → ชั้น 2 ดูแลชั้น 3 (สร้าง ID/รหัสผ่าน, ประเภทบริการ, ราคา)
- **กติการาคา**: ชั้นล่างตั้งราคาต่ำกว่าชั้นบนไม่ได้ และทุกชั้นต้องไม่เกินราคาตลาด — ส่วนต่าง = ค่าคอมมิชชัน
- หน้าหลังบ้าน: รายการ 3 แท็บ (กำลังกรอก / รอจ่าย / รอผล), หน้ารายละเอียด (เพิ่มคนในกลุ่ม), หน้าสร้างใบสมัคร (normal/fast/VIP × single/group),
  อัปโหลดพาสปอร์ต (OCR), แบบฟอร์ม, **ลายเซ็นผ่าน QR** (ส่ง QR ให้ลูกค้าสแกนแล้วเซ็นบนมือถือตัวเอง หรืออัปโหลดรูปลายเซ็น), รูปถ่าย,
  ส่งใบสมัคร, **สร้าง QR ชำระเงิน** (เอเจนซี่จ่ายเองหรือส่งให้ลูกค้าจ่าย — จ่ายแล้วจึงส่งเข้ารัฐ), ติดตามสถานะ/บันทึกเพื่อแก้ไข

---

## 7. ข้อมูลใบสมัคร (Docket) — ฟิลด์ที่ VFS/สตม. ต้องการ

ส่งเป็น **batch** (1 กลุ่ม = หลายผู้สมัคร) — `batchReference`, `paymentBatchReference`, `NoOfApplicants`, `Amount`, และอาร์เรย์ `Applicants`

| กลุ่ม | ฟิลด์ (บังคับ = ตัวหนา) |
| --- | --- |
| applicantDetails | **paymentReceiptRefNumber** (unique ต่อคน), **ApplicantName**, **Email**, **Mobile**, **ISDCode**, **IsPriority** (Express=1), **NationalityId** |
| passportDetails | **GivenName**, **SurName**, MiddleName, **PassportNumber**, **PassportIssueDate**, **PassportExpiryDate**, **DateOfBirth**, **ResidencyId**, **GenderId**, **SalutationId**, **PassportTypeId**, **PermanentAddress**, **State**, **YearlyIncome**, **PlaceOfIssue**, **OccupationId** |
| travelDetails | **ArrivalAirportId**, **ArrivalDate**, **ArrivalTime**, **ArrivalFlightNumber**, **ArrivalAirlinesId**, ArrivalPNRNumber (ถ้า Thai Airways), **DepartureDate/Time/FlightNumber/AirlinesId**, DeparturePNRNumber, **PurposeOfVisit**, **BoardedCountry**, **NextCity**, **FirstTimeTraveller**, **TypeOfFlight** (Charter/Schedule), **LengthOfStay**, เด็กที่เดินทางในพาสปอร์ตเดียวกัน (IsMinor…, MinorFamilyName, MinorGivenName, MinorGender, MinorDateOfBirth, MinorPlaceOfBirth) |
| accommodationDetails | **PlaceOfStayId**, **AccommodationOrOwnerName**, **CityId** (จังหวัด), **DistrictId** (อำเภอ), **SubDistrictId** (ตำบล), **PinCode**, **StreetAddress**, **ReferenceDetails** |
| documentList | **ขั้นต่ำ 6 สูงสุด 8 ไฟล์** — DocumentListId, FileContent (**Base64**), FileName, MimeType (`image/jpeg`, `application/pdf`), FileSize (**≤ 100 KB หรือ ≤ 1024 KB ตามชนิดเอกสาร**) |

รูปแบบข้อมูล: วันที่ `YYYY-MM-DD`, เวลา `HH:MM`, boolean เป็น `1/0`

### 7.1 Master data (ดึงจาก VFS: `GET /v1/master/{name}`)

`salutation` (Mr/Miss/Mrs/Master/Ms) · `gender` · `passportType` (Ordinary) · `occupation` · `airlines` · `arrivalAirport` (สุวรรณภูมิ, ดอนเมือง, …) · `placeOfStay` (Hotel, …) ·
`city` (จังหวัด) · `district/{CityId}` · `subDistrict/{DistrictId}` · `purposeOfVisit` · `yearlyIncome` (<20k / 20–60k / >60k USD / No income) · `flightType` ·
`nationality` (+ `IsResidence`/`IsNationality`) · `documentList` (เช่น "Passport Cover page", นามสกุลที่รับ)

**บทเรียน**: master data เป็นของฝั่งรัฐ/ตัวกลาง — ระบบเดิมดึงมา cache ไว้ และส่งเป็น **ID** ไม่ใช่ข้อความ ระบบใหม่ต้องทำเหมือนกัน (sync ตามรอบ + มีหน้าแอดมิน map ภาษา)

---

## 8. การเชื่อมต่อ VFS (API E-VOA)

### 8.1 API ทั้ง 6 ตัว (ICD v1.2.5)

| # | ทิศทาง | Method | ใช้ทำอะไร |
| --- | --- | --- | --- |
| 1 | WeGo → VFS | `GET master/{name}` | ดึง master data |
| 2 | WeGo → VFS | `POST application/docket` | ส่งใบสมัครทั้งกลุ่ม + เอกสาร → ได้ `webReferenceNumber` ต่อคน (successList / failedList + reason) |
| 3 | WeGo → VFS | `GET getStatusById` | ถามสถานะด้วย webReferenceNumber + paymentReceiptRefNumber |
| 4 | WeGo → VFS | `GET getEVOAById` | ดาวน์โหลด E-VOA (Base64) |
| 5 | WeGo → VFS | `POST uploadAdditionalDocuments` | ส่งเอกสารเพิ่มเมื่อถูก Hold/NeedUpdate (สูงสุด 5 ไฟล์) |
| 6 | VFS → WeGo | `POST updateStatusById` | **callback** แจ้งสถานะ 1/2/3 + เหตุผล + (ถ้าอนุมัติ) `evoaContent` Base64 |

- Auth: Header `Authorization: <JWT ที่ VFS ออกให้>` + `From: <issuer id>`
- Error: 400 ข้อมูลผิดรูปแบบ · 401 ไม่มีสิทธิ์ · 404 request ผิด · 500 ระบบขัดข้อง
- UAT/PROD แยก domain

### 8.2 ลำดับการทำงาน

```
[Master]  WeGo ดึง master → cache
[Submit]  ลูกค้ากรอก+จ่ายเงิน → WeGo ตั้งสถานะ PAID (เก็บ Transaction#) → POST docket → VFS ตรวจเอกสาร → สตม. ตรวจ/pre-approve
[Need update] VFS → updateStatusById(statusId=3, เหตุผล) → แอปแจ้งลูกค้า → ลูกค้าแก้ → uploadAdditionalDocuments → วนกลับไปตรวจ
[Reject]  VFS → updateStatusById(statusId=2, เหตุผล) → แจ้งลูกค้า "ไม่อนุมัติ"
[Approve] VFS → updateStatusById(statusId=1, evoaContent) → แอปเก็บไฟล์ E-VOA → แจ้งลูกค้า
[Fallback] WeGo poll getStatusById / getEVOAById ได้ ถ้า callback ไม่มา
```

### 8.3 การเงินและการกระทบยอด (Payment Flow)

1. ลูกค้าจ่าย WeChat Pay → WeGo ตั้งสถานะ PAID + เก็บ Transaction#
2. ส่ง docket พร้อม Transaction# ของทุกคน (`paymentReceiptRefNumber`)
3. **ทุกวัน 15:00** SCB โอนยอดสะสม (15:00 เมื่อวาน → 15:00 วันนี้) เข้าบัญชี WeGo
4. **ทุกวัน 15:15** WeGo โอนยอดเงินค่าวีซ่าให้ VFS พร้อมรายการ Transaction# อ้างอิง
5. VFS กระทบยอดเงินกับใบสมัครรายคนด้วย Transaction#

---

## 9. บริการเสริม (Value-Added Services)

### 9.1 กติกาการเลือกแพ็กเกจ (Packages Choosing Flow, เม.ย. 2023)

1. เลือกแพ็กเกจ E-VOA (Regular / Express)
2. กรอกข้อมูลและอัปโหลดเอกสาร
3. **ประกัน** — มีแพ็กเกจเดียว "Travel Insurance with Covid-19 coverage 10,000 USD"; ถ้าซื้อกับแพลตฟอร์ม **ระบบอัปโหลดเอกสารประกันเข้าใบสมัครให้อัตโนมัติ**
4. **RT-PCR** — ค่าเริ่มต้น = ไม่ซื้อ; ซื้อแยกจาก E-VOA ได้
5. **SIM** — ค่าเริ่มต้น = ไม่ซื้อ; **ปิดสำหรับ Express** และ **เฉพาะสุวรรณภูมิ**
6. **VIP Services** — ค่าเริ่มต้น = ไม่ซื้อ; **ปิดสำหรับ Express** และ **เฉพาะสุวรรณภูมิ**
7. **Beauty & Health (BHS)** — ค่าเริ่มต้น = ไม่ซื้อ; ซื้อแยกได้
8. **ชำระเงินครั้งเดียวรวมทุกอย่าง** → backend เรียก API ของแต่ละผู้ให้บริการ

> หลักที่ดีและควรเก็บ: **ทุกบริการเสริมค่าเริ่มต้นเป็น "ไม่ซื้อ"** (opt-in) และ **จ่ายครั้งเดียว**

### 9.2 รูปแบบ API ของพาร์ทเนอร์ (ใช้แบบเดียวกันเกือบทุกราย)

| บริการ | ดึงแพ็กเกจ | ซื้อ/ออก voucher | ฝั่งพาร์ทเนอร์ยืนยัน | ผลลัพธ์ |
| --- | --- | --- | --- | --- |
| Insurance (CIS) | — (แพ็กเกจเดียว) | `travelPAPolicyIssueService` (ข้อมูลผู้เอาประกัน, PlanCode, วันเริ่ม/สิ้นสุด) → policy_no | `Confirm_COI` (policy_url, **ecard_url**) | COI + E-Card แสดงในแอป |
| RT-PCR (PRINC) | `package_list?category=RT-PCR` | `gen_rtpcr_voucher` → Voucher Code | โรงพยาบาล `verify_voucher` (Valid/Invalid/Used) → `confirm_voucher` | `callback_result` ผลตรวจ |
| SIM (TRUE) | `package_list?category=SIM` | `sim_buy` (+ รูปหน้าพาสปอร์ต Base64) → TransactionID | TRUE ใช้ SIM Web App เตรียม/activate ซิมล่วงหน้า 3 วัน → ลูกค้ารับที่เคาน์เตอร์ → `sim_confirm` | สถานะ "รับซิมแล้ว" |
| VIP Fast Track | `package_list?category=SERVICE` | `vip_buy` | VIP Co. ใช้ Web App / Excel → `vip_confirm` | สถานะ "ใช้บริการแล้ว" |
| BHS | `package_list?category=HEALTH` | `gen_health_voucher` | `verify_voucher` → `confirm_voucher` | `callback_result` ใบรับรอง/ผล |

- ข้อมูลแพ็กเกจที่พาร์ทเนอร์ส่ง: `package_code`, `package_category`, `package_name`, `package_detail`, ราคา **THB/USD/CNY**, `package_image`, `terms_of_use`, `ref_link` (PDF), รองรับ `lang`
- Auth ของพาร์ทเนอร์: `X-API-KEY` (เข้ารหัสจาก SECRET_KEY + timestamp), `timestamp`, `key` (PUBLIC_KEY) — บางตัวใช้ `g-api-key` + Bearer token
- **ส่งต่อข้อมูลให้พาร์ทเนอร์ด้วย Excel ทางอีเมลทุกวัน 00:30** (RT-PCR, VIP, BHS) — งาน manual ที่ระบบใหม่ควรเปลี่ยนเป็น Partner Portal
- พาร์ทเนอร์เตรียมของล่วงหน้า **3 วันก่อนลูกค้ามาถึง** (SIM, VIP) → ระบบต้องส่งข้อมูลเที่ยวบินขาเข้าให้ครบและแม่น

---

## 10. สถาปัตยกรรม

### 10.1 เดิม (TieThai)

```
[WeChat Mini Program] ─ Frontend Tier (ฝั่งจีน, เรียก OCR/Flight API) ─ Backend Tier (ไทย, logic เยอะ) ─ VFS EVOA System
                                   (API ระหว่าง Frontend↔Backend จำนวนมาก = ช้า)
```

### 10.2 ใหม่ (WeGoThailand 2023)

```
[Mini Program] ─ Frontend/Backend Tier (ฝั่งจีน — business logic ทั้งหมด)
               ─ APIs Gateway (ไทย — ไม่มี business logic, เหลือ 6 API เท่ากับฝั่ง VFS) ─ VFS
                                  └─ Partners (Super App): Insurance, Flight & Hotel, Mobile SIM, Money Exchange,
                                     Limousine & Car Rental, Duty Free, Content Streaming
```

เหตุผลที่ย้าย: ลดจำนวนรอบเรียก API ข้ามประเทศ → เร็วขึ้น; Gateway บางเป็นจุดเสียบพาร์ทเนอร์เพิ่มได้ง่าย

### 10.3 Roadmap "Super App" ที่เคยวางไว้

Money Exchange (แลกเงินล่วงหน้า + ส่งถึงที่), ประกัน, SIM, Taxi/รถเช่า, Tax Refund, จองตั๋ว/โรงแรม, E-Marketplace — **แนวคิดเดียวกับ Value-Added Ecosystem ของระบบใหม่**

---

## 11. ยุค COVID (บันทึกไว้เป็นประวัติ — ไม่ต้องทำในระบบใหม่)

Health Kit 14 วัน, ผลตรวจ ≤ 72 ชม., Fit-to-Fly, COE, ประกัน 100,000 USD, เชื่อม MorChana, Dashboard ให้ MOTS/TAT ติดตามนักท่องเที่ยว
→ สิ่งที่ยังมีประโยชน์: **แนวคิด Dashboard ข้อมูลนักท่องเที่ยวให้ภาครัฐ (TAT)** และ **การตรวจย้อนกลับว่าเอกสารมาจากผู้ออกจริง**

---

## 12. สิ่งที่ควรเก็บ / ควรเปลี่ยน ในระบบใหม่

| ระบบเดิม | ปัญหา | ระบบใหม่ควรทำ |
| --- | --- | --- |
| ผ่าน VFS (third-party) | ช้า, มีค่าส่วนแบ่ง, ไม่ควบคุม SLA | **Direct API กับ สตม.** (ตาม requirement) — แต่ออกแบบ adapter ให้สลับเป็นตัวกลางได้ถ้าจำเป็น |
| WeChat เท่านั้น | จำกัดแค่ตลาดจีน | **Web App (PWA) ทุกชาติ ทุกภาษา** + login หลายช่องทาง |
| WeChat Pay เท่านั้น | ต่างชาติจ่ายไม่ได้ | Payment Gateway สากล (บัตร, Apple/Google Pay, Alipay, WeChat Pay, UnionPay …) |
| พิมพ์ใบ E-VOA บังคับ | ไม่สะดวก ลืมพิมพ์ | E-VOA ดิจิทัล + QR (**ต้องเจรจากับ สตม.**) — ระหว่างนั้นยังให้ PDF พิมพ์ได้ |
| ส่งไฟล์ Base64 ใน JSON, ≤100 KB | รูปถูกบีบจนอ่านไม่ออก, ไฟล์ถูกตีกลับ | บีบอัด/ครอปฝั่ง client อัตโนมัติให้ได้ขนาดตามสเปก + ตรวจคุณภาพก่อนส่ง |
| Excel ทางอีเมล 00:30 | ช้า ผิดพลาด ไม่ปลอดภัย | **Partner Portal** + API + QR redeem |
| ทุกชั้นเอเจนซี่ตั้งราคาเอง | ยุ่ง, ราคาไม่โปร่งใส | B2B portal + price tier ที่แอดมินคุม |
| Poll สถานะ | ช้า/เปลือง | Callback/webhook เป็นหลัก + poll เป็น fallback + idempotency |
| ลูกค้าเห็นสถานะเป็นภาษาจีนอย่างเดียว | — | ข้อความสถานะ + เหตุผลแปลทุกภาษา |
| API key/token อยู่ในเอกสาร | **ความเสี่ยงความปลอดภัย** (ดู §13) | Secret อยู่ใน secret manager เท่านั้น |

สิ่งที่ **ต้องเก็บไว้** เพราะได้ผลแล้ว: เติมเที่ยวบินอัตโนมัติจากเลขเที่ยวบิน · OCR พาสปอร์ต · ใบสมัครแบบกลุ่ม/สมัครแทนเพื่อน · รายชื่อเพื่อน (ไม่ต้องกรอกซ้ำ) ·
ดึงข้อมูลลูกค้าเก่าจากเลขพาสปอร์ต · ลายเซ็นผ่าน QR · รายการเอกสารเปลี่ยนสีเมื่อต้องแก้ + บอกเหตุผล · บริการเสริม opt-in + จ่ายครั้งเดียว ·
อัปโหลดประกันเข้าใบสมัครอัตโนมัติ · ช่อง E-VOA lane + พนักงานที่สนามบิน · Call/Chat 24×7 · กระทบยอดรายวันด้วยเลขอ้างอิงรายคน

---

## 13. ข้อควรระวังด้านความปลอดภัยที่พบในเอกสาร

ไฟล์ Swagger/ICD ใน repo นี้ (`3.3 CIS Insurance…`, `5.3 SIM…`, `6.2/6.3 VIP…` และอื่น ๆ) **มี API key และ Bearer token ตัวจริงฝังอยู่**
ถึงจะเป็นระบบเก่า ก็ควร:
1. ยืนยันว่า key/token เหล่านั้นถูกยกเลิก (revoke) แล้วทั้ง UAT/PROD
2. ไม่คัดลอกค่าใดๆ ไปใช้ในระบบใหม่ และไม่ใส่ secret ในเอกสารอีก
3. พิจารณาทำ repo เป็น private (ถ้ายังไม่ได้ทำ)

---

## 14. สิ่งที่ต้องยืนยันใหม่กับ สตม. ก่อนใช้กับระบบใหม่

ข้อมูลในไฟล์นี้มาจากเอกสารปี 2019–2023 กฎปัจจุบันอาจเปลี่ยนแล้ว:
- รายชื่อสัญชาติที่ขอ VOA ได้, ระยะพำนัก (15 วัน?), ค่าธรรมเนียม (2,000 THB?) และเงื่อนไขหลักฐานการเงิน
- ยังต้องพิมพ์ใบ E-VOA หรือใช้ QR/ดิจิทัลได้
- รายการสนามบิน/ด่านที่รองรับ E-VOA และตำแหน่งช่อง E-VOA lane
- แบบฟอร์มขาเข้า (ตม.6 เดิม — ปัจจุบันไทยใช้ **TDAC: Thailand Digital Arrival Card**) จะเชื่อมกับ E-VOA หรือไม่
- ชุดฟิลด์/เอกสาร/ขนาดไฟล์ที่ API ของ สตม. ต้องการ (อาจไม่เหมือน docket ของ VFS)
- SLA ของ Regular/Express และช่วงเวลาที่ต้องยื่นล่วงหน้า
