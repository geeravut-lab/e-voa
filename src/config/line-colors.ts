// LINE Flex Messages take colors as hex strings (not CSS variables), so this is the one place they live (allowed by scripts/check-no-hex.mjs).
// Every header color keeps white text readable (contrast of at least 4.5:1).
export type NoticeStyle = "info" | "success" | "warning" | "danger" | "money" | "refund" | "extra" | "staff";
export const NOTICE_STYLES: Record<NoticeStyle, { color: string; emoji: string }> = {
  info: { color: "#1557E0", emoji: "ℹ️" },        // blue: a plain update
  success: { color: "#14833B", emoji: "✅" },     // green: approved, done, ready
  warning: { color: "#B45309", emoji: "⏰" },     // amber: needs you / a deadline
  danger: { color: "#C0262D", emoji: "❌" },      // red: rejected, failed
  money: { color: "#0E7C66", emoji: "💳" },       // teal: a payment
  refund: { color: "#6D28D9", emoji: "↩️" },      // purple: money coming back
  extra: { color: "#A21CAF", emoji: "🎁" },       // magenta: add-ons and partners
  staff: { color: "#0B2545", emoji: "🛎️" },       // navy: back-office
};
export const LINE_TEXT = { muted: "#6B7280", ink: "#111827", white: "#FFFFFF", line: "#E5E7EB" };
