"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { BarChart3, Briefcase, Building2, DollarSign, Home, Landmark, LogOut, Menu, Settings, Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: Home },
  { href: "/portfolio", label: "Portfolio", icon: Briefcase },
  { href: "/transactions", label: "Transactions", icon: DollarSign },
  { href: "/cds", label: "CDS / Cash", icon: Landmark },
  { href: "/buy", label: "Buy", icon: Wallet },
  { href: "/sell", label: "Sell", icon: Wallet },
  { href: "/companies", label: "Companies", icon: Building2 },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="space-y-1">
      {nav.map((n) => {
        const active = pathname === n.href || pathname.startsWith(`${n.href}/`);
        return (
          <Link
            key={n.href}
            href={n.href}
            onClick={onNavigate}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
              active ? "bg-accent text-accent-foreground font-medium" : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
            }`}
          >
            <n.icon className="h-4 w-4 shrink-0" /> <span>{n.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleLogout(closeNav?: () => void) {
    closeNav?.();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-background md:flex">
      <aside className="hidden w-64 shrink-0 border-r bg-card md:sticky md:top-0 md:flex md:h-screen md:flex-col md:overflow-y-auto">
        <div className="flex-1 p-5">
          <h1 className="mb-6 text-lg font-semibold tracking-tight">CSE Portfolio</h1>
          <NavLinks />
        </div>
        <div className="border-t p-4">
          <Button type="button" variant="ghost" className="w-full justify-start gap-3 text-muted-foreground hover:text-foreground" onClick={() => handleLogout()}>
            <LogOut className="h-4 w-4 shrink-0" />
            Log out
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Open navigation" />}>
              <Menu className="h-5 w-5" />
            </SheetTrigger>
            <SheetContent side="left" className="flex w-[min(85vw,20rem)] flex-col p-0">
              <SheetHeader className="border-b pr-12">
                <SheetTitle>CSE Portfolio</SheetTitle>
              </SheetHeader>
              <div className="flex-1 overflow-y-auto p-4">
                <NavLinks onNavigate={() => setOpen(false)} />
              </div>
              <div className="border-t p-4">
                <Button type="button" variant="ghost" className="w-full justify-start gap-3 text-muted-foreground hover:text-foreground" onClick={() => handleLogout(() => setOpen(false))}>
                  <LogOut className="h-4 w-4 shrink-0" />
                  Log out
                </Button>
              </div>
            </SheetContent>
          </Sheet>
          <span className="truncate text-sm font-semibold">CSE Portfolio</span>
        </header>

        <main className="min-w-0 flex-1 p-4 sm:p-5 md:p-6">{children}</main>
      </div>
    </div>
  );
}
