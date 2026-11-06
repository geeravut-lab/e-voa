# Knowledge: การเลือกและตั้งค่า AI Provider และ Model (จากระบบ RooSuk)

> ไฟล์นี้สรุปสิ่งที่ RooSuk ใช้จริงและบทเรียนที่วัดได้ เพื่อนำไปให้ project อื่นใช้ซ้ำ
> อ้างอิงโค้ดจริงที่ `src/lib/ai/*`, `src/app/(app)/admin/ai/*`, `src/app/actions/ai.ts`,
> `supabase/migrations/20261007000100_ai_settings.sql` และเอกสาร `docs/11-ai-provider-settings.md`,
> `docs/ROOSUK-MASTER-PLAN.md` §8, `docs/RooSuk-Tool-Cost-Analysis.pdf`
>
> **ตัวเลขที่มีวันที่กำกับ** (ชื่อรุ่น ราคา ผลทดสอบ) เปลี่ยนเร็ว ให้ตรวจกับเอกสารทางการของผู้ให้บริการก่อนนำไปใช้
> **หลักการและโครงสร้าง** ในไฟล์นี้ต่างหากที่ตั้งใจให้คงอยู่

---

## 1. สรุปสั้น (อ่านแค่นี้ก็เริ่มได้)

1. **ฟีเจอร์ไม่รู้จัก provider** — โค้ดฟีเจอร์เรียก `runAi(task, request)` ตัวเดียว ตัว SDK ของแต่ละเจ้าซ่อนอยู่หลัง adapter
2. **เลือกตาม "ชนิดงาน" (task) ไม่ใช่ตามฟีเจอร์** — งานต่างกันคุ้มกับโมเดลต่างขนาด (รูปอาหาร ≠ อธิบายผลแล็บ ≠ คัดกรองความปลอดภัย)
3. **ตัดสิน 3 ชั้น**: ตั้งค่าจากหน้า admin (ฐานข้อมูล) → ค่าเริ่มต้นในโค้ด (ทำงานได้เสมอ) · เปลี่ยน provider/โมเดลได้โดย **ไม่ต้อง deploy** เพราะชื่อรุ่นเปลี่ยนและหายบ่อยกว่าโค้ด
4. **มี fallback ได้ 1 ครั้ง** เฉพาะ error ที่คุ้ม (429, 5xx, network, 401/403) และ **บันทึกเฉพาะ fallback/error** ไม่บันทึกครั้งที่สำเร็จ
5. **ทดสอบโมเดลก่อนบันทึก** ด้วยปุ่ม "ทดสอบ" (ส่งคำสั่งสั้น ๆ ไปที่ provider+model นั้นตรง ๆ) และดึง **รายการรุ่นจริงจาก API** แทนการเชื่อเอกสาร
6. **ราคา/ต้นทุนคุมที่ปลายทาง** — ทุกการเรียกต้องผ่านโควตาตามแพ็กเกจก่อน (`checkAndConsume`) แล้วค่อยเรียก `runAi`
7. **ข้อมูลสุขภาพ/ข้อมูลส่วนบุคคลห้ามผ่าน free tier** และห้ามผ่านตัวกลาง (AI Gateway) ที่ไม่ได้ตกลงไว้ — ล็อก base URL ตรงไปที่ผู้ให้บริการ

---

## 2. เลือก provider และ model อย่างไร

### 2.1 หลักคิด

| คำถาม                                | คำตอบที่ใช้ใน RooSuk                                                                                                                           |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| ต้องใช้กี่ provider                  | **2 เจ้า** (Anthropic Claude + Google Gemini) พอ — ได้ทั้งสำรองกันและเลือกจุดแข็งต่องาน; เจ้าที่ 3 เพิ่มได้ภายหลังโดยเพิ่ม adapter 1 ไฟล์      |
| เลือกด้วยอะไร                        | **คุณภาพภาษาไทย/การทำตามกฎ (guardrail) · รับ input อะไรได้ (รูป / PDF / เสียง) · ความเร็ว · ราคาต่อครั้ง** ตามลำดับ ไม่ใช่ benchmark รวม       |
| รุ่นแพงสุดเป็น default ไหม           | **ไม่** — "default รุ่นแพงสุดทำให้ขายต่ำกว่าทุน" (บทเรียนจากเอกสาร 10/11) Opus ไม่ถูกใช้เป็นค่าเริ่มต้นของงานใดเลย                             |
| ใครเป็นคนตัดสินผลทางสุขภาพ           | **ไม่ใช่โมเดล** — โมเดลอ่าน/อธิบาย ส่วนตัวเลขและการตัดสิน (ปกติ/ผิดปกติ, BMI, kcal) คำนวณในโค้ด; ผลของโมเดลต้องผ่านตัวตรวจ (schema, guardrail) |
| เมื่อ provider ไม่รับ input ชนิดนั้น | ระบุ capability ใน registry (`images/pdf/audio`) และ **ไม่ตั้ง fallback** ให้งานที่อีกเจ้าทำไม่ได้ (เช่น เสียง → Gemini เท่านั้น)              |

