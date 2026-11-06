# Knowledge: การทำงานของระบบเมื่อกดปุ่ม Back (ปุ่มของเครื่อง และลิงก์ "กลับไป…") (จากระบบ RooSuk)

> อ้างอิงโค้ดจริง: `src/components/shell/AppShell.tsx` (แผ่น "เพิ่มเติม" กับ history) · `src/components/shell/BackLink.tsx`
> · `src/config/nav.ts` (`backTarget`, `PARENTS`, `FROM`) · `src/components/NavigationFeedback.tsx` · `e2e/shell.spec.ts`
> · `src/lib/use-form-action.ts` (ฟอร์มไม่ล้างค่าเมื่อ error) · master plan v0.25, v0.84, v0.87

---

## 1. ปัญหาที่แก้

1. **iPhone ที่ติดตั้งแอปเป็น PWA ไม่มีปุ่ม Back เลย** และ Safari บน iPhone ก็ไม่มีปุ่มบนจอ — ผู้ใช้ติดอยู่ในหน้าลึก ๆ ออกไม่ได้
2. บน Android ปุ่ม Back ของเครื่องทำงานกับ **history ของเบราว์เซอร์** — ถ้าแอปเปิดแผ่นเมนู/หน้าต่างโดยไม่บอก history
   กด Back แล้ว **ออกจากหน้าไปเลย** แทนที่จะปิดแผ่นเมนู (คนคาดว่า Back = ปิดสิ่งที่เพิ่งเปิด)
3. หน้าเดียวกันเข้าได้จากหลายที่ (เช่น ผลสแกน เปิดจากหน้าสแกน / Timeline / แจ้งเตือน / คลังเอกสาร) — "กลับไป" ต้องกลับไปที่ที่มาจริง

## 2. สรุปสั้น

1. **ทุกหน้าที่ไม่ใช่เมนู มีลิงก์ "กลับไป <ชื่อหน้าแม่>"** อยู่บนสุดของเนื้อหา (`BackLink` ใน `AppShell`) — ไม่พึ่งปุ่มของเครื่อง
2. หน้าแม่หาจาก **ตารางรูปแบบ path** (`PARENTS`) — เขียนครั้งเดียว ทุกหน้าได้อัตโนมัติ
3. หน้าที่เข้าได้หลายทาง: ลิงก์ที่พามาใส่ **`?from=<key>`** แล้ว `BackLink` กลับไปที่นั่น — key ต้องอยู่ใน whitelist (`FROM`) อย่างอื่นไม่สนใจ
4. **แผ่น "เพิ่มเติม" บนมือถือ จอง history 1 รายการตอนเปิด** → ปุ่ม Back ของเครื่อง = ปิดแผ่น (เหมือนกด ✕) และอยู่หน้าเดิม
5. ปิดแผ่นทางอื่น (✕ / พื้นหลัง / Esc) ก็ใช้ `history.back()` → history **ไม่สะสม**
6. กดลิงก์ในแผ่น: ถอยรายการของแผ่นก่อน **แล้วค่อย** ไปหน้าใหม่ → กด Back ครั้งเดียวกลับหน้าที่เปิดแผ่นไว้
7. การเปลี่ยนหน้า (รวมถึงตอนกด Back) มีตัวบอกกำลังโหลด (`NavigationFeedback`) และหน้าที่เปิดอยู่อ่านตัวเองใหม่เมื่อข้อมูลเปลี่ยน (`LiveSync`)

## 3. โครงที่ใช้

### 3.1 ลิงก์ "กลับไป…" (`BackLink`)

```ts
// src/config/nav.ts
const PARENTS: { pattern: RegExp; to: BackTarget }[] = [
  {
    pattern: /^\/scan\/(food|lab|body)(\/[^/]+)?$/,
    to: { href: "/scan", label: "navScan" },
  },
  {
    pattern: /^\/goals\/(new\/[^/]+|[^/]+)$/,
    to: { href: "/goals", label: "navGoals" },
  },
  { pattern: /^\/today\/checkin$/, to: { href: "/today", label: "navToday" } },
  // …
  { pattern: /^\/admin\/.+$/, to: { href: "/admin", label: "navAdmin" } }, // กว้างสุดไว้ท้าย
];
const FROM: Record<string, BackTarget> = {
  // ?from= ที่ยอมรับ
  timeline: { href: "/timeline", label: "navTimeline" },
  today: { href: "/today", label: "navToday" },
  notifications: { href: "/notifications", label: "navNotifications" },
  scan: { href: "/scan", label: "navScan" },
  vault: { href: "/vault", label: "navVault" },
};
export function backTarget(
  pathname: string,
  from?: string | null,
): BackTarget | null {
  const parent = PARENTS.find((r) => r.pattern.test(pathname))?.to;
  if (!parent) return null; // หน้าเมนูเอง: ไม่มีลิงก์กลับ
  const origin = from && Object.hasOwn(FROM, from) ? FROM[from] : undefined; // own keys only
  return origin && origin.href !== pathname ? origin : parent;
}
```

