"use client";

import { useState } from "react";
import { toast } from "sonner";
import { cashService } from "@/services/cash.service";
import { transactionService } from "@/services/transaction.service";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function ReportsPage() {
  const [busy, setBusy] = useState<"tx" | "cash" | null>(null);

  async function exportTransactions() {
    setBusy("tx");
    try {
      const rows = (await transactionService.list()) as Array<Record<string, unknown>>;
      const header = ["Date", "Ticker", "Type", "Qty", "Price", "Gross", "Fees", "Net", "P&L"];
      const lines = [
        header.join(","),
        ...rows.map((r) =>
          [r.transaction_date, (r.companies as { ticker?: string } | null)?.ticker, r.transaction_type, r.quantity, r.price_per_share, r.gross_amount, r.total_fees, r.net_amount, r.realized_profit_loss]
            .map((v) => `"${String(v ?? "").replaceAll('"', '""')}"`)
            .join(","),
        ),
      ];
      const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "transactions.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not export transactions.");
    } finally {
      setBusy(null);
    }
  }

  async function exportCash() {
    setBusy("cash");
    try {
      const rows = await cashService.list();
      const header = ["Date", "Type", "Amount", "Reference", "Notes"];
      const lines = [
        header.join(","),
        ...rows.map((r) =>
          [r.movement_date, r.movement_type, r.amount, r.reference, r.notes]
            .map((v) => `"${String(v ?? "").replaceAll('"', '""')}"`)
            .join(","),
        ),
      ];
      const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "cds-movements.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not export CDS movements.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">Reports</h2>
        <p className="text-sm text-muted-foreground">Export trading and CDS cash records from the database.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="border-b">
            <CardTitle>Transactions</CardTitle>
            <CardDescription>Buy/sell history including fees, net amounts, and realized P&amp;L.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <Button onClick={exportTransactions} disabled={busy !== null}>
              {busy === "tx" ? "Exporting…" : "Export transactions CSV"}
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="border-b">
            <CardTitle>CDS movements</CardTitle>
            <CardDescription>Deposits, withdrawals, and adjustments recorded for CDS cash.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <Button onClick={exportCash} disabled={busy !== null} variant="outline">
              {busy === "cash" ? "Exporting…" : "Export CDS CSV"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

