"use client";

import { useEffect, useMemo, useState } from "react";
import { transactionService } from "@/services/transaction.service";
import { buildClosedTrades, type ClosedTrade, type InvalidSell } from "@/lib/fifo";
import { money } from "@/lib/decimal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type TxRow = {
  id: string;
  company_id: string;
  transaction_type: "BUY" | "SELL";
  transaction_date: string;
  created_at?: string;
  quantity: number | string;
  price_per_share: number | string;
  total_fees?: number | string;
  companies?: { ticker?: string; company_name?: string } | null;
};

const qty = (value: number) => new Intl.NumberFormat("en-LK", { maximumFractionDigits: 4 }).format(value);
const pct = (value: number) => `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;

export default function ClosedTradesPage() {
  const [trades, setTrades] = useState<ClosedTrade[]>([]);
  const [invalid, setInvalid] = useState<InvalidSell[]>([]);
  const [loading, setLoading] = useState(true);
  const [companyFilter, setCompanyFilter] = useState("");
  const [resultFilter, setResultFilter] = useState<"all" | "profit" | "loss">("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const txs = (await transactionService.list()) as unknown as TxRow[];
        const result = buildClosedTrades(txs);
        if (!active) return;
        setTrades(result.trades);
        setInvalid(result.invalidSells);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const companies = useMemo(
    () => [...new Set(trades.map((t) => t.ticker))].sort(),
    [trades],
  );

  const filtered = useMemo(() => {
    return trades.filter((t) => {
      if (companyFilter && t.ticker !== companyFilter) return false;
      if (resultFilter === "profit" && t.realizedPnl < 0) return false;
      if (resultFilter === "loss" && t.realizedPnl >= 0) return false;
      if (from && t.sellDate < from) return false;
      if (to && t.sellDate > to) return false;
      return true;
    });
  }, [trades, companyFilter, resultFilter, from, to]);

  const summary = useMemo(() => {
    const winning = filtered.filter((t) => t.realizedPnl > 0);
    const losing = filtered.filter((t) => t.realizedPnl < 0);
    const totalProfit = winning.reduce((s, t) => s + t.realizedPnl, 0);
    const totalLoss = losing.reduce((s, t) => s + t.realizedPnl, 0);
    const net = totalProfit + totalLoss;
    const winRate = filtered.length > 0 ? (winning.length / filtered.length) * 100 : 0;
    const avgWin = winning.length > 0 ? totalProfit / winning.length : 0;
    const avgLoss = losing.length > 0 ? totalLoss / losing.length : 0;
    return { winning, losing, totalProfit, totalLoss, net, winRate, avgWin, avgLoss };
  }, [filtered]);

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
          <h2 className="text-2xl font-semibold tracking-tight">Closed Trades</h2>
          <p className="text-sm text-muted-foreground">
            Trade-by-trade realized profit &amp; loss using FIFO matching.
          </p>
        </div>
        <Badge variant="secondary" className="w-fit px-3 py-1 text-sm">
          {filtered.length} {filtered.length === 1 ? "match" : "matches"}
        </Badge>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="gap-3 py-4">
          <CardHeader className="pb-0">
            <CardDescription>Total realized profit</CardDescription>
            <CardTitle className="text-2xl text-emerald-600 dark:text-emerald-400">{money(summary.totalProfit)}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="gap-3 py-4">
          <CardHeader className="pb-0">
            <CardDescription>Total realized loss</CardDescription>
            <CardTitle className="text-2xl text-destructive">{money(summary.totalLoss)}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="gap-3 py-4">
          <CardHeader className="pb-0">
            <CardDescription>Net realized P&amp;L</CardDescription>
            <CardTitle className={`text-2xl ${summary.net < 0 ? "text-destructive" : ""}`}>{money(summary.net)}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="gap-3 py-4">
          <CardHeader className="pb-0">
            <CardDescription>Win rate</CardDescription>
            <CardTitle className="text-2xl">{summary.winRate.toFixed(2)}%</CardTitle>
          </CardHeader>
        </Card>
        <Card className="gap-3 py-4">
          <CardHeader className="pb-0">
            <CardDescription>Winning trades</CardDescription>
            <CardTitle className="text-2xl">{summary.winning.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="gap-3 py-4">
          <CardHeader className="pb-0">
            <CardDescription>Losing trades</CardDescription>
            <CardTitle className="text-2xl">{summary.losing.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="gap-3 py-4">
          <CardHeader className="pb-0">
            <CardDescription>Avg profit / win</CardDescription>
            <CardTitle className="text-2xl text-emerald-600 dark:text-emerald-400">{money(summary.avgWin)}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="gap-3 py-4">
          <CardHeader className="pb-0">
            <CardDescription>Avg loss / loss</CardDescription>
            <CardTitle className="text-2xl text-destructive">{money(summary.avgLoss)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader className="border-b">
          <CardTitle>Filters</CardTitle>
          <CardDescription>Filter closed trades by company, outcome, and sell date.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 pt-6 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="ct-company">Company</Label>
            <select
              id="ct-company"
              className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
              value={companyFilter}
              onChange={(e) => setCompanyFilter(e.target.value)}
            >
              <option value="">All companies</option>
              {companies.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ct-result">Outcome</Label>
            <select
              id="ct-result"
              className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
              value={resultFilter}
              onChange={(e) => setResultFilter(e.target.value as "all" | "profit" | "loss")}
            >
              <option value="all">All</option>
              <option value="profit">Profitable only</option>
              <option value="loss">Loss-making only</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ct-from">Sell from</Label>
            <Input id="ct-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ct-to">Sell to</Label>
            <Input id="ct-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {invalid.length > 0 ? (
        <Card className="border-destructive/40">
          <CardContent className="space-y-1 pt-6 text-sm">
            <p className="font-medium text-destructive">Invalid sells detected</p>
            <p className="text-muted-foreground">
              {invalid.map((i) => `${i.ticker}: ${qty(i.requested)} requested, ${qty(i.available)} available on ${i.date}`).join(" · ")}
            </p>
          </CardContent>
        </Card>
      ) : null}

      <Card className="overflow-hidden">
        <CardHeader className="border-b">
          <CardTitle>Closed trades (FIFO)</CardTitle>
          <CardDescription>Each row is a matched buy/sell pair. One sell can produce multiple matches.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="px-4">ID</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Ticker</TableHead>
                  <TableHead>Buy date</TableHead>
                  <TableHead>Sell date</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Buy price</TableHead>
                  <TableHead className="text-right">Sell price</TableHead>
                  <TableHead className="text-right">Buy fees</TableHead>
                  <TableHead className="text-right">Sell fees</TableHead>
                  <TableHead className="text-right">Buy cost</TableHead>
                  <TableHead className="text-right">Net proceeds</TableHead>
                  <TableHead className="text-right">Realized P&amp;L</TableHead>
                  <TableHead className="px-4 text-right">Return</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={14} className="px-4 py-10 text-center text-sm text-muted-foreground">
                      No closed trades yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="px-4 font-mono text-xs">{t.id}</TableCell>
                      <TableCell className="max-w-32 truncate text-sm">{t.companyName}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono text-xs">{t.ticker}</Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">{t.buyDate}</TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">{t.sellDate}</TableCell>
                      <TableCell className="text-right tabular-nums">{qty(t.matchedQty)}</TableCell>
                      <TableCell className="text-right tabular-nums">{money(t.buyPrice)}</TableCell>
                      <TableCell className="text-right tabular-nums">{money(t.sellPrice)}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">{money(t.allocatedBuyFees)}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">{money(t.allocatedSellFees)}</TableCell>
                      <TableCell className="text-right tabular-nums">{money(t.totalBuyCost)}</TableCell>
                      <TableCell className="text-right tabular-nums">{money(t.netSellProceeds)}</TableCell>
                      <TableCell className={`text-right tabular-nums font-medium ${t.realizedPnl < 0 ? "text-destructive" : "text-emerald-600 dark:text-emerald-400"}`}>
                        {money(t.realizedPnl)}
                      </TableCell>
                      <TableCell className="px-4 text-right tabular-nums font-medium">{pct(t.returnPct)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}