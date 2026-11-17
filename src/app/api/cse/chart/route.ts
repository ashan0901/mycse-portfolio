import { NextResponse } from "next/server";

const CSE_BASE = "https://www.cse.lk/api";
const CSE_HEADERS = {
  "Content-Type": "application/x-www-form-urlencoded",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  Origin: "https://www.cse.lk",
  Referer: "https://www.cse.lk/",
  Accept: "application/json, text/plain, */*",
};

type Security = { id: number; symbol: string };
let secCache: { at: number; map: Map<string, number> } | null = null;

async function securityId(symbol: string): Promise<number | null> {
  if (!secCache || Date.now() - secCache.at > 3600000) {
    try {
      const res = await fetch(`${CSE_BASE}/allSecurityCode`, { method: "GET", headers: CSE_HEADERS, cache: "no-store", signal: AbortSignal.timeout(10000) });
      if (res.ok) {
        const j = await res.json();
        const arr = Array.isArray(j) ? j : (j?.content ?? []);
        const map = new Map<string, number>();
        for (const s of arr) {
          if (s?.symbol && typeof s.id === "number") map.set(String(s.symbol).toUpperCase(), s.id);
        }
        secCache = { at: Date.now(), map };
      }
    } catch {
      secCache = secCache ?? { at: Date.now(), map: new Map() };
    }
  }
  return secCache?.map.get(symbol.toUpperCase()) ?? null;
}

async function postCse(endpoint: string, body: string) {
  const res = await fetch(`${CSE_BASE}/${endpoint}`, {
    method: "POST",
    headers: CSE_HEADERS,
    body,
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`CSE responded ${res.status} for ${endpoint}`);
  return res.json();
}

export async function POST(request: Request) {
  let symbol = "";
  let period = 5;
  try {
    const body = (await request.json()) as { symbol?: unknown; period?: unknown };
    symbol = String(body?.symbol ?? "").trim().toUpperCase();
    if (typeof body?.period === "number" && Number.isFinite(body.period)) period = Math.max(1, Math.floor(body.period));
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (!symbol) return NextResponse.json({ error: "Symbol is required." }, { status: 400 });

  try {
    const id = await securityId(symbol);
    if (!id) return NextResponse.json({ error: `No CSE security found for ${symbol}.` }, { status: 404 });

    const data = await postCse("companyChartDataByStock", `stockId=${id}&period=${period}`);
    const rows: Array<{ h?: number; l?: number; o?: number | null; p?: number; q?: number; c?: number | null; pc?: number | null; t?: number }> = Array.isArray(data?.chartData) ? data.chartData : [];

    const candles = rows.map((r, i) => {
      const close = Number(r.p ?? 0);
      const prevClose = i > 0 ? Number(rows[i - 1].p ?? close) : close;
      return {
        time: Number(r.t ?? 0),
        open: prevClose,
        high: Number(r.h ?? close),
        low: Number(r.l ?? close),
        close,
        volume: Number(r.q ?? 0),
        change: r.c == null ? null : Number(r.c),
        changePct: r.pc == null ? null : Number(r.pc),
      };
    });

    return NextResponse.json({ symbol, period, updatedAt: Date.now(), candles });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not fetch chart data." },
      { status: 502 },
    );
  }
}