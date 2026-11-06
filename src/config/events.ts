/** Usage events. The list lives in code so a typo fails to compile instead of creating a new event. */
export const EVENTS = ["active", "login", "apply_start", "apply_submit", "language_change"] as const;
export type EventName = (typeof EVENTS)[number];
