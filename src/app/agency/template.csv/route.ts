import { NextResponse } from "next/server";
import { CSV_TEMPLATE } from "@/lib/agency/csv";

export const dynamic = "force-static";
export function GET() { return new NextResponse(CSV_TEMPLATE, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="travelers-template.csv"' } }); }
