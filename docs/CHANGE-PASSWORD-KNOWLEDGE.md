# Knowledge: การเปลี่ยนรหัสผ่าน (และรหัสผ่านแรกที่แอดมินตั้งให้) (จากระบบ RooSuk)

> อ้างอิงโค้ดจริง: `src/app/actions/auth.ts` (`changePasswordAction`) · `src/lib/auth/utils.ts` (`passwordChangeProblem`, `canChangePassword`, `mapAuthError`, schema)
> · `src/app/(app)/settings/{page.tsx,ChangePasswordForm.tsx}` · `src/components/PasswordField.tsx`
> · รหัสผ่านแรกของผู้ดูแลสาขา: `src/app/actions/branches.ts` (`createBranchManagerAction`, `resetBranchManagerPasswordAction`),
> `branch_managers.must_change_password`, `src/config/nav.ts` (`navSetFor(role, mustChangePassword)`) · Supabase Auth (GoTrue)

---

## 1. ปัญหาที่แก้

- ผู้ใช้ต้องเปลี่ยนรหัสผ่านเองได้ — แต่คนที่ **แอบเปิดเครื่องที่ล็อกอินค้างไว้** ต้องเปลี่ยนไม่ได้ และถ้ารหัสรั่ว เครื่องอื่นต้องหลุดออก
- เจ้าหน้าที่ที่แอดมินสร้างบัญชีให้ (มีรหัสผ่านแรกที่แอดมินรู้) ต้อง **ถูกบังคับเปลี่ยนก่อนทำงาน**
- บัญชีที่เข้าด้วย LINE / Google / SSO **ไม่มีรหัสผ่าน** — ต้องไม่โชว์ฟอร์มที่ใช้ไม่ได้

## 2. สรุปสั้น

1. ฟอร์มสามช่อง: **รหัสปัจจุบัน · รหัสใหม่ · ยืนยันรหัสใหม่** ทุกช่องกดดูสิ่งที่พิมพ์ได้ (`PasswordField`)
2. ตรวจในโค้ดก่อนถามเซิร์ฟเวอร์ (`passwordChangeProblem`): ช่องปัจจุบันว่าง · ใหม่สั้นกว่า 8 หรือยาวเกิน 72 · ใหม่สองช่องไม่ตรง · ใหม่ = ปัจจุบัน
3. **พิสูจน์รหัสปัจจุบันด้วยการ sign-in ซ้ำ** (`signInWithPassword`) — ได้ทั้งการยืนยันตัวตน และทำให้ session "สดใหม่" ตามที่ Supabase ต้องการ
4. `updateUser({ password })` → **ออกจากระบบทุกเครื่องอื่น** (`signOut({ scope: "others" })`) เครื่องนี้ยังอยู่
5. ล้างธง `must_change_password` (ถ้าเป็นผู้ดูแลสาขา) → เมนูเปิดเต็ม; `revalidatePath("/", "layout")`
6. `audit("auth.password_change")` + **แจ้งเจ้าของบัญชี** ในแอปและ LINE ("รหัสผ่านถูกเปลี่ยน" — ถ้าไม่ได้ทำเองจะรู้ทันที)
7. ฟอร์มแสดงเฉพาะบัญชีที่มีอีเมลจริงและ identity แบบ email (`canChangePassword`)
8. ผลเป็นรหัส error (`err_password_current_wrong`, `err_password_mismatch`, `err_password_same`, `err_weak_password`, …) แปลตามภาษาบนหน้าจอ

## 3. โครงที่ใช้

### 3.1 กฎรหัสผ่าน

```ts
// 72: bcrypt (ที่ GoTrue ใช้) ไม่สนไบต์ที่เกิน 72 — รหัสยาวกว่านั้นจะ "ดูเหมือน" ปลอดภัยแต่ส่วนเกินไม่มีผล
const newPassword = z.string().min(8).max(72);

export function passwordChangeProblem(
  current: string,
  next: string,
  confirm: string,
): ErrorKey | null {
  if (!current) return "err_invalid_input";
  if (!newPassword.safeParse(next).success) return "err_weak_password";
  if (next !== confirm) return "err_password_mismatch";
  if (next === current) return "err_password_same";
  return null;
}

/** อีเมลจริง (ไม่ใช่ .invalid ที่สร้างให้บัญชี LINE/SSO) และมี identity แบบ email */
export function canChangePassword(user) {
  if (!user.email || user.email.endsWith(".invalid")) return false;
  return (user.identities ?? []).some((i) => i.provider === "email");
}
```