```tsx
// src/components/shell/BackLink.tsx (client)
const target = backTarget(
  pathname.replace(/^\/preview(?=\/)/, ""),
  useSearchParams().get("from"),
);
if (!target) return null;
return (
  <Link href={target.href} className="min-h-11 … …">
    <ChevronLeft />
    {fmt(t.backTo, { page: t[target.label] })}
  </Link>
);
```

ข้อสำคัญ:

- **ไม่ใช้ `history.back()` เป็นลิงก์กลับ** — ถ้าผู้ใช้เปิดหน้าจากลิงก์ LINE/แจ้งเตือนโดยตรง history ว่าง กดแล้วออกจากแอป
- `?from=` ไม่เคยเป็น URL — เป็น key ที่แมปไปหน้าของเราเท่านั้น (กัน open redirect); `Object.hasOwn` กัน `__proto__` / `constructor`
- ป้ายเป็น key ของพจนานุกรม → ตามภาษาและชื่อแอปที่แอดมินตั้ง
- เป้าแตะ ≥ 44px (`min-h-11`)
- หน้าเจ้าหน้าที่ลงลึกหลายชั้นใช้กฎเดียวกัน (เช่น หน้าสาขาของแอดมินกลับไป "สาขามียา", หน้าในศูนย์ร้านค้ากลับไปศูนย์ร้านค้า)

### 3.2 ปุ่ม Back ของเครื่องกับแผ่น "เพิ่มเติม"

```ts
const pushedRef = useRef(false);
const goAfterCloseRef = useRef<string | null>(null);

const openMore = () => {
  setOpenPath(pathname);
  if (!pushedRef.current) { window.history.pushState(null, "", window.location.href); pushedRef.current = true; }  // จอง 1 รายการ
};
const closeMore = () => { if (pushedRef.current) window.history.back(); else setOpenPath(null); };  // ✕ / พื้นหลัง / Esc

useEffect(() => {
  if (!moreOpen) { pushedRef.current = false; return; }       // ปิดเพราะออกจากหน้า: ครั้งหน้าต้องจองใหม่
  const onPop = () => {                                       // Back ของเครื่อง หรือ history.back() ของเราเอง
    pushedRef.current = false;
    setOpenPath(null);
    const href = goAfterCloseRef.current; goAfterCloseRef.current = null;
    if (href) router.push(href);                              // ลิงก์ที่กดในแผ่น: ไปหลังถอยรายการแล้ว
  };
  window.addEventListener("popstate", onPop);
  window.addEventListener("keydown", (e) => e.key === "Escape" && closeMore());
  …
}, [moreOpen, router]);

// ลิงก์ในแผ่น: ถอยรายการของแผ่นก่อน แล้วค่อยไป
const onSheetLinkClick = (e) => {
  const a = e.target.closest("a[href]");
  if (!a || !pushedRef.current) return;
  const href = a.getAttribute("href") ?? "";
  if (!href.startsWith("/") || a.target === "_blank" || e.metaKey || e.ctrlKey || e.shiftKey) return;   // ลิงก์นอก/แท็บใหม่: ปล่อยตามปกติ
  e.preventDefault(); goAfterCloseRef.current = href; window.history.back();
};
```

ลำดับ history ที่ได้:

```
เปิดหน้า A                → [A]
กด "เพิ่มเติม"            → [A, A*]          (* = รายการของแผ่น, URL เดิม)
กด Back ของเครื่อง        → [A]  แผ่นปิด อยู่หน้า A
— หรือ —
กดลิงก์ B ในแผ่น          → back() → [A] → push B → [A, B]
กด Back                   → [A]  (ไม่ต้องกดสองครั้ง)
```

state ของแผ่นผูกกับ path ที่เปิด (`openPath === pathname`) และลืมเมื่อ path เปลี่ยน (`seenPath`) — กลับมาหน้าเดิมแผ่นไม่เด้งขึ้นเอง

### 3.3 สิ่งที่เกี่ยวข้อง

