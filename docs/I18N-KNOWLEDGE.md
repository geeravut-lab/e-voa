# Knowledge: สองภาษา (ไทย/อังกฤษ) และการสลับภาษา โดยคอมไพเลอร์บังคับให้แปลครบ (จากระบบ RooSuk)

> อ้างอิงโค้ดจริง: `src/lib/i18n/dict.ts` (พจนานุกรม ~5,000 key ต่อภาษา, `fmt`, `errorText`) · `src/lib/i18n/server.ts` (`getLang`, `getT`, `brandedDict`)
> · `src/lib/i18n/provider.tsx` (`I18nProvider`, `useI18n`) · `src/lib/i18n/format.ts` (วันที่) · `src/app/actions/language.ts` (`setLanguage`)
> · `src/components/LangSwitch.tsx` · `src/app/layout.tsx` (`<html lang>`) · `src/lib/i18n/dict.test.ts` · `src/lib/notify/server.ts` (`dictFor`)
> แนวคิดตั้งต้น: `docs/12-i18n-thai-english.md` (โครงการก่อนหน้า)

---

## 1. ปัญหาที่แก้

- แอปเป็นภาษาไทยก่อน แต่ต้องมีภาษาอังกฤษครบ — ปัญหาที่เจอบ่อยคือ **ลืมแปล** (หน้าจอโชว์ key ดิบหรือช่องว่าง) และข้อความภาษาไทยหลุดมาในโค้ด
- server action ต้องบอก error ได้โดยไม่ผูกกับภาษา
- ข้อความที่ส่งออกนอกแอป (LINE) ต้องเป็นภาษาของ **ผู้รับ** ไม่ใช่ของคนที่ทำให้เกิดเหตุการณ์
- ไม่ใช้ไลบรารี i18n ขนาดใหญ่ / ไม่ต้องมีไฟล์ JSON แยกที่คอมไพเลอร์ตรวจไม่ได้

## 2. สรุปสั้น

1. **พจนานุกรมเดียวในไฟล์ TypeScript ธรรมดา** (`dict.ts`, ไม่มี import React) — ใช้ได้ทั้ง server, metadata และ client
2. **ไทยเป็นต้นฉบับ**: `type Dict = { [K in keyof typeof th]: string }` แล้ว `const en = { … } satisfies Dict`
   → **key ที่ขาดหรือเกินในภาษาอังกฤษ = คอมไพล์ไม่ผ่าน**
3. โค้ดเขียน `t.someKey` เท่านั้น **ห้ามเขียนข้อความในโค้ด** — key ที่ไม่มีก็คอมไพล์ไม่ผ่านเช่นกัน
4. **server คืนรหัส `err_*` ไม่ใช่ประโยค** → `errorText(code, t)` แปลงฝั่งหน้าจอ (รหัสไม่รู้จัก = ข้อความทั่วไป)
5. ภาษาเก็บใน **cookie** (ให้ server render ถูกตั้งแต่แรก) และ **ในโปรไฟล์** (ให้ตามผู้ใช้ไปทุกเครื่อง และใช้กับข้อความ LINE)
6. server ส่งพจนานุกรม **ภาษาเดียว** ลงหน้า (ไม่ส่งทั้งสองภาษาไป browser)
7. ชื่อแอปในพจนานุกรมถูกสลับเป็นชื่อที่แอดมินตั้ง (`brandedDict`, cache ต่อภาษา+ชื่อ)
8. เทสเสริมที่คอมไพเลอร์ตรวจไม่ได้: ไม่มีข้อความว่าง, **placeholder `{name}` ตรงกันทั้งสองภาษา**

## 3. โครงที่ใช้

### 3.1 พจนานุกรม

```ts
export type Lang = "th" | "en";
export const LANGS: readonly Lang[] = ["th", "en"];
export const DEFAULT_LANG: Lang = "th";
export const LANG_COOKIE = "roosuk-lang";

const th = {
  appName: "รู้สุข",
  save: "บันทึก",
  navToday: "วันนี้",
  backTo: "กลับไป{page}",
  err_unknown: "เกิดข้อผิดพลาด ลองใหม่อีกครั้ง",
  // … จัดกลุ่มด้วยคอมเมนต์ // ── navigation, // ── shop …
};
export type Dict = { [K in keyof typeof th]: string };
const en = {
  appName: "RooSuk",
  save: "Save",
  navToday: "Today",
  backTo: "Back to {page}",
  err_unknown: "Something went wrong. Please try again.",
} satisfies Dict; // ขาด/เกิน key = error ตอน typecheck
export const dict: Record<Lang, Dict> = { th, en };

export function fmt(template: string, vars: Record<string, string | number>) {
  // เติม {placeholder}; ที่ไม่รู้จักคงไว้
  return template.replace(/\{(\w+)\}/g, (m, name) =>
    name in vars ? String(vars[name]) : m,
  );
}
export type ErrorKey = Extract<keyof Dict, `err_${string}`>;
export const isErrorKey = (v: unknown): v is ErrorKey =>
  typeof v === "string" && v.startsWith("err_") && v in th;
export const errorText = (code, t) =>
  isErrorKey(code) ? t[code] : t.err_unknown;
```

