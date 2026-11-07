"use client";

import { useEffect, useState } from "react";
import { cashService, type CashSummary } from "@/services/cash.service";
import { companyService } from "@/services/company.service";
import { transactionService } from "@/services/transaction.service";
import { money } from "@/lib/decimal";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

type Holding = { name: string; value: number };
type Stats = { invested: number; realized: number; cash: CashSummary };

export default function DashboardPage() {
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [companies, txs, cash] = await Promise.all([companyService.list(), transactionService.list(), cashService.summary()]);
        let invested = 0;
        let realized = 0;
        const h: Holding[] = [];
        for (const c of companies) {
          let qty = 0;
          let cost = 0;
          const cTxs = (txs as Array<Record<string, unknown>>).filter((t) => t.company_id === c.id);
          for (const t of cTxs) {
            if (t.transaction_type === "BUY") {
              qty += Number(t.quantity || 0);
              cost += Number(t.net_amount || 0);
              invested += Number(t.net_amount || 0);
            } else {
              const alloc = qty > 0 ? (cost * Number(t.quantity || 0)) / qty : 0;
              qty -= Number(t.quantity || 0);
              cost -= alloc;
              realized += Number(t.realized_profit_loss || 0);
            }
          }
          if (qty > 0) h.push({ name: c.ticker, value: Number(cost.toFixed(2)) });
        }
        setHoldings(h);
        setStats({ invested, realized, cash });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const colors = ["#22c55e", "#3b82f6", "#f59e0b", "#ef4444", "#a855f7"];

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">Dashboard</h2>
        <p className="text-sm text-muted-foreground">Portfolio value, CDS cash, and trading performance.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="gap-3 py-4">
          <CardHeader className="pb-0">
            <CardDescription>CDS available</CardDescription>
            <CardTitle className={`text-2xl ${stats && stats.cash.balance < 0 ? "text-destructive" : ""}`}>
              {loading || !stats ? "—" : money(stats.cash.balance)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="gap-3 py-4">
          <CardHeader className="pb-0">
            <CardDescription>Total invested</CardDescription>
            <CardTitle className="text-2xl">{loading || !stats ? "—" : money(stats.invested)}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="gap-3 py-4">
          <CardHeader className="pb-0">
            <CardDescription>Realized P&amp;L</CardDescription>
            <CardTitle className={`text-2xl ${stats && stats.realized < 0 ? "text-destructive" : ""}`}>
              {loading || !stats ? "—" : money(stats.realized)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="gap-3 py-4">
          <CardHeader className="pb-0">
            <CardDescription>Total deposited</CardDescription>
            <CardTitle className="text-2xl">{loading || !stats ? "—" : money(stats.cash.deposited)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="border-b">
            <CardTitle>Portfolio Allocation</CardTitle>
            <CardDescription>Current holdings by cost basis.</CardDescription>
          </CardHeader>
          <CardContent className="h-72 pt-6">
            {loading ? (
              <Skeleton className="h-full w-full" />
            ) : holdings.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No holdings to display.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={holdings} dataKey="value" nameKey="name" outerRadius={90}>
                    {holdings.map((_, i) => (
                      <Cell key={i} fill={colors[i % colors.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => money(Number(value ?? 0))} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="border-b">
            <CardTitle>Holdings Value</CardTitle>
            <CardDescription>Cost basis by company.</CardDescription>
          </CardHeader>
          <CardContent className="h-72 pt-6">
            {loading ? (
              <Skeleton className="h-full w-full" />
            ) : holdings.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No holdings to display.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={holdings}>
                  <XAxis dataKey="name" />
                  <YAxis tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`} />
                  <Tooltip formatter={(value) => money(Number(value ?? 0))} />
                  <Bar dataKey="value" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}


