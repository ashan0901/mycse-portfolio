"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { transactionService } from "@/services/transaction.service";
import { money } from "@/lib/decimal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type TransactionRow = {
  id: string;
  transaction_date?: string;
  transaction_type?: string;
  quantity?: number | string;
  price_per_share?: number | string;
  gross_amount?: number | string;
  total_fees?: number | string;
  net_amount?: number | string;
  realized_profit_loss?: number | string | null;
  companies?: { ticker?: string; company_name?: string } | null;
};

const qty = (value: number | string | undefined) =>
  new Intl.NumberFormat("en-LK", { maximumFractionDigits: 4 }).format(Number(value ?? 0));

const date = (value?: string) => {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

export default function TransactionsPage() {
  const [rows, setRows] = useState<TransactionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState<string | null>(null);

  useEffect(() => {
    transactionService
      .list()
      .then((data) => setRows((data as TransactionRow[]) ?? []))
      .finally(() => setLoading(false));
  }, []);

  async function handleRemove(r: TransactionRow) {
    const label = `${r.transaction_type ?? "Transaction"} ${r.companies?.ticker ?? ""}`.trim();
    const ok = window.confirm(
      `Remove ${label}? This permanently deletes the transaction record and will affect portfolio holdings, realized P&L, cash balance, analytics, and reports that use it.`
    );
    if (!ok) return;
    setRemovingId(r.id);
    try {
      await transactionService.remove(r.id);
      setRows((prev) => prev.filter((x) => x.id !== r.id));
      toast.success("Transaction removed.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not remove transaction.");
    } finally {
      setRemovingId(null);
    }
  }

  const totals = useMemo(() => {
    const buys = rows.filter((r) => r.transaction_type === "BUY");
    const sells = rows.filter((r) => r.transaction_type === "SELL");
    return {
      count: rows.length,
      buys: buys.length,
      sells: sells.length,
      fees: rows.reduce((sum, r) => sum + Number(r.total_fees ?? 0), 0),
      realized: sells.reduce((sum, r) => sum + Number(r.realized_profit_loss ?? 0), 0),
    };
  }, [rows]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold tracking-tight">Transactions</h2>
          <p className="text-sm text-muted-foreground">A history of your buy and sell activity.</p>
        </div>
        <Badge variant="secondary" className="w-fit px-3 py-1 text-sm">
          {totals.count} {totals.count === 1 ? "transaction" : "transactions"}
        </Badge>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="gap-3 py-4">
          <CardHeader className="pb-0">
            <CardDescription>Buy orders</CardDescription>
            <CardTitle className="text-2xl">{loading ? "—" : totals.buys}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="gap-3 py-4">
          <CardHeader className="pb-0">
            <CardDescription>Sell orders</CardDescription>
            <CardTitle className="text-2xl">{loading ? "—" : totals.sells}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="gap-3 py-4">
          <CardHeader className="pb-0">
            <CardDescription>Total fees</CardDescription>
            <CardTitle className="text-2xl">{loading ? "—" : money(totals.fees)}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="gap-3 py-4">
          <CardHeader className="pb-0">
            <CardDescription>Realized P&amp;L</CardDescription>
            <CardTitle className={`text-2xl ${!loading && totals.realized < 0 ? "text-destructive" : ""}`}>
              {loading ? "—" : money(totals.realized)}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="border-b">
          <CardTitle>Transaction History</CardTitle>
          <CardDescription>Amounts and fees are shown as recorded. Edit updates a record; Remove permanently deletes it and recalculates dependent views from remaining data.</CardDescription>
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
              <p className="text-sm font-medium">No transactions yet</p>
              <p className="max-w-sm text-sm text-muted-foreground">Buy and sell transactions will appear here.</p>
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="px-4">Date</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-right">Gross</TableHead>
                  <TableHead className="text-right">Fees</TableHead>
                  <TableHead className="text-right">Net</TableHead>
                  <TableHead className="text-right">P&amp;L</TableHead>
                  <TableHead className="px-4 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const pnl = r.realized_profit_loss == null ? null : Number(r.realized_profit_loss);
                  const isBuy = r.transaction_type === "BUY";
                  const editHref = isBuy ? `/buy?edit=${r.id}` : `/sell?edit=${r.id}`;
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="px-4 whitespace-nowrap text-muted-foreground">{date(r.transaction_date)}</TableCell>
                      <TableCell>
                        <div className="flex min-w-0 items-center gap-2">
                          <Badge variant="outline" className="font-mono text-xs">
                            {r.companies?.ticker ?? "—"}
                          </Badge>
                          <span className="hidden max-w-48 truncate text-sm text-muted-foreground lg:inline">
                            {r.companies?.company_name ?? ""}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={isBuy ? "secondary" : "outline"}>{r.transaction_type ?? "—"}</Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{qty(r.quantity)}</TableCell>
                      <TableCell className="text-right tabular-nums">{money(Number(r.price_per_share ?? 0))}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">{money(Number(r.gross_amount ?? 0))}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">{money(Number(r.total_fees ?? 0))}</TableCell>
                      <TableCell className="text-right tabular-nums font-medium">{money(Number(r.net_amount ?? 0))}</TableCell>
                      <TableCell className={`text-right tabular-nums font-medium ${pnl != null && pnl < 0 ? "text-destructive" : ""}`}>
                        {pnl == null ? <span className="text-muted-foreground">—</span> : money(pnl)}
                      </TableCell>
                      <TableCell className="px-4 text-right">
                        <div className="flex justify-end gap-2">
                          <Link href={editHref} className="border-input bg-background hover:bg-accent hover:text-accent-foreground inline-flex h-8 items-center justify-center rounded-md border px-3 text-sm font-medium shadow-xs">
                            Edit
                          </Link>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            disabled={removingId === r.id}
                            onClick={() => handleRemove(r)}
                          >
                            {removingId === r.id ? "Removing…" : "Remove"}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

