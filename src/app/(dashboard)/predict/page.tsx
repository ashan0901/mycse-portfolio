"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { transactionService } from "@/services/transaction.service";
import { cseService } from "@/services/cse.service";
import { D, money, round } from "@/lib/decimal";
import type { PriceQuote } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

type Holding = {
  companyId: string;
  ticker: string;
  name: string;
  remaining: number;
  avgCost: number;
  cost: number;
};

type TxRow = {
  company_id?: string;
  transaction_type?: string;
  transaction_date?: string;
  created_at?: string;
  quantity?: number | string;
  net_amount?: number | string;
  companies?: { ticker?: string; company_name?: string } | null;
};

const qty = (value: number) => new Intl.NumberFormat("en-LK", { maximumFractionDigits: 4 }).format(value);
const pct = (value: number) => `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
const norm = (s: string) => s.trim().toUpperCase().split(".")[0];
const clock = (ms?: number) =>
  ms ? new Date(ms).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "";

const QUOTE_REFRESH_MS = 30000;

type RunningHolding = {
  companyId: string;
  ticker: string;
  name: string;
  quantity: ReturnType<typeof D>;
  cost: ReturnType<typeof D>;
};

export default function PredictPage() {
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [loading, setLoading] = useState(true);
  const [companyId, setCompanyId] = useState("");
  const [sellPrice, setSellPrice] = useState("");
  const [quantity, setQuantity] = useState("");
  const [fees, setFees] = useState("");
  const [feesTouched, setFeesTouched] = useState(false);
  const [quote, setQuote] = useState<PriceQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [priceTouched, setPriceTouched] = useState(false);
  const priceTouchedRef = useRef(false);
  const rate = Number(process.env.NEXT_PUBLIC_FEE_RATE || 0.0112);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const txs = (await transactionService.list()) as unknown as TxRow[];
        const grouped = new Map<string, RunningHolding>();
        const ordered = [...((txs as unknown as TxRow[]) ?? [])].sort((a, b) => {
          const da = String(a.transaction_date ?? "");
          const db = String(b.transaction_date ?? "");
          if (da !== db) return da.localeCompare(db);
          return String(a.created_at ?? "").localeCompare(String(b.created_at ?? ""));
        });
        for (const t of ordered) {
          const id = String(t.company_id ?? "");
          if (!id) continue;
          const entry = grouped.get(id) ?? {
            companyId: id,
            ticker: t.companies?.ticker ?? "—",
            name: t.companies?.company_name ?? "",
            quantity: D(0),
            cost: D(0),
          };
          if (t.transaction_type === "BUY") {
            entry.quantity = entry.quantity.plus(t.quantity ?? 0);
            entry.cost = entry.cost.plus(t.net_amount ?? 0);
          } else {
            const alloc = entry.quantity.gt(0) ? entry.cost.times(t.quantity ?? 0).div(entry.quantity) : D(0);
            entry.quantity = entry.quantity.minus(t.quantity ?? 0);
            entry.cost = entry.cost.minus(alloc);
          }
          grouped.set(id, entry);
        }
        const result: Holding[] = [];
        for (const entry of grouped.values()) {
          if (!entry.quantity.gt(0)) continue;
          result.push({
            companyId: entry.companyId,
            ticker: entry.ticker,
            name: entry.name,
            remaining: round(entry.quantity),
            avgCost: round(entry.cost.div(entry.quantity)),
            cost: round(entry.cost),
          });
        }
        result.sort((a, b) => b.cost - a.cost);
        if (!active) return;
        setHoldings(result);
        if (result.length > 0) {
          setCompanyId(result[0].companyId);
          setQuantity(String(result[0].remaining));
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const selected = holdings.find((h) => h.companyId === companyId) ?? null;
  const ticker = selected ? norm(selected.ticker) : "";
  const hasTicker = Boolean(ticker) && ticker !== "—";

  useEffect(() => {
    if (!hasTicker) {
      setQuote(null);
      setQuoteError(selected ? `No CSE ticker for ${selected.name || "this holding"}.` : null);
      return;
    }
    let active = true;
    setQuoteLoading(true);
    (async () => {
      try {
        const res = await cseService.quotes([ticker]);
        if (!active) return;
        const next = res.quotes[ticker] ?? null;
        setQuote(next);
        setQuoteError(res.error ?? (next ? null : `No CSE price found for ${ticker}.`));
        if (next && !priceTouchedRef.current) setSellPrice(String(next.price));
      } catch (err) {
        if (active) {
          setQuote(null);
          setQuoteError(err instanceof Error ? err.message : "Could not fetch the CSE price.");
        }
      } finally {
        if (active) setQuoteLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [hasTicker, selected, ticker]);

  useEffect(() => {
    if (!hasTicker) return;
    const id = setInterval(async () => {
      if (typeof document !== "undefined" && document.hidden) return;
      try {
        const res = await cseService.quotes([ticker]);
        const next = res.quotes[ticker] ?? null;
        setQuote(next);
        setQuoteError(res.error ?? (next ? null : `No CSE price found for ${ticker}.`));
        if (next && !priceTouchedRef.current) setSellPrice(String(next.price));
      } catch {
        // keep the last known quote when a background refresh fails
      }
    }, QUOTE_REFRESH_MS);
    return () => clearInterval(id);
  }, [hasTicker, ticker]);

  const gross = useMemo(() => {
    const q = Number(quantity || 0);
    const p = Number(sellPrice || 0);
    return q > 0 && p > 0 ? q * p : 0;
  }, [quantity, sellPrice]);

  const estimatedFees = gross > 0 ? gross * rate : 0;
  const feeValue = feesTouched ? Number(fees || 0) : estimatedFees;

  const projection = useMemo(() => {
    const q = Number(quantity || 0);
    const p = Number(sellPrice || 0);
    const costBasis = selected && q > 0 ? selected.avgCost * q : 0;
    const netProceeds = gross - feeValue;
    const profit = netProceeds - costBasis;
    const returnPct = costBasis > 0 ? (profit / costBasis) * 100 : 0;
    return { quantity: q, sellPrice: p, gross, fees: feeValue, netProceeds, costBasis, profit, returnPct };
  }, [quantity, sellPrice, gross, feeValue, selected]);

  function selectCompany(id: string) {
    priceTouchedRef.current = false;
    setPriceTouched(false);
    setCompanyId(id);
    const holding = holdings.find((h) => h.companyId === id);
    setQuantity(holding ? String(holding.remaining) : "");
    setFees("");
    setFeesTouched(false);
    setSellPrice("");
    setQuote(null);
    setQuoteError(null);
  }

  function useLivePrice() {
    if (!quote) return;
    priceTouchedRef.current = false;
    setPriceTouched(false);
    setSellPrice(String(quote.price));
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold tracking-tight">Predict Profit/Loss</h2>
          <p className="text-sm text-muted-foreground">
            Estimate gain or loss if you sell holdings at a given price, after fees.
          </p>
        </div>
        <Badge variant="secondary" className="w-fit px-3 py-1 text-sm">
          Fee rate {(rate * 100).toFixed(2)}%
        </Badge>
      </div>

      {holdings.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
            <p className="text-sm font-medium">No holdings to predict</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Buy transactions with remaining quantity will appear here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <Card>
            <CardHeader className="border-b">
              <CardTitle>Sale estimate</CardTitle>
              <CardDescription>Pick a holding, then enter the sell price and share amount.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              <div className="space-y-2">
                <Label htmlFor="predict-company">Company</Label>
                <select
                  id="predict-company"
                  className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-md border px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
                  value={companyId}
                  onChange={(e) => selectCompany(e.target.value)}
                >
                  <option value="">Select company</option>
                  {holdings.map((h) => (
                    <option key={h.companyId} value={h.companyId}>
                      {h.ticker} - {h.name} ({qty(h.remaining)} shares)
                    </option>
                  ))}
                </select>
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-sm">
                  <span className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">CSE price</Badge>
                    <span className="font-medium tabular-nums">
                      {quoteLoading && !quote ? "Fetching…" : quote ? money(quote.price) : "—"}
                    </span>
                    {quote ? (
                      <span className={`text-xs tabular-nums ${quote.changePercentage < 0 ? "text-destructive" : ""}`}>
                        {pct(quote.changePercentage)}
                        {quote.lastTradedTime ? ` · ${clock(quote.lastTradedTime)}` : ""}
                      </span>
                    ) : null}
                  </span>
                  {quote ? (
                    <Button type="button" variant="outline" size="sm" onClick={useLivePrice}>
                      Use live price
                    </Button>
                  ) : null}
                </div>
                {quoteError ? <p className="text-xs text-muted-foreground">{quoteError}</p> : null}
              </div>

              {selected ? (
                <div className="grid gap-3 rounded-lg border bg-muted/30 p-3 text-sm sm:grid-cols-3">
                  <div>
                    <p className="text-muted-foreground">Held</p>
                    <p className="font-medium tabular-nums">{qty(selected.remaining)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Avg cost / share</p>
                    <p className="font-medium tabular-nums">{money(selected.avgCost)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Total cost</p>
                    <p className="font-medium tabular-nums">{money(selected.cost)}</p>
                  </div>
                </div>
              ) : null}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="predict-price">Sell price per share</Label>
                  <Input
                    id="predict-price"
                    type="number"
                    min="0"
                    step="any"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={sellPrice}
                    onChange={(e) => {
                      priceTouchedRef.current = true;
                      setPriceTouched(true);
                      setSellPrice(e.target.value);
                    }}
                  />
                  <p className="text-xs text-muted-foreground">
                    {priceTouched ? "Manual price — CSE updates will not overwrite it." : "Auto-filled from the latest CSE price."}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="predict-qty">Share amount</Label>
                  <Input
                    id="predict-qty"
                    type="number"
                    min="0"
                    step="any"
                    inputMode="decimal"
                    placeholder="0"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="predict-fees">Transaction fees</Label>
                  <Input
                    id="predict-fees"
                    type="number"
                    min="0"
                    step="any"
                    inputMode="decimal"
                    value={feesTouched ? fees : estimatedFees ? estimatedFees.toFixed(2) : ""}
                    onChange={(e) => {
                      setFeesTouched(true);
                      setFees(e.target.value);
                    }}
                  />
                </div>
              </div>
              {selected && Number(quantity || 0) > selected.remaining ? (
                <p className="text-sm text-destructive">
                  Only {qty(selected.remaining)} shares are available; the estimate uses the amount entered.
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card className="h-fit">
            <CardHeader className="border-b">
              <CardTitle>Profit / Loss</CardTitle>
              <CardDescription>Based on your average cost basis, net of selling fees.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 pt-6 text-sm">
              <div
                className={`rounded-xl border p-4 text-center ${
                  projection.costBasis <= 0
                    ? ""
                    : projection.profit >= 0
                      ? "border-emerald-500/30 bg-emerald-500/5"
                      : "border-destructive/30 bg-destructive/5"
                }`}
              >
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Estimated {projection.profit >= 0 ? "profit" : "loss"}</p>
                <p
                  className={`mt-1 text-2xl font-semibold tabular-nums ${
                    projection.costBasis <= 0 ? "" : projection.profit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"
                  }`}
                >
                  {projection.costBasis > 0 || projection.gross > 0 ? money(projection.profit) : "—"}
                </p>
                <p
                  className={`text-sm font-medium tabular-nums ${
                    projection.costBasis <= 0 ? "text-muted-foreground" : projection.profit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"
                  }`}
                >
                  {projection.costBasis > 0 ? pct(projection.returnPct) : "—"}
                </p>
              </div>

              <div className="flex items-center justify-between rounded-lg border p-3">
                <span className="text-muted-foreground">Gross sale value</span>
                <span className="font-medium tabular-nums">{money(projection.gross)}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <span className="text-muted-foreground">Fees</span>
                <span className="font-medium tabular-nums">{money(projection.fees)}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <span className="text-muted-foreground">Net proceeds</span>
                <span className="font-medium tabular-nums">{money(projection.netProceeds)}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-3">
                <span className="font-medium">Cost basis for {qty(projection.quantity || 0)} shares</span>
                <span className="text-base font-semibold tabular-nums">{money(projection.costBasis)}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}