แนะนำตั้งความยาวขั้นต่ำที่ Supabase Auth ให้ตรงกับโค้ด (ฝั่งที่เข้มกว่าจะชนะ และ error ของ auth ถูกแปลงด้วย `mapAuthError` อยู่แล้ว)

### 3.2 action

```ts
export async function changePasswordAction(_prev: PasswordState, formData: FormData): Promise<PasswordState> {
  const user = await getCurrentUser();
  if (!user) return { error: "err_not_signed_in" };
  if (!canChangePassword(user) || !user.email) return { error: "err_password_unavailable" };
  const problem = passwordChangeProblem(current, next, confirm);
  if (problem) return { error: problem };

  const supabase = await createClient();
  const { error: wrong } = await supabase.auth.signInWithPassword({ email: user.email, password: current });
  if (wrong) return { error: wrong.code === "invalid_credentials" ? "err_password_current_wrong" : mapAuthError(wrong) };

  const { error } = await supabase.auth.updateUser({ password: next });
  if (error) return { error: mapAuthError(error) };

  // เครื่องอื่นต้องเข้าใหม่; ล้มตรงนี้ต้องไม่ซ่อนว่าเปลี่ยนสำเร็จแล้ว → แค่ log
  const { error: others } = await supabase.auth.signOut({ scope: "others" });
  if (others) console.error(...);
  await admin.from("branch_managers").update({ must_change_password: false }).eq("user_id", user.id);   // ไม่มีแถว = ไม่เป็นไร
  revalidatePath("/", "layout");
  await audit({ by: user.id, action: "auth.password_change", entity: "auth", entityId: user.id });
  await tell(user.id, (t) => passwordChangedNotice(t));
  return { saved: Date.now() };
}
```

ลำดับสำคัญ: ตรวจในโค้ด → พิสูจน์รหัสเดิม → เปลี่ยน → ตัดเครื่องอื่น → ล้างธง → audit → แจ้ง
ขั้นหลังจากเปลี่ยนสำเร็จ **ห้ามทำให้ผลลัพธ์กลายเป็น error** (รหัสเปลี่ยนไปแล้วจริง)

### 3.3 ฟอร์ม

- `useActionState` + `SubmitButton` (spinner, disabled ระหว่างทำงาน — กดซ้ำไม่ได้)
- `autoComplete="current-password"` / `"new-password"` (ตัวจัดการรหัสผ่านของเครื่องเสนอรหัสแข็งแรงและบันทึกให้ถูกช่อง), `minLength={8}`
- **ค่าในช่องไม่ถูกล้างเมื่อ error** (แก้ช่องเดียวแล้วส่งใหม่ได้) แต่ **ล้างเมื่อสำเร็จ**: กล่องช่องกรอก `key={state.saved ?? 0}` → remount
- ข้อความสำเร็จบอกด้วยว่าเครื่องอื่นถูกออกจากระบบแล้ว ("เปลี่ยนรหัสผ่านแล้ว … (อุปกรณ์อื่นถูกออกจากระบบ)")

### 3.4 รหัสผ่านแรกของเจ้าหน้าที่ (`must_change_password`)

1. แอดมินสร้างผู้ดูแลสาขาด้วยอีเมล + รหัสผ่านแรก (8–72, `initialPasswordOk`) — บัญชีสร้างด้วย `auth.admin.createUser({ email_confirm: true })`
2. `branch_managers.must_change_password = true`
3. ทุกหน้าที่เป็นหน้าแรกพาไป `/settings?first=1` (ข้อความอธิบายว่าต้องตั้งรหัสของตัวเองก่อน) และ `navSetFor(role, true)` ให้เมนูแค่ "ตั้งค่า"
   route ที่ส่งออกข้อมูลก็ตรวจธงนี้ (ยังไม่เปลี่ยนรหัส = ยังไม่ได้สิทธิ์ผู้ดูแลสาขา)
4. เปลี่ยนรหัสสำเร็จ → ธงเป็น `false` → เมนูเปิดเต็ม
5. ลืมรหัส: แอดมิน "ตั้งรหัสผ่านแรกใหม่" (`resetBranchManagerPasswordAction`) → ธงกลับเป็น `true` อีกครั้ง; audit + แจ้ง

