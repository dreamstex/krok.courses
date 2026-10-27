import { cookies } from "next/headers";
import type { Locale } from "./i18n";

export async function getLocale(): Promise<Locale> {
  const value = (await cookies()).get("krok-locale")?.value;
  return value === "be" ? "be" : "ru";
}