ความเชี่ยวชาญเฉพาะทาง **ไม่ได้มาจากการเลือกโมเดลอย่างเดียว** — มี 4 ชั้น: (1) LLM อ่านรูป/เอกสารและอธิบายภาษาคน
(2) ข้อมูลอ้างอิงในระบบ (ตารางอาหารไทย, ช่วงค่าอ้างอิง biomarker) ให้ตัวเลขถูก (3) **โค้ดตัดสินผล**
(4) คนตรวจ (ผู้ใช้ยืนยันค่าที่อ่านได้ก่อนบันทึก; แพทย์/เภสัชกรตรวจ prompt)

### 2.2 ตารางเส้นทางที่ใช้จริง (primary → fallback)

ค่าเริ่มต้นใน `TASK_ROUTES` (หน้า admin override ได้ทุกช่อง)

| task                                                | ใช้ทำอะไร                                           | primary             | fallback  | เหตุผล                                                                                                                         |
| --------------------------------------------------- | --------------------------------------------------- | ------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `food_scan`                                         | รูปอาหาร → JSON สารอาหาร                            | Gemini              | Claude    | เร็ว ถูก วิชันดี; ระบุเมนู/portion แล้วดึงสารอาหารจากตารางอาหารไทยของระบบ                                                      |
| `body_scan`                                         | รูปร่าง/ผิว                                         | Gemini              | Claude    | เหมือนข้างบน                                                                                                                   |
| `lab_extract`                                       | PDF/รูปผลแล็บ → JSON biomarker                      | Claude              | Gemini    | อ่าน PDF ในตัว แม่นกับตาราง/ภาษาไทย ใช้ structured output                                                                      |
| `lab_explain`                                       | อธิบายผลแล็บ                                        | Claude              | Gemini    | ทำตาม guardrail ดี อธิบายจากค่าที่โค้ดคำนวณแล้ว                                                                                |
| `chat`                                              | ถาม AI                                              | Claude              | Gemini    | คุณภาพภาษาไทย + prompt caching                                                                                                 |
| `agent`                                             | Agent เรียกเครื่องมือ (JSON steps)                  | Claude              | Gemini    | ทำตามรูปแบบ JSON/ tool ได้เชื่อถือได้                                                                                          |
| `quick`                                             | FAQ จัดหมวด สรุปสั้น                                | Claude (รุ่นเล็ก)   | Gemini    | ถูกและเร็ว                                                                                                                     |
| `safety`                                            | คัดกรองข้อความเสี่ยง                                | Claude (รุ่นเล็ก)   | **ไม่มี** | ออกแบบให้ทำก่อนทุกข้อความ (ยังไม่ได้ต่อกับหน้าจอใดใน RooSuk — ตอนนี้เคสฉุกเฉินคัดด้วยคำสำคัญในโค้ด); ค่าเริ่มต้นไม่มีเจ้าสำรอง |
| `daily_plan`, `goal_plan`, `prompt_review`          | ข้อความสั้น/แผนจากตัวเลขที่โค้ดคำนวณ                | Claude (รุ่นเล็ก)   | Gemini    | ถูก                                                                                                                            |
| `monthly_report`, `doctor_brief`, `condition_draft` | งานยาว/คุณภาพสูง ไม่ real-time                      | Claude (รุ่นกลาง)   | Gemini    |                                                                                                                                |
| `voice_transcribe`                                  | เสียง → ข้อความ                                     | Gemini (Flash-Lite) | **ไม่มี** | Claude ไม่รับเสียง; ราคาเสียงถูกมาก                                                                                            |
| `goal_menu`                                         | ไอเดียมื้ออาหาร/ตารางรายสัปดาห์ (คำตอบโครงสร้างยาว) | Gemini              | Claude    | เร็วก่อน; งานตามเวลา ไม่มี user รออยู่                                                                                         |

### 2.3 ราคาอ้างอิง ณ ต.ค. 2026 (USD ต่อ 1M token, เข้า/ออก — **ตรวจใหม่ก่อนใช้**)

| รุ่น                                           | ราคา          | หมายเหตุ                                                 |
| ---------------------------------------------- | ------------- | -------------------------------------------------------- |
| Claude Sonnet 5.5 (`claude-sonnet-5-5`)        | $2 / $10      | รุ่นกลาง: แชต, Agent, อ่านแล็บ, รายงาน                   |
| Claude Haiku 4.5 (`claude-haiku-4-5`)          | $1 / $5       | รุ่นเล็กที่ใช้อยู่                                       |
| Claude Haiku 5.5                               | $0.10 / $0.50 | ถูกกว่าราว 10 เท่า — เป็นข้อเสนอลดต้นทุน (ยังไม่ได้สลับ) |
| Claude Opus 5.5                                | $4 / $20      | **ไม่ใช้เป็นค่าเริ่มต้น**                                |
| Gemini 3 Flash (`gemini-3-flash-preview`)      | $0.50 / $3.00 | ถูกกว่า Sonnet ราว 4 เท่า รับรูป/PDF/เสียง               |
| Gemini Flash-Lite (`gemini-flash-lite-latest`) | $0.30 / $2.50 | เสียงคิดราคาเท่าตัว                                      |

