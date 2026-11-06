// Shared by server and client components (kept out of the "use client" Buttons file so server code can call it).
const base =
  "pressable inline-flex min-h-11 items-center justify-center gap-2 rounded-control px-5 text-[15px] font-bold transition disabled:cursor-not-allowed disabled:opacity-60";
const variants = {
  primary: "bg-primary text-white shadow-[0_8px_16px_-8px_rgb(21_87_224/0.6)] hover:bg-primary-hover",
  gold: "bg-gold text-ink hover:brightness-95",
  ghost: "border-[1.5px] border-sky-line bg-surface text-primary hover:bg-sky",
  danger: "bg-danger text-white hover:brightness-95",
} as const;
export type Variant = keyof typeof variants;
export const btnClass = (v: Variant = "primary", extra = "") => `${base} ${variants[v]} ${extra}`;