### 3.5 สิ่งที่ยังไม่มีใน RooSuk (ควรทำในระบบใหม่)

- **"ลืมรหัสผ่าน" ด้วยอีเมล** (`resetPasswordForEmail` → ลิงก์ → หน้าตั้งรหัสใหม่) — RooSuk ผู้ใช้ส่วนใหญ่เข้าด้วย LINE/Google/SSO
  และเจ้าหน้าที่ให้แอดมินรีเซ็ต จึงยังไม่ได้ทำ ถ้าทำ: ตอบข้อความเดียวกันไม่ว่าอีเมลมีหรือไม่ (ไม่เปิดเผยว่ามีบัญชี), จำกัดอัตรา, ลิงก์อายุสั้น, หลังตั้งใหม่ตัดทุกเครื่อง
- ตรวจรหัสที่เคยรั่ว (HaveIBeenPwned k-anonymity) — เปิดได้ในตั้งค่า Supabase Auth แผนที่รองรับ

## 4. กฎที่ห้ามละเมิด

1. ต้องพิสูจน์รหัสปัจจุบันก่อนเปลี่ยน (session ที่เปิดค้างไม่พอ)
2. หลังเปลี่ยน ตัดเครื่องอื่นทั้งหมด และแจ้งเจ้าของบัญชี
3. ห้าม log/audit รหัสผ่านหรือส่วนใดของมัน (`cleanDetail` ทิ้ง key ที่มีคำว่า password อยู่แล้ว)
4. ห้ามโชว์ฟอร์มกับบัญชีที่ไม่มีรหัสผ่าน
5. ความยาวสูงสุด 72 ให้ตรงกับ bcrypt
6. รหัสผ่านที่คนอื่นตั้งให้ต้องถูกบังคับเปลี่ยนก่อนใช้สิทธิ์ใด ๆ

## 5. บทเรียนจากของจริง

| เกิดอะไร                                                  | สาเหตุราก                                                    | แก้อย่างไร                                                     |
| --------------------------------------------------------- | ------------------------------------------------------------ | -------------------------------------------------------------- |
| `updateUser` ตอบว่าต้องยืนยันตัวตนใหม่ (reauthentication) | Supabase ต้องการ session ที่เพิ่งล็อกอินสำหรับการเปลี่ยนรหัส | sign-in ซ้ำด้วยรหัสปัจจุบันก่อน — ได้ทั้งการตรวจและ session สด |
| ผู้ใช้ LINE เห็นฟอร์มเปลี่ยนรหัส กดแล้ว error             | ไม่ได้ตรวจว่าบัญชีมีรหัสผ่าน                                 | `canChangePassword` ซ่อนฟอร์ม                                  |
| ฟอร์มถูกล้างทั้งหมดเมื่อพิมพ์รหัสยืนยันผิด                | reset หลังทุก submit                                         | ล้างเฉพาะเมื่อสำเร็จ (`key={saved}`)                           |
| ผู้ดูแลสาขาใช้รหัสที่แอดมินตั้งต่อไปเรื่อย ๆ              | ไม่มีอะไรบังคับ                                              | `must_change_password` + เมนูเหลือแค่ตั้งค่า                   |

## 6. ลอกไปใช้อย่างไร

1. schema รหัส (8–72) + `passwordChangeProblem` + `canChangePassword` + `mapAuthError` (แปลง error ของ auth เป็นรหัสของเรา)
2. action ตามลำดับ §3.2 + audit + แจ้งเตือน
3. ฟอร์มสามช่องพร้อมปุ่มดูรหัส, autocomplete ถูกต้อง, spinner, ล้างเมื่อสำเร็จ
4. ถ้ามีบัญชีที่ผู้อื่นสร้างให้: ธง "ต้องเปลี่ยนรหัส" + เมนูจำกัด + การรีเซ็ตโดยแอดมิน
5. (แนะนำ) ลืมรหัสผ่านด้วยอีเมลตาม §3.5
6. เทส: `passwordChangeProblem` ทุกกรณี, `canChangePassword` (`.invalid`, ไม่มี email identity), live: เปลี่ยนรหัสแล้วเครื่องอื่นหลุด / รหัสเดิมผิดได้ `err_password_current_wrong`
