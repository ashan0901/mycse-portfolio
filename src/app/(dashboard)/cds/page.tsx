"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { cashService, type CashSummary } from "@/services/cash.service";
import { money } from "@/lib/decimal";
import type { CashMovement, CashMovementType } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const emptySummary: CashSummary = {
  deposited: 0,
  withdrawn: 0,
  adjustments: 0,
  buyOutflow: 0,
  sellInflow: 0,
  balance: 0,
};

const typeLabel: Record<CashMovementType, string> = {
  DEPOSIT: "Deposit",
  WITHDRAWAL: "Withdrawal",
  ADJUSTMENT: "Adjustment",
};

const date = (value?: string) => {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

export default function CdsPage() {
  const [moves, setMoves] = useState<CashMovement[]>([]);
  const [summary, setSummary] = useState<CashSummary>(emptySummary);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [form, setForm] = useState({
    movement_type: "DEPOSIT" as CashMovementType,
    movement_date: "",
    amount: "",
    reference: "",
    notes: "",
  });

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const [rows, sum] = await Promise.all([cashService.list(), cashService.summary()]);
        if (!active) return;
        setMoves(rows);
        setSummary(sum);
      } catch (err) {
        if (active) toast.error(err instanceof Error ? err.message : "Could not load CDS data.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  async function load() {
    setLoading(true);
    try {
      const [rows, sum] = await Promise.all([cashService.list(), cashService.summary()]);
      setMoves(rows);
      setSummary(sum);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not load CDS data.");
    } finally {
      setLoading(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.movement_date || Number(form.amount) <= 0) return toast.error("Enter a valid date and amount.");
    setSaving(true);
    try {
      await cashService.create({
        movement_type: form.movement_type,
        movement_date: form.movement_date,
        amount: Number(form.amount),
        reference: form.reference.trim() || undefined,
        notes: form.notes.trim() || undefined,
      });
      toast.success("CDS movement saved.");
      setForm({ movement_type: "DEPOSIT", movement_date: "", amount: "", reference: "", notes: "" });
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the movement.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    setBusyId(id);
    try {
      await cashService.remove(id);
      toast.success("Movement removed.");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not remove the movement.");
    } finally {
      setBusyId(null);
    }
  }

  const totals = useMemo(
    () => [
      { label: "Available CDS balance", value: money(summary.balance), hint: "Deposits + adjustments + sell proceeds − withdrawals − buy costs.", tone: summary.balance < 0 ? "negative" : undefined },
      { label: "Total deposited", value: money(summary.deposited), hint: "Cash transferred to your broker/CDS account." },
      { label: "Trading outflow", value: money(summary.buyOutflow), hint: "Buy net amounts including fees, from transactions." },
      { label: "Trading inflow", value: money(summary.sellInflow), hint: "Sell net proceeds after fees, from transactions." },
    ],
    [summary],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold tracking-tight">CDS / Cash</h2>
          <p className="text-sm text-muted-foreground">Track deposits to your broker and the cash available for trading.</p>
        </div>
        <Badge variant="secondary" className="w-fit px-3 py-1 text-sm">
          {loading ? "Loading…" : money(summary.balance)} available
        </Badge>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {totals.map((item) => (
          <Card key={item.label} className="gap-3 py-4">
            <CardHeader className="pb-0">
              <CardDescription>{item.label}</CardDescription>
              <CardTitle className={`text-2xl tracking-tight ${!loading && item.tone === "negative" ? "text-destructive" : ""}`}>
                {loading ? "—" : item.value}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-xs text-muted-foreground">{item.hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <Card>
          <CardHeader className="border-b">
            <CardTitle>Add movement</CardTitle>
            <CardDescription>Record a deposit, withdrawal, or adjustment for your CDS account.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={submit} className="grid gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="cash-type">Type</Label>
                  <select
                    id="cash-type"
                    className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-md border px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
                    value={form.movement_type}
                    onChange={(e) => setForm({ ...form, movement_type: e.target.value as CashMovementType })}
                  >
                    <option value="DEPOSIT">Deposit</option>
                    <option value="WITHDRAWAL">Withdrawal</option>
                    <option value="ADJUSTMENT">Adjustment</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cash-date">Date</Label>
                  <Input id="cash-date" type="date" value={form.movement_date} onChange={(e) => setForm({ ...form, movement_date: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cash-amount">Amount (LKR)</Label>
                <Input id="cash-amount" type="number" min="0" step="any" inputMode="decimal" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cash-ref">Reference</Label>
                <Input id="cash-ref" placeholder="Optional transfer/reference no." value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cash-notes">Notes</Label>
                <Input id="cash-notes" placeholder="Optional" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
              <div className="flex justify-end">
                <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save movement"}</Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader className="border-b">
            <CardTitle>Cash movements</CardTitle>
            <CardDescription>Deposits and withdrawals recorded for this account.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="space-y-3 p-6">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : moves.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
                <p className="text-sm font-medium">No CDS movements yet</p>
                <p className="max-w-sm text-sm text-muted-foreground">Add a deposit when you transfer money to your broker.</p>
              </div>
            ) : (
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="px-4">Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead className="px-4 text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {moves.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="px-4 whitespace-nowrap text-muted-foreground">{date(m.movement_date)}</TableCell>
                      <TableCell>
                        <Badge variant={m.movement_type === "DEPOSIT" ? "secondary" : "outline"}>{typeLabel[m.movement_type]}</Badge>
                      </TableCell>
                      <TableCell className={`text-right tabular-nums font-medium ${m.movement_type === "WITHDRAWAL" ? "text-destructive" : ""}`}>
                        {m.movement_type === "WITHDRAWAL" ? "-" : ""}
                        {money(Number(m.amount))}
                      </TableCell>
                      <TableCell className="max-w-40 truncate text-muted-foreground">{m.reference || "—"}</TableCell>
                      <TableCell className="px-4 text-right">
                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" disabled={busyId === m.id} onClick={() => remove(m.id)}>
                          {busyId === m.id ? "Removing…" : "Remove"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