ตัวอย่างต้นทุนต่อ 1 ครั้ง (฿ ตามเส้นทางปัจจุบัน): ถาม AI ≈ 0.49 · Agent 1 ข้อความ ≈ 1.26 · สแกนอาหาร ≈ 0.16 ·
อ่านแล็บ+อธิบาย ≈ 2.24 · รายงานรายเดือน ≈ 0.70 · เสียง 45 วินาที ≈ 0.04 · แผนเป้าหมาย ≈ 0.56
(ที่มา: `docs/RooSuk-Tool-Cost-Analysis.pdf`) — **วัดต้นทุนก่อนตั้งราคาแพ็กเกจเสมอ**

### 2.4 วิธีเลือกรุ่นแบบมีขั้นตอน (ใช้ซ้ำกับ project อื่นได้)

1. ลิสต์ **ชนิดงาน** ของ project (ไม่ใช่ฟีเจอร์) และ input/output ของแต่ละงาน (ข้อความ/รูป/PDF/เสียง, ต้อง JSON ไหม, ยาวแค่ไหน, ผู้ใช้รออยู่ไหม)
2. ใส่ **capability** ที่จำเป็นต่อแต่ละงาน ตัด provider ที่ทำไม่ได้ออก
3. เลือก primary ที่ **คุณภาพพอ** (ทดสอบด้วยชุดคำถาม/ตัวอย่างจริงของงานนั้น 20–50 ข้อ ให้คนที่รู้เรื่องตรวจ) แล้วค่อยดูราคา
4. กำหนด fallback เป็นเจ้าอื่นเฉพาะงานที่ทำได้เหมือนกัน; งานด้านความปลอดภัยให้พิจารณา **ไม่มี fallback** เพื่อพฤติกรรมคงที่
5. คำนวณต้นทุนต่อครั้ง = (token เข้า × ราคาเข้า + token ออก × ราคาออก) ของตัวอย่างจริง แล้วคูณเพดานโควตาต่อเดือนของแพ็กเกจ เทียบกับราคาขาย
6. ถ้าต้นทุนสูงเกิน: ย้ายงานเล็กไปรุ่นเล็ก · ใช้ prompt caching · Batch API (ลด 50%) สำหรับงานไม่ real-time · ย่อรูปก่อนส่ง (ด้านยาว ≈ 1024px) · ลดเพดานโควตา
7. ใส่ค่าที่ได้เป็น **ค่าเริ่มต้นในโค้ด** แล้วปล่อยให้ admin ปรับต่อได้

---

## 3. สถาปัตยกรรม (copy ไปใช้ได้)

```
feature code ──► checkAndConsume(user, feature)   ← ด่านโควตา (ผู้เรียกทำ ก่อนทุกครั้ง)
                    │ ผ่าน
                    ▼
                runAi(task, request)               ← src/lib/ai/server.ts  (server-only)
                    │ 1. เติม prompt เพิ่มของ admin (ถ้ามี) + ชื่อแบรนด์
                    ▼
                runAiWith(deps, task, request)     ← src/lib/ai/run.ts  (บริสุทธิ์: ฉีด deps ได้ทดสอบง่าย)
                    │ 2. loadSettings() (cache 30 วินาที)  3. resolveRoute()  4. เรียก primary
                    │ 5. error ที่คุ้ม → retry เจ้าเดิม 1 ครั้ง (503/429) → fallback 1 ครั้ง
                    ▼
        adapters[provider].call(req, model, apiKey)  ← anthropic.ts / google.ts
```

### 3.1 ไฟล์และหน้าที่

| ไฟล์            | หน้าที่                                                                                                                                  |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `types.ts`      | `PROVIDER_IDS`, `TASK_KINDS`, `AiRequest/AiResponse`, `ProviderAdapter`, `AiError` — ฟีเจอร์คุยกับชนิดเหล่านี้เท่านั้น                   |
| `registry.ts`   | `PROVIDERS` (ชื่อ env ของ key, capability, **รุ่นเริ่มต้นต่อ task**) · `TASK_ROUTES` (primary/fallback เริ่มต้นต่อ task) · `apiKeyFor()` |
| `route.ts`      | `parseAiSettings()` (อ่านแถว DB แบบทนทาน) · `resolveRoute()` · `shouldTryFallback()` — ล้วนเป็นฟังก์ชันบริสุทธิ์                         |
| `run.ts`        | `runAiWith()` ตรรกะเรียก+retry+fallback+log (ไม่แตะ DB/SDK โดยตรง)                                                                       |
| `server.ts`     | ต่อสายจริง: cache settings, เขียน `ai_events`, รายการรุ่นจากผู้ให้บริการ, `testModel()`                                                  |
| `adapters/*.ts` | หนึ่งไฟล์ต่อ provider: แปลง `AiRequest` → SDK ของเจ้านั้น และแปลงคำตอบกลับ + `listModels()`                                              |
| `/admin/ai`     | หน้า admin: สถานะ, เลือก primary/fallback/รุ่นต่อ task, ปุ่มทดสอบ, เหตุการณ์ล่าสุด                                                       |

