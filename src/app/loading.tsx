import { Spinner } from "@/components/Spinner";

/** Shown while any page is loading, so a slow navigation never looks frozen. */
export default function Loading() {
  return (
    <div className="grid min-h-[40dvh] place-items-center text-primary" role="status" aria-live="polite">
      <Spinner size={36} />
    </div>
  );
}
