import { requireUser } from "@/lib/auth";
import { requireFeaturePage } from "@/lib/flags";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { markAllRead } from "@/app/actions/account";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/Buttons";
import { PageHead } from "@/components/PageHead";
import { NotificationRow } from "@/components/NotificationRow";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  await requireFeaturePage("notifications");
  await requireUser("/notifications");
  const { t, lang } = await getT();
  const { data } = await (await createClient()).from("app_notifications").select("id, title, body, link, read_at, created_at").order("created_at", { ascending: false }).limit(50);
  const fmtDate = new Intl.DateTimeFormat(lang, { dateStyle: "medium", timeStyle: "short" });
  const rows = data ?? [];
  const unread = rows.filter((r) => !r.read_at).length;
  return (
    <div>
      <PageHead title={t.notif_title} art="notifications" tone="sand" />
      {unread > 0 && (
        <ActionForm action={markAllRead} className="mb-3">
          <SubmitButton variant="ghost">{t.notif_mark_all}</SubmitButton>
        </ActionForm>
      )}
      {rows.length === 0 ? (
        <p className="rounded-card border border-line bg-surface p-5 text-muted">{t.notif_empty}</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((n) => {
            const body = (
              <>
                <div className="flex items-start gap-3">
                  {!n.read_at && <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-lotus" aria-label="unread" />}
                  <div className="min-w-0">
                    <p className="font-bold">{n.title}</p>
                    {n.body && <p className="text-sm text-muted">{n.body}</p>}
                    <p className="mt-1 text-xs text-muted tabular">{fmtDate.format(new Date(n.created_at))}</p>
                  </div>
                </div>
              </>
            );
            return (
              <li key={n.id} className={`rounded-card border border-line p-4 shadow-card ${n.read_at ? "bg-surface" : "bg-sky"}`}>
                <NotificationRow id={n.id} link={n.link?.startsWith("/") && !n.link.startsWith("//") ? n.link : null} unread={!n.read_at}>{body}</NotificationRow>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