### 3.2 ชนิดข้อมูลกลาง (ย่อ)

```ts
export const PROVIDER_IDS = ["anthropic", "google"] as const;
export const TASK_KINDS = [
  "food_scan",
  "lab_extract",
  "chat",
  "agent",
  "safety" /* … */,
] as const;

export interface AiRequest {
  system?: string;
  history?: { role: "user" | "assistant"; text: string }[];
  prompt: string;
  images?: { mediaType: string; data: string /* base64 ไม่มี data: */ }[];
  documents?: { mediaType: string; data: string }[]; // PDF
  audio?: { mediaType: string; data: string }[]; // บาง provider เท่านั้น
  jsonSchema?: Record<string, unknown>; // adapter บังคับให้ตอบตาม schema
  maxTokens?: number;
}
export interface AiResponse {
  text: string;
  json?: unknown;
  provider: ProviderId;
  model: string;
  usage: { inputTokens: number; outputTokens: number };
}
export interface ProviderAdapter {
  id: ProviderId;
  call(req: AiRequest, model: string, apiKey: string): Promise<AiResponse>;
  listModels(apiKey: string): Promise<string[]>;
}
export class AiError extends Error {
  code: "not_configured" | "provider_failed" | "bad_output" | "unsupported";
}
```

### 3.3 ลำดับการตัดสิน (3 ชั้น) และ guard

```
ai_settings (ตารางแถวเดียว, admin แก้)  →  ค่าเริ่มต้นในโค้ด (registry.ts)
```

- แถว DB **ทุกช่องเป็น optional และถูก parse แบบทนทาน**: แถวเสีย/แก้ครึ่ง ๆ → ถอยเป็นค่าเริ่มต้น ไม่ทำให้ AI ล่ม (`parseAiSettings`)
- **อ่าน DB ไม่ได้ = ใช้ค่าที่รู้ล่าสุด** (หรือค่าเริ่มต้น) ไม่ throw
- **Guard "ตั้งไว้แต่ key หาย"**: ถ้า primary ที่ตั้งไม่มี API key → ใช้ fallback แทน → ถ้าไม่มีอีก ใช้ provider ใดก็ได้ที่มี key → ถ้าไม่มีเลย `AiError("not_configured")`; ทุกกรณีที่ข้าม primary จะ log `missing_api_key` (จำกัด 1 แถวต่อ cache window เพื่อไม่ให้ log ท่วม)
- **ชื่อรุ่น**: `models[provider][task]` (admin) ?? `PROVIDERS[provider].models[task]` (โค้ด); ตรวจรูปแบบ `^[A-Za-z0-9._:/-]{1,100}$`
- **cache 30 วินาที** ต่อ instance — เป็น "สัญญา" กับหน้า admin ("มีผลภายใน 1 นาที"); TTL สั้นกว่านี้ = DB read ทุก call, ยาวกว่านี้ = หลาย instance ไม่ตรงกันนาน; ไม่มี invalidate ข้าม instance (TTL คือตัวทำให้บรรจบ) · หน้า admin เรียก invalidate ก่อนแสดงเพื่อให้เห็นความจริง

### 3.4 `resolveRoute` (หัวใจ)

```ts
export function resolveRoute(task, settings, hasKey): Route | null {
  const base = TASK_ROUTES[task];
  const o = settings.routes[task];
  let primary = o?.primary ?? base.primary;
  const fb = o?.fallback === "none" ? null : (o?.fallback ?? base.fallback);
  let fallback = fb && fb !== primary ? fb : null;
  const model = (p) => settings.models[p]?.[task] ?? PROVIDERS[p].models[task];

  let primarySkipped = null;
  if (!hasKey(primary)) {
    primarySkipped = primary;
    if (fallback && hasKey(fallback)) {
      primary = fallback;
      fallback = null;
    } else {
      const other = Object.keys(PROVIDERS).find(
        (p) => p !== primary && hasKey(p),
      );
      if (!other) return null; // ไม่มี key เลย → not_configured
      primary = other;
      fallback = null;
    }
  } else if (fallback && !hasKey(fallback)) fallback = null;
  return {
    task,
    primary: { provider: primary, model: model(primary) },
    fallback: fallback ? { provider: fallback, model: model(fallback) } : null,
    primarySkipped,
  };
}
```

### 3.5 กติกา fallback และ retry

