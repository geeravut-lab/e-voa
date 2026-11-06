import { ART, type ArtName } from "./Art";

export function PageHead({ title, hint, art, tone = "sky" }: { title: string; hint?: string; art?: ArtName; tone?: "gold" | "sky" | "mint" | "rose" | "sand" }) {
  return (
    <header className={`tone-${tone} relative mb-5 flex min-h-28 items-center overflow-hidden rounded-card border p-5 shadow-card`}>
      <div className="relative z-[1] max-w-[62%]">
        <h1 className="font-display text-2xl font-extrabold">{title}</h1>
        {hint && <p className="mt-1 text-sm text-muted">{hint}</p>}
      </div>
      {art && <div className="pointer-events-none absolute -bottom-1 -right-1 top-1 w-[40%]">{ART[art]}</div>}
    </header>
  );
}
