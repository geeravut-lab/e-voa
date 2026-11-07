import { requireAdminPage } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createDiscountAction, setDiscountActiveAction } from "@/app/actions/admin";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/Buttons";
import { PageHead } from "@/components/PageHead";
import { inputCls } from "@/components/inputStyles";

export const dynamic = "force-dynamic";

export default async function AdminDiscounts() {
  await requireAdminPage("finance");
  const { t } = await getT();
  const db = createAdminClient();
  const [{ data: codes }, { data: reds }] = await Promise.all([
    db.from("discount_codes").select("id, code, kind, value, active, valid_from, valid_to, max_uses, per_user, note, created_at").order("created_at", { ascending: false }).limit(200),
    db.from("discount_redemptions").select("code_id, amount_thb, payments(status)").limit(10000),
  ]);
  const uses = new Map<string, number>(), given = new Map<string, number>();
  for (const r of reds ?? []) { uses.set(r.code_id, (uses.get(r.code_id) ?? 0) + 1); const st = (r.payments as unknown as { status?: string } | null)?.status; if (st === "paid" || st === "partially_refunded") given.set(r.code_id, (given.get(r.code_id) ?? 0) + r.amount_thb); }
  const day = (v: string | null) => (v ? v.slice(0, 10) : "–");
  const field = (name: string, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => <label className="block space-y-1"><span className="text-sm font-semibold">{label}</span><input name={name} className={inputCls} {...props} /></label>;
  return (
    <div className="space-y-4">
      <PageHead title={t.admin_discounts_title} hint={t.admin_discounts_hint} art="fees" tone="gold" />
      <ActionForm action={createDiscountAction} className="space-y-3 rounded-card border border-line bg-surface p-5 shadow-card">
        <h2 className="font-display text-lg font-bold">{t.discounts_new}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {field("code", t.discounts_code, { required: true, maxLength: 32, autoCapitalize: "characters", autoComplete: "off", className: `${inputCls} font-mono` })}
          <label className="block space-y-1"><span className="text-sm font-semibold">{t.discounts_kind}</span><select name="kind" className={inputCls}><option value="percent">{t.discounts_percent}</option><option value="fixed">{t.discounts_fixed}</option></select></label>
          {field("value", t.discounts_value, { type: "number", min: 1, required: true, inputMode: "numeric" })}
          {field("per_user", t.discounts_per_user, { type: "number", min: 1, defaultValue: 1 })}
          {field("valid_from", t.discounts_from, { type: "date" })}{field("valid_to", t.discounts_to, { type: "date" })}
          {field("max_uses", t.discounts_max, { type: "number", min: 1 })}{field("note", t.discounts_note, { maxLength: 200 })}
        </div>
        <p className="text-xs text-muted">{t.discounts_rule}</p>
        <SubmitButton>{t.discounts_create}</SubmitButton>
      </ActionForm>
      <section className="space-y-3 rounded-card border border-line bg-surface p-5 shadow-card">
        <h2 className="font-display text-lg font-bold">{t.discounts_list}</h2>
        {(codes ?? []).length === 0 ? <p className="text-muted">{t.discounts_none}</p> : (
          <ul className="divide-y divide-line">
            {codes!.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                <div className="min-w-0 space-y-0.5">
                  <p className="flex flex-wrap items-center gap-2"><b className="font-mono text-base">{c.code}</b><span className={`rounded-full px-2 py-0.5 text-xs font-bold ${c.active ? "bg-mint text-teal-deep" : "bg-line text-muted"}`}>{c.active ? t.discounts_on : t.discounts_off}</span></p>
                  <p className="tabular text-muted">{c.kind === "percent" ? `${c.value}%` : `THB ${c.value}`} · {day(c.valid_from)} → {day(c.valid_to)} · {c.per_user}/{t.discounts_per_user.toLowerCase()}{c.max_uses ? ` · max ${c.max_uses}` : ""}</p>
                  <p className="tabular">{uses.get(c.id) ?? 0} {t.discounts_uses} · {t.discounts_given} THB {(given.get(c.id) ?? 0).toLocaleString("en-US")}{c.note ? ` · ${c.note}` : ""}</p>
                </div>
                <ActionForm action={setDiscountActiveAction.bind(null, c.id, !c.active)} className=""><SubmitButton variant="ghost">{c.active ? t.discounts_turn_off : t.discounts_turn_on}</SubmitButton></ActionForm>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