ใช้ template literal type บังคับ key ที่สร้างแบบไดนามิกได้ด้วย เช่น

```ts
t[`flag_${flag}` as const]; // ทุก FeatureFlag ต้องมีคำแปล flag_<name>
t[`shopStatus_${status}` as const]; // ทุกสถานะออเดอร์
type NavLabelKey = Extract<keyof Dict, `nav${string}`>; // เมนูใช้ได้แค่ key ที่ขึ้นต้น nav
```

### 3.2 ฝั่ง server

```ts
export async function getLang(): Promise<Lang> {          // cookie → ไม่มี/ผิด = ไทย
  const v = (await cookies()).get(LANG_COOKIE)?.value; return isLang(v) ? v : DEFAULT_LANG;
}
export async function brandedDict(lang: Lang): Promise<Dict> { … }   // สลับชื่อแอป, cache ≤ 8 ชุด
export async function getT(): Promise<Dict> { return brandedDict(await getLang()); }
```

- root layout: `<html lang={lang}>` + `<I18nProvider lang={lang} dict={t}>` (ส่งภาษาเดียว)
- metadata (`generateMetadata`) ใช้ `getT()` ได้ตรง ๆ
- ข้อความถึงคนอื่น (LINE, แจ้งเตือน): `dictFor(userId)` อ่าน `profiles.language` ของผู้รับ → `brandedDict(lang)`
- prompt ของ AI เขียนเป็นภาษาอังกฤษ (โมเดลทำตามได้ดีกว่า) แล้วสั่งให้ตอบเป็นภาษาของผู้ใช้; ข้อความที่ผู้ใช้เห็นยังมาจากพจนานุกรม

### 3.3 ฝั่ง client

```tsx
const { lang, t, fmt } = useI18n();          // throw ถ้าอยู่นอก provider (จับข้อผิดพลาดตอนพัฒนา)
<p>{fmt(t.backTo, { page: t.navToday })}</p>
<p>{errorText(state.error, t)}</p>
```

### 3.4 สลับภาษา

```ts
// server action
export async function setLanguage(lang: string) {
  if (!isLang(lang)) return { ok: false };
  (await cookies()).set(LANG_COOKIE, lang, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  if (user)
    await supabase
      .from("profiles")
      .update({ language: lang })
      .eq("id", user.id); // best-effort
  revalidatePath("/", "layout");
  return { ok: true };
}
```

`LangSwitch`: ปุ่มสองปุ่ม (`role="group"`, `aria-pressed`, ปุ่มแต่ละภาษามี `lang=` ของตัวเอง ให้ screen reader อ่านถูกสำเนียง)
→ `startTransition(setLanguage → router.refresh())` พร้อม spinner บนปุ่มที่กด และ disabled ระหว่างทำงาน — **ไม่ reload ทั้งหน้า** และค่าที่พิมพ์ในฟอร์มยังอยู่
ปุ่มอยู่ในโครงหลัก (header มือถือ / sidebar), หน้าแรกสาธารณะ, หน้าเข้าสู่ระบบ, แบบทดสอบ, หน้าที่เปิดจากลิงก์แชร์ และหน้าตั้งค่า

### 3.5 วันที่และตัวเลข

`formatDate(lang, value)` / `formatDateTime(...)` ด้วย `Intl.DateTimeFormat` ตามภาษา (ไทยเป็น พ.ศ.) และ **เขตเวลา Asia/Bangkok เสมอ** (server อยู่ UTC);
locale ไทย = `th-TH-u-ca-buddhist`, อังกฤษ = `en-GB`; ป้ายช่วงเวลาในรายงาน (`bucketLabel`) ใช้หลักเดียวกัน — ระวัง: ขอปีสองหลักอย่างเดียวใน locale ไทย Intl จะเติม "พ.ศ." ข้างหน้า ต้องประกอบชิ้นส่วนเอง

