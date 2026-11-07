"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { cashService, type CashSummary } from "@/services/cash.service";
import { companyService } from "@/services/company.service";
import { transactionService } from "@/services/transaction.service";
import { money } from "@/lib/decimal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

type Company = { id: string; ticker?: string; company_name?: string };
type FormState = {
  company_id: string;
  transaction_date: string;
  quantity: string;
  price_per_share: string;
  fees: string;
  notes: string;
};

const initial: FormState = {
  company_id: "",
  transaction_date: "",
  quantity: "",
  price_per_share: "",
  fees: "",
  notes: "",
};

function BuyPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");
  const [companies, setCompanies] = useState<Company[]>([]);
  const [cash, setCash] = useState<CashSummary | null>(null);
  const [f, setF] = useState<FormState>(initial);
  const [activeEditId, setActiveEditId] = useState<string | null>(null);
  const [loadedFees, setLoadedFees] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadingEdit, setLoadingEdit] = useState(!!editId);
  const rate = Number(process.env.NEXT_PUBLIC_FEE_RATE || 0.0112);

  if (editId !== activeEditId) {
    setActiveEditId(editId);
    setF(initial);
    setLoadedFees(null);
    setLoadingEdit(!!editId);
  }

  async function refreshCash() {
    setCash(await cashService.summary());
  }

  useEffect(() => {
    let active = true;
    (async () => {
      const [companyRows, cashSummary] = await Promise.all([companyService.list(), cashService.summary()]);
      if (!active) return;
      setCompanies((companyRows as Company[]) ?? []);
      setCash(cashSummary);
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!editId) return;
    let active = true;
    void (async () => {
      try {
        const tx = (await transactionService.get(editId)) as unknown as Record<string, unknown>;
        if (!active) return;
        if (tx.transaction_type !== "BUY") {
          toast.error("That transaction is not a buy record.");
          router.replace("/transactions");
          return;
        }
        setF({
          company_id: String(tx.company_id ?? ""),
          transaction_date: String(tx.transaction_date ?? ""),
          quantity: String(tx.quantity ?? ""),
          price_per_share: String(tx.price_per_share ?? ""),
          fees: String(tx.total_fees ?? ""),
          notes: String(tx.notes ?? ""),
        });
        setLoadedFees(String(tx.total_fees ?? ""));
      } catch (err) {
        if (active) toast.error(err instanceof Error ? err.message : "Could not load the buy transaction.");
      } finally {
        if (active) setLoadingEdit(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [editId, router]);

  const estimatedFees = useMemo(() => {
    const gross = Number(f.quantity || 0) * Number(f.price_per_share || 0);
    return gross > 0 ? (gross * rate).toFixed(2) : "";
  }, [f.quantity, f.price_per_share, rate]);

  const feesValue = editId && f.fees === loadedFees ? f.fees : f.fees || estimatedFees;

  const summary = useMemo(() => {
    const quantity = Number(f.quantity || 0);
    const price = Number(f.price_per_share || 0);
    const fees = Number(feesValue || 0);
    const gross = quantity * price;
    return { gross, fees, net: gross + fees };
  }, [f.quantity, f.price_per_share, feesValue]);

  function set(key: keyof FormState, value: string) {
    setF((prev) => ({ ...prev, [key]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!f.company_id) return toast.error("Select a company.");
    if (!f.transaction_date || Number(f.quantity) <= 0 || Number(f.price_per_share) <= 0) {
      return toast.error("Enter a valid date, quantity, and price.");
    }
    if (!editId && cash && summary.net > cash.balance + 1e-9) {
      return toast.error(`Insufficient CDS balance. Available ${money(cash.balance)}, required ${money(summary.net)}.`);
    }
    setSaving(true);
    try {
      const payload = {
        ...f,
        quantity: Number(f.quantity),
        price_per_share: Number(f.price_per_share),
        fees: Number(feesValue || 0),
      };
      if (editId) {
        await transactionService.updateBuy(editId, payload);
        toast.success("Buy transaction updated.");
        await refreshCash();
        router.push("/transactions");
      } else {
        await transactionService.createBuy(payload);
        toast.success("Buy transaction saved.");
        setF(initial);
        setLoadedFees(null);
        await refreshCash();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the buy transaction.");
    } finally {
      setSaving(false);
    }
  }

  const afterBuy = !editId && cash ? cash.balance - summary.net : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold tracking-tight">{editId ? "Edit Buy" : "Buy Shares"}</h2>
          <p className="text-sm text-muted-foreground">
            {editId ? "Update the buy transaction and recalculate stored amounts." : "Record a purchase using your available CDS cash balance."}
          </p>
        </div>
      <div className="flex flex-wrap items-center gap-2">
        {editId ? (
          <Link href="/transactions" className="border-input bg-background hover:bg-accent hover:text-accent-foreground inline-flex h-9 items-center justify-center rounded-md border px-4 text-sm font-medium shadow-xs">
            Cancel edit
          </Link>
        ) : null}
        <Badge variant="secondary" className="w-fit max-w-full px-3 py-1 text-sm">
          CDS available: {cash ? money(cash.balance) : "—"}
        </Badge>
      </div>
    </div>

      <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardHeader className="border-b">
            <CardTitle>{editId ? "Update purchase" : "Purchase details"}</CardTitle>
            <CardDescription>{loadingEdit ? "Loading transaction…" : "Fees are saved with the transaction."}</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="buy-company">Company</Label>
                <select
                  id="buy-company"
                  className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-md border px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
                  value={f.company_id}
                  onChange={(e) => set("company_id", e.target.value)}
                  disabled={loadingEdit}
                >
                  <option value="">Select company</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.ticker} - {c.company_name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="buy-date">Buy date</Label>
                <Input id="buy-date" type="date" value={f.transaction_date} onChange={(e) => set("transaction_date", e.target.value)} disabled={loadingEdit} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="buy-qty">Quantity</Label>
                <Input id="buy-qty" type="number" min="0" step="any" inputMode="decimal" value={f.quantity} onChange={(e) => set("quantity", e.target.value)} disabled={loadingEdit} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="buy-price">Price per share</Label>
                <Input id="buy-price" type="number" min="0" step="any" inputMode="decimal" value={f.price_per_share} onChange={(e) => set("price_per_share", e.target.value)} disabled={loadingEdit} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="buy-fees">Transaction fees</Label>
                <Input id="buy-fees" type="number" min="0" step="any" inputMode="decimal" value={feesValue} onChange={(e) => set("fees", e.target.value)} disabled={loadingEdit} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="buy-notes">Notes</Label>
                <Input id="buy-notes" placeholder="Optional" value={f.notes} onChange={(e) => set("notes", e.target.value)} disabled={loadingEdit} />
              </div>
              <div className="sm:col-span-2 flex justify-end">
                <Button type="submit" disabled={saving || loadingEdit}>{saving ? "Saving…" : editId ? "Update buy" : "Save buy"}</Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader className="border-b">
            <CardTitle>Summary</CardTitle>
            <CardDescription>{editId ? "Recalculated values for this transaction." : "Cash impact before saving."}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-6 text-sm">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <span className="text-muted-foreground">Gross amount</span>
              <span className="font-medium tabular-nums">{money(summary.gross || 0)}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <span className="text-muted-foreground">Fees ({(rate * 100).toFixed(2)}%)</span>
              <span className="font-medium tabular-nums">{money(summary.fees || 0)}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-3">
              <span className="font-medium">Net cost</span>
              <span className="text-base font-semibold tabular-nums">{money(summary.net || 0)}</span>
            </div>
            {!editId ? (
              <div className="flex items-center justify-between rounded-lg border p-3">
                <span className="text-muted-foreground">CDS after buy</span>
                <span className={`font-medium tabular-nums ${afterBuy != null && afterBuy < 0 ? "text-destructive" : ""}`}>
                  {afterBuy == null ? "—" : money(afterBuy)}
                </span>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function BuyPage() {
  return (
    <Suspense fallback={<div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-96 w-full" /></div>}>
      <BuyPageContent />
    </Suspense>
  );
}