- **retry เจ้าเดิม 1 ครั้ง** (หน่วง ≈ 1.2 วินาที) เมื่อ `503` หรือ `429` — มักหายใน 1 วินาที
- **fallback 1 ครั้ง** เมื่อ `shouldTryFallback`: `429`, `5xx`, **`401/403`** (key ของเจ้าหลักตาย/ถูกเพิกถอน — จังหวะที่เจ้าที่สองช่วยให้แอปยังใช้ได้ และทุกการสลับถูก log จึงไม่ซ่อนปัญหา), network/timeout (`ETIMEDOUT|ECONNRESET|ENOTFOUND|fetch failed|overloaded`), และ `bad_output` (โมเดลไม่ตอบตาม schema)
- **ไม่ fallback** เมื่อ `4xx` อื่น (400/404/422): คำขอหรือชื่อรุ่นของเราผิด จะพังเหมือนกันบนอีกเจ้า
- ไม่เคย retry วนไม่จบ: primary (+retry) → fallback (+retry) → throw
- **log เฉพาะ `fallback` และ `error`** ลงตาราง `ai_events` (ไม่ log ครั้งสำเร็จ — มีหมื่นครั้งและไม่มีอะไรให้ดู; นับการใช้ทำที่โควตา) **ห้ามใส่ข้อความ prompt/คำตอบใน log** (เป็นข้อมูลสุขภาพ) เก็บแค่ provider, task, status, รหัส error (≤ 64), ข้อความสั้น ≤ 300
- **การเขียน log ล้มเหลวต้องไม่ทับ error จริง** (best-effort, try/catch)
- error ต่อผู้ใช้เป็นรหัส (`AiError.code`) ไม่โชว์ข้อความของ provider

### 3.6 ตาราง (Postgres/Supabase)

```sql
create table public.ai_settings (
  id boolean primary key default true check (id),          -- แถวเดียว
  route_overrides jsonb not null default '{}' check (jsonb_typeof(route_overrides) = 'object'),
  -- { "<task>": { "primary": "<provider>", "fallback": "<provider>|none" } }
  model_overrides jsonb not null default '{}' check (jsonb_typeof(model_overrides) = 'object'),
  -- { "<provider>": { "<task>": "<model id>" } }
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);
insert into public.ai_settings (id) values (true) on conflict do nothing;

create table public.ai_events (
  id bigint generated always as identity primary key,
  provider text not null, task text not null,
  status text not null check (status in ('fallback','error')),
  error_code text check (error_code is null or length(error_code) <= 64),
  message text check (message is null or length(message) <= 300),
  created_at timestamptz not null default now()
);
create index ai_events_created_idx on public.ai_events (created_at desc);

-- ทั้งสองตาราง: เปิด RLS + revoke ทุกสิทธิ์จาก anon/authenticated (อ่าน/เขียนผ่าน service role บน server หลัง requireAdmin เท่านั้น)
alter table public.ai_settings enable row level security;
alter table public.ai_events enable row level security;
revoke all on public.ai_settings, public.ai_events from anon, authenticated;
```

---

## 4. รายละเอียดเฉพาะของแต่ละ provider (บทเรียนที่ต้องรู้)

### 4.1 Anthropic Claude (`@anthropic-ai/sdk`)

- Key: `ANTHROPIC_API_KEY` · อ่านตอนเรียก ไม่ cache ในโค้ด → หมุน key ได้โดยไม่ต้อง deploy โค้ด
- รับ **รูปและ PDF** (content block `image` / `document` แบบ base64); **ไม่รับเสียง** → adapter throw `unsupported`
- **Structured output = บังคับเรียก tool**: ส่ง `tools=[{name:"record_result", input_schema: jsonSchema}]` + `tool_choice={type:"tool",name:"record_result"}` แล้วอ่าน `input` ของ `tool_use` เป็น JSON; ถ้าขอ JSON แต่ไม่มี tool_use → `AiError("bad_output")`
- ล็อก `baseURL: "https://api.anthropic.com"` (ดู §6 เรื่อง AI Gateway)
- `models.list()` ใช้ดึงรายการรุ่นจริง (pagination `limit:100`)

### 4.2 Google Gemini (`@google/genai`)

- Key: `GOOGLE_AI_API_KEY` · รับ **รูป PDF และเสียง** แบบ `inlineData`
- **Structured output** = `responseMimeType:"application/json"` + `responseJsonSchema`; parse ไม่ผ่าน → `bad_output`
- **Gemini 3 / Flash "คิด" ก่อนตอบ และนับ thinking token รวมใน `maxOutputTokens`** — วัดจริงแล้ว limit 1024 ถูกใช้คิดไป 873 เหลือคำตอบยาวถูกตัดเป็น JSON เสีย
  → ตั้ง `thinkingConfig.thinkingLevel = LOW` (รุ่น `^gemini-(3|flash)`) และ **เติม headroom +2048 token** บน `maxTokens` ที่ผู้เรียกขอ
- `listModels()` กรองเอาเฉพาะ `gemini*` ที่รองรับ `generateContent` และตัด TTS/image/embedding/live/audio/robotics/computer-use ออก
- ล็อก `baseUrl: "https://generativelanguage.googleapis.com/"`
- **free tier ใช้กับข้อมูลจริงไม่ได้** (ดู §6) — 429 ที่ข้อความมี `free_tier` ถูกแปลงเป็นรหัส `free_tier` เพื่อให้หน้า admin เตือน

### 4.3 ผลทดสอบกับ key จริง (7–11 ต.ค. 2026) — เอกสารกับ API จริงไม่ตรงกัน **API ชนะ**

