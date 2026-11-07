"use client";

import { useEffect, useMemo, useState } from "react";
import { companyService } from "@/services/company.service";
import { money } from "@/lib/decimal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Company = {
  id: string;
  company_name?: string;
  ticker?: string;
  sector?: string;
  current_market_price?: number | string | null;
  notes?: string | null;
};

const emptyForm = { company_name: "", ticker: "", sector: "", notes: "" };

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const data = ((await companyService.list()) as Company[]) ?? [];
        if (active) setCompanies(data);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  async function reload() {
    setLoading(true);
    try {
      setCompanies(((await companyService.list()) as Company[]) ?? []);
    } finally {
      setLoading(false);
    }
  }

  async function add() {
    if (!form.company_name.trim() || !form.ticker.trim()) return;
    setSaving(true);
    try {
      await companyService.create({
        ...form,
        company_name: form.company_name.trim(),
        ticker: form.ticker.trim().toUpperCase(),
        sector: form.sector.trim(),
      } as never);
      setForm(emptyForm);
      await reload();
    } finally {
      setSaving(false);
    }
  }

  async function del(id: string) {
    setBusyId(id);
    try {
      await companyService.remove(id);
      await reload();
    } finally {
      setBusyId(null);
    }
  }

  const stats = useMemo(() => {
    const priced = companies.filter((c) => c.current_market_price != null && c.current_market_price !== "");
    const sectors = new Set(companies.map((c) => c.sector).filter(Boolean));
    return { count: companies.length, sectors: sectors.size, priced: priced.length };
  }, [companies]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold tracking-tight">Companies</h2>
          <p className="text-sm text-muted-foreground">Manage the companies you track and trade.</p>
        </div>
        <Badge variant="secondary" className="w-fit px-3 py-1 text-sm">
          {stats.count} {stats.count === 1 ? "company" : "companies"}
        </Badge>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="gap-3 py-4">
          <CardHeader className="pb-0">
            <CardDescription>Total companies</CardDescription>
            <CardTitle className="text-2xl">{loading ? "—" : stats.count}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="gap-3 py-4">
          <CardHeader className="pb-0">
            <CardDescription>Sectors tracked</CardDescription>
            <CardTitle className="text-2xl">{loading ? "—" : stats.sectors}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="gap-3 py-4">
          <CardHeader className="pb-0">
            <CardDescription>With market price</CardDescription>
            <CardTitle className="text-2xl">{loading ? "—" : stats.priced}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader className="border-b">
          <CardTitle>Add company</CardTitle>
          <CardDescription>Enter a company name and ticker to start tracking it.</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-[1.4fr_0.7fr_1fr_auto] md:items-end">
            <div className="space-y-2">
              <Label htmlFor="company-name">Name</Label>
              <Input
                id="company-name"
                placeholder="e.g. John Keells Holdings"
                value={form.company_name}
                onChange={(e) => setForm({ ...form, company_name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company-ticker">Ticker</Label>
              <Input
                id="company-ticker"
                placeholder="JKH.N0000"
                value={form.ticker}
                onChange={(e) => setForm({ ...form, ticker: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company-sector">Sector</Label>
              <Input
                id="company-sector"
                placeholder="Optional"
                value={form.sector}
                onChange={(e) => setForm({ ...form, sector: e.target.value })}
              />
            </div>
            <Button onClick={add} disabled={saving || !form.company_name.trim() || !form.ticker.trim()}>
              {saving ? "Adding…" : "Add company"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader className="border-b">
          <CardTitle>Company List</CardTitle>
          <CardDescription>Prices appear when market data is available.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-3 p-6">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : companies.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
              <p className="text-sm font-medium">No companies yet</p>
              <p className="max-w-sm text-sm text-muted-foreground">Add a company above to start recording transactions.</p>
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="px-4">Company</TableHead>
                  <TableHead>Sector</TableHead>
                  <TableHead className="text-right">Market price</TableHead>
                  <TableHead className="px-4 text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {companies.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="px-4">
                      <div className="flex min-w-0 items-center gap-3">
                        <Badge variant="outline" className="font-mono text-xs">
                          {c.ticker ?? "—"}
                        </Badge>
                        <span className="truncate font-medium">{c.company_name ?? "—"}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {c.sector ? <Badge variant="secondary">{c.sector}</Badge> : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {c.current_market_price != null && c.current_market_price !== ""
                        ? money(Number(c.current_market_price))
                        : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="px-4 text-right">
                      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" disabled={busyId === c.id} onClick={() => del(c.id)}>
                        {busyId === c.id ? "Removing…" : "Remove"}
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
  );
}