- **ฟอร์มไม่ล้างค่าเมื่อ server ตอบ error** (`useFormAction` ใน `src/lib/use-form-action.ts` แทน reset อัตโนมัติของ `<form action>`) — แก้ช่องเดียวแล้วส่งใหม่ได้
- **สำเร็จแล้วค่อยล้าง** (เช่น ฟอร์มเปลี่ยนรหัสผ่าน remount ด้วย `key={saved}`)
- server action ที่เปลี่ยนสถานะแล้ว redirect (POST → redirect → GET) — Back ไม่ส่งฟอร์มซ้ำ
- หน้าที่ต้องการให้กลับไปที่เดิมหลังทำเสร็จใช้ `?from=` หรือ path ที่ระบุ (`safeBack()` ตรวจ regex ว่าเป็นหน้าของเราเท่านั้น)

## 4. กฎที่ห้ามละเมิด

1. ทุกหน้าใหม่ที่อยู่ลึกกว่าเมนู ต้องมีรูปแบบใน `PARENTS` (ไม่งั้นไม่มีลิงก์กลับบน iPhone PWA)
2. `?from=` ต้องเป็น key ใน whitelist — ห้ามรับ URL ใด ๆ มาเป็นปลายทาง
3. สิ่งที่ลอยทับหน้า (แผ่นเมนู, dialog เต็มจอ) ที่ผู้ใช้คาดว่า Back จะปิด ต้องจอง history หนึ่งรายการ และปิดทุกทางด้วย `history.back()`
4. ห้าม `pushState` ซ้ำเมื่อจองไว้แล้ว (ref กัน) — ไม่งั้นต้องกด Back หลายครั้ง
5. ลิงก์ภายนอก / เปิดแท็บใหม่ / กดพร้อม Ctrl/⌘/Shift ต้องทำงานตามปกติของเบราว์เซอร์

## 5. บทเรียนจากของจริง

| เกิดอะไร                                              | สาเหตุราก                               | แก้อย่างไร                                |
| ----------------------------------------------------- | --------------------------------------- | ----------------------------------------- |
| ผู้ใช้ iPhone (PWA) ติดอยู่ในหน้าลึก ๆ ออกไม่ได้      | ไม่มีปุ่ม Back ในโหมดแอป                | `BackLink` ทุกหน้าลึก                     |
| ลิงก์กลับพาไปหน้าแม่ตายตัว ทั้งที่เปิดมาจากแจ้งเตือน  | หน้าแม่ตายตัว                           | `?from=` + whitelist                      |
| Android: กด Back ตอนแผ่นเมนูเปิด แล้วออกจากหน้า       | แผ่นเป็นแค่ state ไม่อยู่ใน history     | จอง history 1 รายการ + `popstate` ปิดแผ่น |
| หลังกดลิงก์ในแผ่น ต้องกด Back สองครั้งถึงกลับหน้าเดิม | รายการของแผ่นค้างอยู่ใน history         | ถอยรายการก่อน แล้วค่อย `router.push`      |
| แผ่นเมนูเด้งขึ้นเองเมื่อกลับมาหน้าเดิม                | state "เปิด" ไม่ถูกล้างเมื่อเปลี่ยนหน้า | ผูกกับ path + ลืมเมื่อ path เปลี่ยน       |
| ฟอร์มถูกล้างทั้งหมดเมื่อ server ตอบ error             | form reset หลังทุก submit               | ล้างเฉพาะเมื่อสำเร็จ                      |

## 6. ลอกไปใช้อย่างไร

1. `PARENTS` (รูปแบบ path → หน้าแม่, เรียงจากเฉพาะไปกว้าง) + `FROM` whitelist + `backTarget()` (pure, เทสได้)
2. `BackLink` วางครั้งเดียวในโครงหลักเหนือ `{children}`
3. ทุกลิงก์ที่พาไปหน้าที่เข้าได้หลายทาง ใส่ `?from=<key>`
4. แผ่นเมนู/overlay: `pushState` ตอนเปิด (ครั้งเดียว), ปิดด้วย `history.back()`, ฟัง `popstate`, ลิงก์ในแผ่นถอยก่อนไป
5. เทส Playwright (มือถือ): Back ของเครื่องปิดแผ่นและอยู่หน้าเดิม · กดลิงก์ในแผ่นแล้ว Back ครั้งเดียวกลับมา · Esc ปิด · เทส unit ของ `backTarget` (ไม่มีหน้าแม่, `from` แปลก, `__proto__`, `from` ชี้หน้าตัวเอง)
