"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cashService, type CashSummary } from "@/services/cash.service";
import { companyService } from "@/services/company.service";
import { transactionService } from "@/services/transaction.service";
import { cseService } from "@/services/cse.service";
import type { Candle } from "@/types";
import { money } from "@/lib/decimal";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CandlestickChart } from "@/components/candlestick-chart";

type Tx = {
  transaction_type?: string;
  net_amount?: number | string;
  total_fees?: number | string;
  realized_profit_loss?: number | string | null;
};

type Stats = {
  realized: number;
  buyTotal: number;
  sellTotal: number;
  fees: number;
  count: number;
  buys: number;
  sells: number;
  cash: CashSummary;
};

function StatCard({
  label,
  value,
  hint,
  tone,
  loading,
}: {
  label: string;
  value: string;
  hint: string;
  tone?: "positive" | "negative";
  loading: boolean;
}) {
  return (
    <Card className="gap-3 py-4">
      <CardHeader className="pb-0">
        <CardDescription>{label}</CardDescription>
        <CardTitle
          className={`text-2xl tracking-tight ${
            !loading && tone === "negative" ? "text-destructive" : !loading && tone === "positive" ? "text-emerald-600 dark:text-emerald-400" : ""
          }`}
        >
          {loading ? "—" : value}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

export default function AnalyticsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [companies, setCompanies] = useState<{ id: string; ticker?: string; company_name?: string }[]>([]);
  const [companyId, setCompanyId] = useState("");
  const [period, setPeriod] = useState(5);
  const [chartType, setChartType] = useState<"candlestick" | "line" | "bar">("candlestick");
  const [chartHeight, setChartHeight] = useState(360);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [chartLoading, setChartLoading] = useState(false);
  const [chartError, setChartError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([transactionService.list(), cashService.summary()])
      .then(([rows, cash]) => {
        const txs = (rows as Tx[]) ?? [];
        const buys = txs.filter((r) => r.transaction_type === "BUY");
        const sells = txs.filter((r) => r.transaction_type === "SELL");
        setStats({
          realized: sells.reduce((s, r) => s + Number(r.realized_profit_loss || 0), 0),
          buyTotal: buys.reduce((s, r) => s + Number(r.net_amount || 0), 0),
          sellTotal: sells.reduce((s, r) => s + Number(r.net_amount || 0), 0),
          fees: txs.reduce((s, r) => s + Number(r.total_fees || 0), 0),
          count: txs.length,
          buys: buys.length,
          sells: sells.length,
          cash,
        });
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const rows = ((await companyService.list()) as { id: string; ticker?: string; company_name?: string }[]) ?? [];
        if (!active) return;
        setCompanies(rows);
        if (rows.length > 0) setCompanyId(rows[0].id);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const selectedCompany = companies.find((c) => c.id === companyId) ?? null;
  const ticker = selectedCompany?.ticker?.trim().toUpperCase() ?? "";

  useEffect(() => {
    if (!ticker) {
      setCandles([]);
      return;
    }
    let active = true;
    setChartLoading(true);
    setChartError(null);
    (async () => {
      try {
        const res = await cseService.chart(ticker, period);
        if (!active) return;
        setCandles(res.candles ?? []);
        setChartError(null);
      } catch (err) {
        if (active) {
          setCandles([]);
          setChartError(err instanceof Error ? err.message : "Could not fetch chart data.");
        }
      } finally {
        if (active) setChartLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [ticker, period]);

  const netFlow = useMemo(() => (stats ? stats.sellTotal - stats.buyTotal : 0), [stats]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold tracking-tight">Analytics</h2>
          <p className="text-sm text-muted-foreground">Trading performance and CDS cash movement in one view.</p>
        </div>
        <Badge variant="secondary" className="w-fit px-3 py-1 text-sm">
          {loading ? "Loading…" : `${stats?.count ?? 0} transactions`}
        </Badge>
      </div>

      {loading || !stats ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <StatCard label="CDS available" value={money(stats.cash.balance)} hint="Current cash balance available for trading." loading={false} tone={stats.cash.balance < 0 ? "negative" : undefined} />
          <StatCard label="Total deposited" value={money(stats.cash.deposited)} hint="Cash deposited to your broker/CDS account." loading={false} />
          <StatCard label="Realized P&L" value={money(stats.realized)} hint="Profit or loss from completed sell transactions." loading={false} tone={stats.realized < 0 ? "negative" : stats.realized > 0 ? "positive" : undefined} />
          <StatCard label="Total bought" value={money(stats.buyTotal)} hint={`${stats.buys} buy ${stats.buys === 1 ? "order" : "orders"} including fees.`} loading={false} />
          <StatCard label="Total sold" value={money(stats.sellTotal)} hint={`${stats.sells} sell ${stats.sells === 1 ? "order" : "orders"} after fees.`} loading={false} />
          <StatCard label="Total fees" value={money(stats.fees)} hint="Fees paid across all transactions." loading={false} />
          <StatCard label="Trading net flow" value={money(netFlow)} hint="Sell proceeds minus buy costs from recorded trades." loading={false} tone={netFlow < 0 ? "negative" : netFlow > 0 ? "positive" : undefined} />
          <StatCard label="Withdrawals / adjustments" value={money(stats.cash.withdrawn + stats.cash.adjustments)} hint="Cash withdrawn or adjusted outside trading." loading={false} />
          <StatCard label="Activity" value={`${stats.count}`} hint="Total recorded transactions in your account." loading={false} />
        </div>
      )}

      <Card className="overflow-hidden">
        <CardHeader className="border-b">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-1">
              <CardTitle>Adjustable candlestick chart</CardTitle>
              <CardDescription>Zoom/pan, resize height, switch chart type, and change the period.</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                className="border-input bg-background h-9 rounded-md border px-3 text-sm"
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                disabled={companies.length === 0}
              >
                <option value="">Select company</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.ticker} - {c.company_name}
                  </option>
                ))}
              </select>
              <select
                className="border-input bg-background h-9 rounded-md border px-3 text-sm"
                value={chartType}
                onChange={(e) => setChartType(e.target.value as "candlestick" | "line" | "bar")}
              >
                <option value="candlestick">Candlestick</option>
                <option value="line">Line</option>
                <option value="bar">OHLC bars</option>
              </select>
              <select
                className="border-input bg-background h-9 rounded-md border px-3 text-sm"
                value={period}
                onChange={(e) => setPeriod(Number(e.target.value))}
              >
                <option value={1}>Intraday</option>
                <option value={5}>5 days</option>
                <option value={30}>30 days</option>
                <option value={90}>90 days</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-6">
          {companies.length === 0 ? (
            <p className="text-sm text-muted-foreground">Add companies first to view their charts.</p>
          ) : chartLoading ? (
            <Skeleton className="w-full" style={{ height: chartHeight }} />
          ) : chartError ? (
            <p className="text-sm text-destructive">{chartError}</p>
          ) : candles.length === 0 ? (
            <p className="text-sm text-muted-foreground">No chart data available for {ticker}.</p>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-mono text-xs">{ticker}</Badge>
                <span className="text-xs text-muted-foreground">{candles.length} candles · drag to pan, scroll to zoom</span>
              </div>
              <CandlestickChart candles={candles} height={chartHeight} type={chartType} />
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">Height</span>
                <input
                  id="chart-height"
                  type="range"
                  min={200}
                  max={600}
                  step={20}
                  value={chartHeight}
                  onChange={(e) => setChartHeight(Number(e.target.value))}
                  className="flex-1"
                />
                <span className="text-xs tabular-nums text-muted-foreground">{chartHeight}px</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}