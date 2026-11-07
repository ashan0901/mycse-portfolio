"use client";

import { useEffect, useMemo, useState } from "react";
import { cashService, type CashSummary } from "@/services/cash.service";
import { transactionService } from "@/services/transaction.service";
import { money } from "@/lib/decimal";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

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
    </div>
  );
}

