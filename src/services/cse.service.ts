import type { PricesResponse } from "@/types";

export const cseService = {
  async quotes(symbols: string[]): Promise<PricesResponse> {
    const res = await fetch("/api/cse/prices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbols }),
      cache: "no-store",
    });
    const data = (await res.json().catch(() => null)) as (PricesResponse & { error?: string }) | null;
    if (!res.ok) throw new Error(data?.error ?? "Could not fetch CSE prices.");
    return data as PricesResponse;
  },
};