import type { NextRequest } from "next/server";
import { serveBrandImage } from "@/lib/brand/serve";

export const dynamic = "force-dynamic";
export const GET = (req: NextRequest) => serveBrandImage(req, "favicon");