### 3.6 เทส (`dict.test.ts`)

- key ตรงกันสองภาษา (ซ้ำกับคอมไพเลอร์ แต่จับกรณี cast)
- ไม่มีข้อความว่าง
- **placeholder ชุดเดียวกัน** ในทั้งสองภาษา (`{name}` หายในคำแปล = ตัวเลขหายจากหน้าจอโดยไม่มีใครรู้)
- มีคำแปลของเมนูหลัก และมี error code (`err_*`) — ส่วน key ที่สร้างแบบไดนามิก (`flag_<name>`, `shopStatus_<status>`) ถูกตรวจโดยชนิดข้อมูลตอนคอมไพล์
- `fmt` เติม/คง placeholder, `errorText` รหัสไม่รู้จัก → ข้อความทั่วไป
- Playwright: กดสลับภาษาจาก header แล้วหน้าเปลี่ยนภาษา

## 4. กฎที่ห้ามละเมิด

1. ทุกข้อความบนหน้าจออยู่ใน `dict.ts` — ห้ามเขียนข้อความใน component (รวมถึง `aria-label`, `alt`, `placeholder`, `<title>`)
2. เพิ่ม key ที่ไทยก่อน แล้วคอมไพเลอร์จะบังคับให้เพิ่มภาษาอังกฤษ
3. server action/route คืน `err_*` เท่านั้น
4. ชื่อแอปเขียนเฉพาะในพจนานุกรม (ระบบสลับชื่อให้)
5. ข้อความถึงคนอื่นใช้ภาษาของผู้รับ (`dictFor`)
6. โค้ด ชื่อตัวแปร และคอมเมนต์เป็นภาษาอังกฤษ; ข้อความผู้ใช้เป็นไทยก่อน
7. ห้ามส่งพจนานุกรมทั้งสองภาษาไปที่ browser

## 5. บทเรียนจากของจริง

| เกิดอะไร                                                       | สาเหตุราก                     | แก้อย่างไร                                         |
| -------------------------------------------------------------- | ----------------------------- | -------------------------------------------------- |
| หน้าจอโชว์ตัวเลขหาย ("ยอด บาท")                                | คำแปลอังกฤษ/ไทยลืม `{amount}` | เทส placeholder ตรงกันทั้งสองภาษา                  |
| ข้อความ error ภาษาไทยโผล่ในหน้าภาษาอังกฤษ                      | action คืนประโยค              | คืนรหัส `err_*` + `errorText`                      |
| แจ้งเตือน LINE ถึงแอดมินเป็นภาษาของลูกค้าที่ทำให้เกิดเหตุการณ์ | ใช้ภาษาของคำขอปัจจุบัน        | `dictFor(recipient)` ต่อผู้รับ                     |
| สลับภาษาแล้วฟอร์มที่พิมพ์ค้างหาย                               | reload ทั้งหน้า               | server action + `router.refresh()`                 |
| เปลี่ยนชื่อแอปแล้วบางหน้ายังเป็นชื่อเดิม                       | เขียนชื่อในโค้ดตรง ๆ          | ชื่อเฉพาะในพจนานุกรม + `brandedDict`               |
| เมนูใหม่ไม่มีคำแปล ทำให้ sidebar ว่าง                          | label เป็น string อิสระ       | `NavLabelKey` เป็นชนิดที่ต้องเป็น key ของพจนานุกรม |

## 6. ลอกไปใช้อย่างไร

1. `dict.ts`: `th` (ต้นฉบับ) → `type Dict` → `en satisfies Dict` + `fmt`, `ErrorKey`, `errorText`
2. `server.ts`: `getLang` (cookie), `getT`; ถ้ามีชื่อแบรนด์ที่แก้ได้ เพิ่ม `brandedDict`
3. `provider.tsx`: context ภาษาเดียว + `useI18n`
4. `setLanguage` (cookie + โปรไฟล์ + revalidate) + `LangSwitch`
5. `<html lang>` และ metadata จาก `getT()`
6. ตัวจัดรูปแบบวันที่/ตัวเลขตามภาษาและเขตเวลาเดียว
7. ข้อความถึงผู้อื่นเลือกภาษาจากโปรไฟล์ผู้รับ
8. เทส §3.6 + lint/review ห้ามข้อความในโค้ด
9. ภาษาที่สาม: เพิ่มใน `Lang`/`LANGS` แล้ว `const xx = { … } satisfies Dict` — คอมไพเลอร์บอกทุก key ที่ต้องแปล
