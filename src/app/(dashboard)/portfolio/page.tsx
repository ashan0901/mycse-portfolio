"use client";

import { useEffect, useMemo, useState } from "react";
import { companyService } from "@/services/company.service";
import { transactionService } from "@/services/transaction.service";
import { D, money, round } from "@/lib/decimal";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type HoldingRow = {
  ticker: string;
  name: string;
  purchased: number;
  sold: number;
  remaining: number;
  avgCost: number;
  cost: number;
};

const qty = (value: number) => new Intl.NumberFormat("en-LK", { maximumFractionDigits: 4 }).format(value);

export default function PortfolioPage() {
  const [rows, setRows] = useState<HoldingRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [companies, txs] = await Promise.all([companyService.list(), transactionService.list()]);
        const result: HoldingRow[] = [];
        for (const c of companies) {
          let purchased = 0;
          let sold = 0;
          const cTxs = txs
            .filter((t) => (t as { company_id?: string }).company_id === c.id)
            .sort((a, b) => String((a as { transaction_date?: string }).transaction_date).localeCompare(String((b as { transaction_date?: string }).transaction_date)));
          let quantity = D(0);
          let cost = D(0);
          for (const t of cTxs) {
            const tx = t as { transaction_type?: string; quantity?: number | string; net_amount?: number | string };
            if (tx.transaction_type === "BUY") {
              quantity = quantity.plus(tx.quantity ?? 0);
              cost = cost.plus(tx.net_amount ?? 0);
              purchased += Number(tx.quantity ?? 0);
            } else {
              const alloc = quantity.gt(0) ? cost.times(tx.quantity ?? 0).div(quantity) : D(0);
              quantity = quantity.minus(tx.quantity ?? 0);
              cost = cost.minus(alloc);
              sold += Number(tx.quantity ?? 0);
            }
          }
          if (quantity.gt(0)) {
            result.push({
              ticker: c.ticker,
              name: c.company_name,
              purchased,
              sold,
              remaining: round(quantity),
              avgCost: round(cost.div(quantity)),
              cost: round(cost),
            });
          }
        }
        result.sort((a, b) => b.cost - a.cost);
        setRows(result);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const totals = useMemo(
    () => ({
      holdings: rows.length,
      shares: rows.reduce((sum, row) => sum + row.remaining, 0),
      cost: rows.reduce((sum, row) => sum + row.cost, 0),
    }),
    [rows],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold tracking-tight">Portfolio</h2>
          <p className="text-sm text-muted-foreground">Current holdings, quantities, and cost basis.</p>
        </div>
        <Badge variant="secondary" className="w-fit px-3 py-1 text-sm">
          {totals.holdings} {totals.holdings === 1 ? "holding" : "holdings"}
        </Badge>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="gap-3 py-4">
          <CardHeader className="pb-0">
            <CardDescription>Total holdings</CardDescription>
            <CardTitle className="text-2xl">{totals.holdings}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="gap-3 py-4">
          <CardHeader className="pb-0">
            <CardDescription>Total shares</CardDescription>
            <CardTitle className="text-2xl">{loading ? "—" : qty(totals.shares)}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="gap-3 py-4">
          <CardHeader className="pb-0">
            <CardDescription>Total cost basis</CardDescription>
            <CardTitle className="text-2xl">{loading ? "—" : money(totals.cost)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="border-b">
          <CardTitle>Current Holdings</CardTitle>
          <CardDescription>Sorted by total cost. Values are based on recorded transactions.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-3 p-6">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
              <p className="text-sm font-medium">No holdings yet</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                Buy transactions with remaining quantity will appear here.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="px-4">Company</TableHead>
                  <TableHead className="text-right">Purchased</TableHead>
                  <TableHead className="text-right">Sold</TableHead>
                  <TableHead className="text-right">Remaining</TableHead>
                  <TableHead className="text-right">Avg cost</TableHead>
                  <TableHead className="px-4 text-right">Total cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.ticker} className="group">
                    <TableCell className="px-4">
                      <div className="flex min-w-0 items-center gap-3">
                        <Badge variant="outline" className="font-mono text-xs">
                          {r.ticker}
                        </Badge>
                        <span className="truncate font-medium">{r.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{qty(r.purchased)}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{qty(r.sold)}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">{qty(r.remaining)}</TableCell>
                    <TableCell className="text-right tabular-nums">{money(r.avgCost)}</TableCell>
                    <TableCell className="px-4 text-right tabular-nums font-semibold">{money(r.cost)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