| รุ่น                       | ผล                                           |
| -------------------------- | -------------------------------------------- |
| `gemini-3-flash-preview`   | ตอบทุกครั้ง ~1 วินาที → ใช้เป็น Flash หลัก   |
| `gemini-flash-lite-latest` | ตอบทุกครั้ง ~1 วินาที → ใช้งานเล็ก/เสียง     |
| `gemini-flash-latest`      | 503 "high demand" ต่อเนื่องหลายนาที → ไม่ใช้ |
| `gemini-3.1-flash-lite`    | ช้า (7–12 วินาที) และไม่เสถียร               |
| `gemini-2.5-flash`         | 404 (ปิดสำหรับผู้ใช้ใหม่)                    |

ข้อสรุป: id ที่ลงท้าย `-preview` อาจถูกถอนโดยไม่แจ้ง · alias `-latest` ตามรุ่นปัจจุบันจึงไม่เน่า แต่ **อาจ 503 ได้** — ทางออกไม่ใช่ปักรุ่นถาวร
แต่คือ **หน้า admin ที่เปลี่ยนรุ่นได้ทันที + fallback อัตโนมัติ** คุมช่องว่างระหว่างนั้น

---

## 5. หน้า admin `/admin/ai`

ต้องตอบได้ **จากหน้าจอ ไม่ใช่จากการอ่านโค้ด**: ตอนนี้ใช้เจ้าไหน รุ่นอะไร ใครแก้ล่าสุด · ถ้าเจ้าหลักล่มไปไหน · เมื่อวานมี fallback/error อะไร

| ส่วน                 | พฤติกรรม                                                                                                                                                                                                                                                   |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| สถานะ provider       | แต่ละเจ้า: มี key หรือยัง (ตรวจจาก env — **ไม่แสดงค่า key**) และ capability                                                                                                                                                                                |
| ตารางต่อ task        | เลือก primary / fallback (`none` = ปิด) และชื่อรุ่นต่อ provider; ว่าง = ใช้ค่าเริ่มต้นในโค้ด; แสดงเส้นทางที่ใช้จริงตอนนี้ (resolveRoute)                                                                                                                   |
| รายการรุ่น           | ดึงจาก API ของผู้ให้บริการ (cache 1 ชม.) ใช้เป็นตัวเลือก/ตรวจพิมพ์ผิด; ถ้าดึงไม่ได้ (ไม่มี key/ล่ม) แสดงว่าง ไม่พัง                                                                                                                                        |
| ปุ่ม "ทดสอบ"         | ส่งคำสั่งสั้น "Reply with the single word: OK" (maxTokens 128 — Gemini นับ thinking) ไปที่ provider+model นั้นตรง ๆ **ข้าม routing**, ไม่มีข้อมูลผู้ใช้; คืน ok/ms/รหัส error (แนบเหตุผลเช่น `API_KEY_INVALID` ที่กรองแล้ว ไม่คืนข้อความอิสระ)             |
| บันทึก               | `requireAdmin()` → ตรวจรูปแบบ → **provider ที่ไม่มี key เลือกเป็น primary/fallback ไม่ได้** (`err_ai_provider_no_key`) → UPDATE แถวเดียว **นับแถวที่โดน** (UPDATE ที่ไม่เจอแถวคือ "สำเร็จ" ใน PostgREST) → ล้าง cache → บันทึก audit `settings.ai_routing` |
| เหตุการณ์ล่าสุด      | 50 รายการ `ai_events` (fallback/error) + คำเตือนถ้า key เป็น free tier ใน 7 วันที่ผ่านมา                                                                                                                                                                   |
| คำสั่งเพิ่มของ admin | หน้าแยก `/admin/prompts`: admin **เพิ่ม**คำสั่งต่อ task ได้ ต่อท้ายใต้กฎในโค้ดพร้อมประโยคว่า "ห้ามแทนที่กฎข้างบน"; ผ่านตัวคัดกรองในโค้ด + AI reviewer ก่อนบันทึก; task ที่ปลอดภัย/ตัวรีวิวเองแก้ไม่ได้                                                     |
| "มีผลภายใน 1 นาที"   | เพราะ cache 30 วินาที — เขียนไว้บนหน้าจอเป็นสัญญา                                                                                                                                                                                                          |

---

## 6. ความเป็นส่วนตัวและความปลอดภัย (ข้อห้าม)

