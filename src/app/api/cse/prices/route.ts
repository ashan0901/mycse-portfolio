import { NextResponse } from "next/server";

const CSE_BASE = "https://www.cse.lk/api";
const CSE_HEADERS = {
  "Content-Type": "application/x-www-form-urlencoded",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  Origin: "https://www.cse.lk",
  Referer: "https://www.cse.lk/",
  Accept: "application/json, text/plain, */*",
};

type TradeSummaryRow = {
  symbol?: string;
  name?: string;
  price?: number;
  previousClose?: number;
  change?: number;
  percentageChange?: number;
  high?: number;
  low?: number;
  open?: number;
  closingPrice?: number;
  sharevolume?: number;
  turnover?: number;
  marketCap?: number;
  lastTradedTime?: number;
};

type Quote = {
  symbol: string;
  name: string;
  price: number;
  previousClose: number;
  change: number;
  changePercentage: number;
  high: number;
  low: number;
  open: number;
  volume: number;
  turnover: number;
  marketCap: number;
  lastTradedTime: number;
};

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const baseSymbol = (s: string) => s.trim().toUpperCase().split(".")[0];

type PricesPayload = {
  reqTradeSummery?: TradeSummaryRow[];
};

const SUMMARY_TTL_MS = 20000;
let summaryCache: { at: number; data: PricesPayload | null } | null = null;
let summaryInflight: Promise<PricesPayload | null> | null = null;

async function postCse(endpoint: string) {
  const res = await fetch(`${CSE_BASE}/${endpoint}`, {
    method: "POST",
    headers: CSE_HEADERS,
    body: "",
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`CSE responded ${res.status} for ${endpoint}`);
  return res.json();
}

async function fetchTradeSummary(): Promise<PricesPayload | null> {
  if (summaryCache && Date.now() - summaryCache.at < SUMMARY_TTL_MS) return summaryCache.data;
  if (!summaryInflight) {
    summaryInflight = (async () => {
      try {
        const data = (await postCse("tradeSummary").catch(() => null)) as PricesPayload | null;
        summaryCache = { at: Date.now(), data };
        return data;
      } finally {
        summaryInflight = null;
      }
    })();
  }
  return summaryInflight;
}

function toQuote(row: TradeSummaryRow): Quote {
  return {
    symbol: String(row.symbol ?? ""),
    name: String(row.name ?? ""),
    price: num(row.price),
    previousClose: num(row.previousClose),
    change: num(row.change),
    changePercentage: num(row.percentageChange),
    high: num(row.high),
    low: num(row.low),
    open: num(row.open),
    volume: num(row.sharevolume),
    turnover: num(row.turnover),
    marketCap: num(row.marketCap),
    lastTradedTime: num(row.lastTradedTime),
  };
}

export async function POST(request: Request) {
  let symbols: string[] = [];
  try {
    const body = (await request.json()) as { symbols?: unknown };
    if (Array.isArray(body?.symbols)) {
      symbols = body.symbols
        .filter((s): s is string => typeof s === "string")
        .map(baseSymbol)
        .filter(Boolean)
        .slice(0, 500);
    }
  } catch {
    symbols = [];
  }

  try {
    const [summary, status] = await Promise.all([
      fetchTradeSummary(),
      postCse("marketStatus").catch(() => null),
    ]);

    if (!summary) {
      return NextResponse.json({
        updatedAt: Date.now(),
        status: status?.status ?? null,
        quotes: {},
        missing: [],
        error: "CSE prices are temporarily unavailable.",
      });
    }

    const rows: TradeSummaryRow[] = Array.isArray(summary.reqTradeSummery)
      ? (summary.reqTradeSummery as TradeSummaryRow[])
      : [];

    const byBase = new Map<string, Quote>();
    for (const row of rows) {
      if (!row.symbol) continue;
      const b = baseSymbol(row.symbol);
      const prev = byBase.get(b);
      if (!prev || (row.symbol.endsWith(".N0000") && !prev.symbol.endsWith(".N0000"))) {
        byBase.set(b, toQuote(row));
      }
    }

    const requested = symbols.length > 0 ? symbols : [...byBase.keys()];
    const quotes: Record<string, Quote> = {};
    const missing: string[] = [];
    for (const symbol of requested) {
      const quote = byBase.get(baseSymbol(symbol));
      if (quote) quotes[baseSymbol(symbol)] = quote;
      else missing.push(baseSymbol(symbol));
    }

    return NextResponse.json({
      updatedAt: Date.now(),
      status: status?.status ?? null,
      quotes,
      missing,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not fetch CSE prices." },
      { status: 502 },
    );
  }
}