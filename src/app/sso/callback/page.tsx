import { Suspense } from "react";
import { SsoCallback } from "./SsoCallback";
import { Spinner } from "@/components/Spinner";

export default function Page() {
  return (
    <Suspense fallback={<div className="grid min-h-[40dvh] place-items-center text-primary"><Spinner size={36} /></div>}>
      <SsoCallback />
    </Suspense>
  );
}
