import type { Dict } from "@/lib/i18n/dict";
import type { AppStatus } from "@/lib/applications/state";

const TONE: Record<AppStatus, string> = {
  draft: "bg-sky text-primary", awaiting_payment: "bg-gold-soft text-gold-deep", expired: "bg-sand text-muted", paid: "bg-mint text-teal-deep", pre_check: "bg-mint text-teal-deep",
  action_required: "bg-gold-soft text-gold-deep", submitted: "bg-sky text-primary", submission_failed: "bg-rose text-danger", under_review: "bg-sky text-primary",
  approved: "bg-mint text-success", rejected: "bg-rose text-danger", cancelled: "bg-sand text-muted", used: "bg-sand text-muted", no_show: "bg-sand text-muted",
};
export const statusLabel = (t: Dict, s: string) => (t as unknown as Record<string, string>)[`st_${s}`] ?? s;
export const statusHint = (t: Dict, s: string) => (t as unknown as Record<string, string>)[`sth_${s}`] ?? "";

export function StatusBadge({ status, t }: { status: string; t: Dict }) {
  return <span className={`inline-block rounded-full px-3 py-1 text-xs font-extrabold ${TONE[status as AppStatus] ?? "bg-sand text-muted"}`}>{statusLabel(t, status)}</span>;
}
