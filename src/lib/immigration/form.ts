import { z } from "zod";

/** The Immigration fields that are not already columns of travelers / trips. Stored in applications.form. */
export const ApplicationForm = z.object({
  residency_id: z.number().int(),
  passport_type_id: z.number().int().default(1),
  permanent_address: z.string().min(1).max(100),
  state: z.string().min(1).max(100),
  yearly_income_id: z.number().int(),
  occupation_id: z.number().int(),
  isd_code: z.string().min(1).max(9),
  mobile: z.string().min(3).max(12),
  email: z.string().min(3).max(80),
  first_time_traveller: z.union([z.literal(0), z.literal(1)]).default(1),
  length_of_stay: z.number().int().min(1).max(99).optional(),
  stay: z.object({
    place_of_stay_id: z.number().int(),
    name: z.string().min(1).max(50),
    city_id: z.number().int(),
    district_id: z.number().int(),
    sub_district_id: z.number().int(),
    pin_code: z.string().min(1).max(10),
    street: z.string().min(1).max(100),
    reference: z.string().min(1).max(50),
  }),
});
export type ApplicationForm = z.infer<typeof ApplicationForm>;

/** Days between two yyyy-mm-dd dates, at least 1. */
export function stayDays(arrival: string, departure: string | null | undefined): number | null {
  if (!departure) return null;
  const d = Math.round((Date.parse(departure) - Date.parse(arrival)) / 86_400_000);
  return Number.isFinite(d) ? Math.min(Math.max(d, 1), 99) : null;
}
