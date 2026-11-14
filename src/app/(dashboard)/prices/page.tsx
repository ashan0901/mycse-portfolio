"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { companyService } from "@/services/company.service";
import { transactionService } from "@/services/transaction.service";
import { cseService } from "@/services/cse.service";
import { D, money, round } from "@/lib/decimal";
import type { PriceQuote, PricesResponse } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Company = {
  id: string;
  company_name?: string;
  ticker?: string;
  sector?: string | null;
};

type Holding = { remaining: number; avgCost: number; cost: number };

type TxRow = {
  company_id?: string;
  transaction_type?: string;
  transaction_date?: string;
  created_at?: string;
  quantity?: number | string;
  net_amount?: number | string;
};

const REFRESH_MS = 30000;

const qty = (value: number) => new Intl.NumberFormat("en-LK", { maximumFractionDigits: 4 }).format(value);
const norm = (s: string) => s.trim().toUpperCase().split(".")[0];
const pctText = (value: number) => `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
const clock = (ms: number) => new Date(ms).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

export default function PricesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [holdings, setHoldings] = useState<Record<string, Holding>>({});
  const [data, setData] = useState<PricesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [auto, setAuto] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [companyRows, txs] = await Promise.all([companyService.list(), transactionService.list()]);
        if (!active) return;
        const companyList = ((companyRows as Company[]) ?? []).map((c) => ({ ...c, ticker: (c.ticker ?? "").trim().toUpperCase() }));
        setCompanies(companyList);

        const grouped = new Map<string, { quantity: ReturnType<typeof D>; cost: ReturnType<typeof D> }>();
        const ordered = [...((txs as unknown as TxRow[]) ?? [])].sort((a, b) => {
          const da = String(a.transaction_date ?? "");
          const db = String(b.transaction_date ?? "");
          if (da !== db) return da.localeCompare(db);
          return String(a.created_at ?? "").localeCompare(String(b.created_at ?? ""));
        });
        for (const t of ordered) {
          const id = String(t.company_id ?? "");
          if (!id) continue;
          const entry = grouped.get(id) ?? { quantity: D(0), cost: D(0) };
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
        const map: Record<string, Holding> = {};
        for (const [id, entry] of grouped) {
          if (!entry.quantity.gt(0)) continue;
          map[id] = {
            remaining: round(entry.quantity),
            avgCost: round(entry.cost.div(entry.quantity)),
            cost: round(entry.cost),
          };
        }
        setHoldings(map);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const refresh = useCallback(
    async (mode: "initial" | "manual" | "auto") => {
      if (companies.length === 0) return;
      if (mode !== "auto") setRefreshing(true);
      try {
        const res = await cseService.quotes(companies.map((c) => c.ticker ?? "").filter(Boolean));
        setData(res);
        setError(res.error ?? null);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Could not fetch CSE prices.";
        setError(message);
        if (mode !== "auto") toast.error(message);
      } finally {
        if (mode !== "auto") setRefreshing(false);
      }
    },
    [companies],
  );

  useEffect(() => {
    if (companies.length === 0) return;
    void refresh("initial");
  }, [companies, refresh]);

  useEffect(() => {
    if (!auto || companies.length === 0) return;
    const id = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      void refresh("auto");
    }, REFRESH_MS);
    return () => clearInterval(id);
  }, [auto, companies, refresh]);

  const rows = useMemo(() => {
    return companies.map((c) => {
      const key = norm(c.ticker ?? "");
      const quote: PriceQuote | undefined = data?.quotes[key];
      const holding = holdings[c.id];
      const marketValue = quote && holding ? quote.price * holding.remaining : 0;
      const unrealized = holding ? marketValue - holding.cost : 0;
      const unrealizedPct = holding && holding.cost > 0 ? (unrealized / holding.cost) * 100 : 0;
      return { company: c, quote, holding, marketValue, unrealized, unrealizedPct };
    });
  }, [companies, data, holdings]);

  const totals = useMemo(() => {
    let marketValue = 0;
    let cost = 0;
    for (const r of rows) {
      if (!r.holding || !r.quote) continue;
      marketValue += r.marketValue;
      cost += r.holding.cost;
    }
    return { marketValue, cost, unrealized: marketValue - cost };
  }, [rows]);

  const status = data?.status ?? null;
  const marketOpen = status ? /open/i.test(status) : false;
  const missing = data?.missing ?? [];

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
          <h2 className="text-2xl font-semibold tracking-tight">CSE Prices</h2>
          <p className="text-sm text-muted-foreground">
            Colombo Stock Exchange quotes for the companies in your list. Refreshes every {REFRESH_MS / 1000}s while auto-refresh is on.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={marketOpen ? "default" : "secondary"} className="w-fit px-3 py-1 text-sm">
            {status ?? "Market status unknown"}
          </Badge>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} className="h-4 w-4" />
            Auto-refresh
          </label>
          <Button type="button" variant="outline" size="sm" disabled={refreshing || companies.length === 0} onClick={() => void refresh("manual")}>
            {refreshing ? "Refreshing…" : "Refresh now"}
          </Button>
        </div>
      </div>

      {companies.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
            <p className="text-sm font-medium">No companies yet</p>
            <p className="max-w-sm text-sm text-muted-foreground">Add companies in the Companies page to see their live CSE prices.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Card className="gap-3 py-4">
              <CardHeader className="pb-0">
                <CardDescription>Companies</CardDescription>
                <CardTitle className="text-2xl">{companies.length}</CardTitle>
              </CardHeader>
            </Card>
            <Card className="gap-3 py-4">
              <CardHeader className="pb-0">
                <CardDescription>Prices received</CardDescription>
                <CardTitle className="text-2xl">{Object.keys(data?.quotes ?? {}).length}</CardTitle>
              </CardHeader>
            </Card>
            <Card className="gap-3 py-4">
              <CardHeader className="pb-0">
                <CardDescription>Holding market value</CardDescription>
                <CardTitle className="text-2xl">{money(totals.marketValue)}</CardTitle>
              </CardHeader>
            </Card>
            <Card className="gap-3 py-4">
              <CardHeader className="pb-0">
                <CardDescription>Unrealized P&amp;L</CardDescription>
                <CardTitle className={`text-2xl ${totals.unrealized < 0 ? "text-destructive" : ""}`}>{money(totals.unrealized)}</CardTitle>
              </CardHeader>
            </Card>
          </div>

          {error ? (
            <Card className="border-destructive/40">
              <CardContent className="pt-6 text-sm text-destructive">
                {error} The CSE site may be unreachable or rate-limiting requests; retry in a moment.
              </CardContent>
            </Card>
          ) : null}

          {missing.length > 0 ? (
            <Card>
              <CardContent className="space-y-1 pt-6 text-sm">
                <p className="font-medium">Not found on the CSE list</p>
                <p className="text-muted-foreground">
                  {missing.join(", ")} — check the ticker on the Companies page. CSE symbols look like <span className="font-mono text-xs">JKH</span> or <span className="font-mono text-xs">JKH.N0000</span>.
                </p>
              </CardContent>
            </Card>
          ) : null}

          <Card className="overflow-hidden">
            <CardHeader className="border-b">
              <CardTitle>Live quotes</CardTitle>
              <CardDescription>
                {data ? `Last fetched ${clock(data.updatedAt)}` : "Waiting for first fetch…"} Prices are LKR, in the CSE session.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/40">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="px-4">Company</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                      <TableHead className="text-right">Change</TableHead>
                      <TableHead className="text-right">% Change</TableHead>
                      <TableHead className="text-right">Prev close</TableHead>
                      <TableHead className="text-right">Day high</TableHead>
                      <TableHead className="text-right">Day low</TableHead>
                      <TableHead className="text-right">Volume</TableHead>
                      <TableHead className="text-right">Holding</TableHead>
                      <TableHead className="text-right">Value</TableHead>
                      <TableHead className="px-4 text-right">Unrealized P&amp;L</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r) => {
                      const q = r.quote;
                      const up = (q?.changePercentage ?? 0) > 0;
                      const down = (q?.changePercentage ?? 0) < 0;
                      return (
                        <TableRow key={r.company.id}>
                          <TableCell className="px-4">
                            <div className="flex min-w-0 items-center gap-2">
                              <Badge variant="outline" className="font-mono text-xs">
                                {norm(r.company.ticker ?? "") || "—"}
                              </Badge>
                              <span className="hidden max-w-48 truncate text-sm text-muted-foreground lg:inline">
                                {q?.name || r.company.company_name || ""}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-medium tabular-nums">{q ? money(q.price) : "—"}</TableCell>
                          <TableCell className={`text-right tabular-nums ${up ? "text-emerald-600 dark:text-emerald-400" : down ? "text-destructive" : ""}`}>
                            {q ? `${q.change >= 0 ? "+" : ""}${q.change.toFixed(2)}` : "—"}
                          </TableCell>
                          <TableCell className={`text-right tabular-nums ${up ? "text-emerald-600 dark:text-emerald-400" : down ? "text-destructive" : ""}`}>
                            {q ? pctText(q.changePercentage) : "—"}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground">{q ? money(q.previousClose) : "—"}</TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground">{q ? money(q.high) : "—"}</TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground">{q ? money(q.low) : "—"}</TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground">{q ? qty(q.volume) : "—"}</TableCell>
                          <TableCell className="text-right tabular-nums">{r.holding ? qty(r.holding.remaining) : "—"}</TableCell>
                          <TableCell className="text-right tabular-nums">{r.holding && q ? money(r.marketValue) : "—"}</TableCell>
                          <TableCell
                            className={`px-4 text-right tabular-nums font-medium ${
                              !r.holding ? "" : r.unrealized > 0 ? "text-emerald-600 dark:text-emerald-400" : r.unrealized < 0 ? "text-destructive" : ""
                            }`}
                          >
                            {r.holding && q ? (
                              <span className="flex flex-col items-end">
                                <span>{money(r.unrealized)}</span>
                                <span className="text-xs font-normal">{pctText(r.unrealizedPct)}</span>
                              </span>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {!marketOpen && status ? (
            <p className="text-xs text-muted-foreground">
              CSE reports “{status}”. Quotes shown are the last known prices for the session and update when the market opens.
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}