1. **ห้ามใช้ free tier ของ provider กับข้อมูลสุขภาพ/ข้อมูลส่วนบุคคลจริง** (เงื่อนไข free tier เปิดให้นำข้อมูลไปปรับปรุงบริการ) — ต้องเปิด billing ก่อนใช้กับผู้ใช้จริง; ระบบตรวจ 429 ที่มี `free_tier` แล้วเตือนใน admin
2. **ล็อก base URL ตรงไปที่ผู้ให้บริการ ทั้ง Anthropic และ Google** — SDK อ่านตัวแปร `ANTHROPIC_BASE_URL` / `GOOGLE_GEMINI_BASE_URL` เองเงียบ ๆ และ **Netlify AI Gateway ใส่ตัวแปรเหล่านี้ให้ function อัตโนมัติ** → คำขอไปที่ gateway ด้วย key ของเรา และพังด้วย "401 Unauthorized" แบบไม่บอกสาเหตุ (ข้อมูลสุขภาพจะผ่านบุคคลที่สามที่ไม่ได้ตกลงไว้) — แก้โดย pin `baseURL`/`baseUrl` ในตัวสร้าง client และมีเทสกันย้อนกลับ (`gateway.test.ts`)
3. API key อยู่ฝั่ง server เท่านั้น (`import "server-only"`; ไม่อยู่ใน `NEXT_PUBLIC_*`); ไม่ print ค่า key (บอกแค่ set/missing)
4. ไม่ส่งชื่อ/เลขบัตร/ข้อมูลระบุตัวตนไปกับ prompt เกินจำเป็น; การส่งข้อมูลไปผู้ให้บริการต่างประเทศอยู่ในรายการความยินยอม (PDPA ม.28)
5. AI **ไม่วินิจฉัย** — สรุป/อธิบาย/เตรียมคุยกับหมอ; ทุกคำตอบสุขภาพมี disclaimer; เคสเสี่ยง/ความมั่นใจต่ำส่งต่อคน; คำฉุกเฉินคัดด้วยคำสำคัญในโค้ดและไม่ถึงโมเดล; บันทึกบทสนทนาเพื่อ audit
6. คำตอบของโมเดลต้องผ่าน **ตัวตรวจฝั่งโค้ด** (schema, ห้ามข้อความต้องห้าม, ตัวเลขที่โค้ดตัดสิน) ไม่ว่าจะใช้โมเดลไหน — เปลี่ยนโมเดลแล้วความปลอดภัยต้องไม่ลดลง

---

## 7. การคุมต้นทุน

1. **ด่านโควตาด่านเดียวต่อ feature** (`checkAndConsume(userId, feature)`) ก่อนทุก `runAi` — แยกแพ็กเกจ + fair-use cap; ล้มเหลวแบบ fail-closed; นับครั้งแบบ atomic ใน SQL; **ถ้า AI ล้มเหลวให้คืนโควตา 1 หน่วย** (`refund_usage`)
2. งานที่ระบบเรียกเอง (เช่น ชุดไอเดียมื้อประจำสัปดาห์) เป็นต้นทุนของแพลตฟอร์ม 1 ครั้งต่อชุด ไม่ผ่านโควตาผู้ใช้ — เปิด/ปิดได้ที่หน้ากฎอัตโนมัติ
3. `usage.inputTokens/outputTokens` อยู่ใน `AiResponse` ทุกครั้ง → ใช้นับ token ต่อ task/แพ็กเกจ
4. เครื่องมือลดต้นทุนตามลำดับผลต่อต้นทุน: ย้ายงานเล็กไปรุ่นเล็ก/รุ่นถูก → prompt caching (วางส่วนคงที่ไว้ต้น: system prompt + guardrail + tool definition) → Batch API (ลด 50%) → ย่อรูป → ลดเพดานโควตา
5. มีสวิตช์ (feature flag) ปิดฟีเจอร์ AI ทันทีถ้าค่าใช้จ่ายพุ่ง
6. เปลี่ยนเส้นทางเพื่อลดต้นทุน (เช่น ย้ายแชต/แล็บไป Gemini Flash) **ต้องทดสอบคุณภาพ/ความปลอดภัยกับชุดคำถามเดียวกันและให้ผู้เชี่ยวชาญเทียบก่อน** แล้วค่อยเปลี่ยนที่หน้า admin (ไม่ต้อง deploy)

---

## 8. เริ่มใน project ใหม่ (checklist)

1. คัดลอกโครง `src/lib/ai/{types,registry,route,run,server}.ts` + `adapters/` — แก้ `TASK_KINDS` ให้ตรงงานของ project, แก้ `PROVIDERS[*].models` เป็นรุ่นที่ตรวจแล้ว, แก้ `TASK_ROUTES`
2. ติดตั้ง SDK: `@anthropic-ai/sdk`, `@google/genai` (ถ้าใช้) ตั้ง env: `ANTHROPIC_API_KEY`, `GOOGLE_AI_API_KEY` (ตั้งใน dashboard ของ host ไม่ commit)
3. สร้างตาราง `ai_settings` / `ai_events` (SQL §3.6) + RLS/revoke; ทำหน้า admin (สถานะ, ตาราง task, ปุ่มทดสอบ, เหตุการณ์) พร้อม `requireAdmin()` และ audit
4. pin base URL ทุก provider; ถ้า deploy บน Netlify ให้ตรวจว่า AI Gateway ไม่แทรกตัวแปร
5. ทุกจุดที่เรียก AI: ผ่านโควตาก่อน → `runAi(task, …)` → ตรวจผลด้วยโค้ด → ถ้าล้มเหลวคืนโควตา
6. เทสต์ (Vitest): `resolveRoute` (ไม่มี key, ตั้งผิด, fallback none), `shouldTryFallback`, `runAiWith` ด้วย adapter จำลอง (primary ล้ม→fallback, 4xx ไม่ fallback, retry 503 ครั้งเดียว, log ไม่มีข้อความ prompt), adapter แต่ละตัว (build params / parse response), เทสกัน gateway; **เทสต์ในระบบไม่เรียก AI จริง (เสียเงิน)**
7. ก่อนเปิดจริง: ตรวจว่า key เป็นแบบ **เสียเงิน** (billing on), ตรวจ consent เรื่องส่งข้อมูลไปต่างประเทศ, ทดสอบ 1 ครั้งต่อ task ผ่านปุ่ม "ทดสอบ" และผ่านฟีเจอร์จริงด้วยข้อมูลทดสอบ

### เพิ่ม provider ใหม่

1. เพิ่ม id ใน `PROVIDER_IDS`; 2. เขียน `adapters/<id>.ts` ให้ครบ `call` + `listModels` (จัดการ JSON schema, รูป/PDF/เสียง, ล็อก base URL, คืน usage); 3. เพิ่มใน `PROVIDERS` (envKey, capability, รุ่นต่อ task) และ `ADAPTERS`; 4. ปรับ `TASK_ROUTES` ที่ต้องการ; 5. เทสต์ adapter; หน้า admin รองรับอัตโนมัติ (วนจาก `PROVIDER_IDS`)

### เพิ่ม task ใหม่

1. เพิ่มใน `TASK_KINDS`; 2. ใส่รุ่นเริ่มต้นใน **ทุก** provider ใน registry และ route ใน `TASK_ROUTES` (TypeScript จะบังคับให้ครบ); 3. ถ้า admin ควรแต่ง prompt ได้ ใส่ใน `EDITABLE_TASKS`; 4. เทสต์

---

## 9. กับดักที่เจอจริง (สรุป)

| อาการ                                   | สาเหตุ                                                                              | แก้                                                                                      |
| --------------------------------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Gemini 401 "Unauthorized" บน Netlify    | AI Gateway ใส่ `GOOGLE_GEMINI_BASE_URL` ให้อัตโนมัติ SDK ส่งไป gateway ด้วย key เรา | pin base URL ตรงไปที่ผู้ให้บริการ                                                        |
| JSON ของ Gemini ขาดกลางคัน              | thinking token กิน `maxOutputTokens`                                                | `thinkingLevel: LOW` + เพิ่ม headroom 2048                                               |
| รุ่นที่เอกสารบอกว่ามีตอบ 404/503        | เอกสารกับ API จริงไม่ตรง; รุ่น `-preview` ถูกถอนได้                                 | ดึงรายการรุ่นจาก API, ปุ่มทดสอบก่อนบันทึก, fallback, เปลี่ยนรุ่นจาก admin ไม่ต้อง deploy |
| ตั้ง provider หลักไว้แต่ key ถูกถอด     | key หายจาก env ทีหลัง                                                               | guard ใน `resolveRoute` ใช้เจ้าอื่นที่มี key + log 1 แถวต่อ window                       |
| `ai_events` ท่วม                        | guard ยิงทุก call ตลอดเวลาที่ตั้งค่าผิด                                             | จำกัด 1 แถวต่อ key ต่อ cache window                                                      |
| บันทึกหน้า admin "สำเร็จ" แต่ไม่เปลี่ยน | UPDATE ที่ไม่เจอแถวไม่ error ใน PostgREST                                           | `.select("id")` แล้วเช็คจำนวนแถว = 1                                                     |
| ค่าที่ตั้งไม่มีผลทันที                  | cache ต่อ instance 30 วินาที                                                        | บอกผู้ใช้ "ภายใน 1 นาที"; หน้า admin invalidate ก่อนอ่าน                                 |
| 401 ตอนทดสอบแต่ไม่รู้สาเหตุ             | provider ส่งแค่รหัสเปล่า                                                            | ดึง `reason` (เช่น `API_KEY_INVALID`) จาก error body แบบกรองแล้วแสดงให้ admin            |
| ขายต่ำกว่าทุน                           | default เป็นรุ่นแพงสุด / เพดานโควตาสูง                                              | default รุ่นกลาง-เล็ก, วัดต้นทุนต่อครั้ง, fair-use cap                                   |

---

## 10. สิ่งที่ยังเป็นข้อเสนอ/ยังไม่ทำใน RooSuk

- ย้ายงานเล็กจาก Haiku 4.5 ไป Haiku 5.5 และใช้ prompt caching (ข้อเสนอ B ในเอกสารต้นทุน)
- ย้าย Ask AI / Agent / แล็บ / รายงานไป Gemini 3 Flash ถ้าแพทย์/เภสัชกรยอมรับคุณภาพ (ข้อเสนอ C: ลดต้นทุนมากที่สุดแต่แตะคุณภาพคำตอบ)
- Batch API สำหรับรายงานรายเดือน/แผนรายวัน, หน้า `/admin/ai-cost` ต้นทุนต่อ task, กฎเตือนเมื่อเฉลี่ย > 20 ฿/คน/สัปดาห์
