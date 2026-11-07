"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Theme = "light" | "dark";

export default function SettingsPage() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const stored = localStorage.getItem("theme");
    const next: Theme = stored === "dark" ? "dark" : "light";
    setTheme(next);
    document.documentElement.classList.toggle("dark", next === "dark");
  }, []);

  function setMode(next: Theme) {
    setTheme(next);
    localStorage.setItem("theme", next);
    document.documentElement.classList.toggle("dark", next === "dark");
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">Settings</h2>
        <p className="text-sm text-muted-foreground">Personalize how the portfolio app looks and behaves.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader className="border-b">
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-1">
                <CardTitle>Appearance</CardTitle>
                <CardDescription>Choose the theme used across the dashboard.</CardDescription>
              </div>
              <Badge variant="secondary">{theme}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setMode("light")}
                className={`rounded-xl border p-4 text-left transition-colors ${
                  theme === "light" ? "border-foreground/20 bg-muted/50 ring-1 ring-foreground/10" : "hover:bg-muted/30"
                }`}
              >
                <div className="mb-3 h-20 rounded-lg border bg-white p-2">
                  <div className="h-2 w-16 rounded bg-slate-200" />
                  <div className="mt-2 space-y-1.5">
                    <div className="h-2 rounded bg-slate-100" />
                    <div className="h-2 w-4/5 rounded bg-slate-100" />
                  </div>
                </div>
                <p className="font-medium">Light</p>
                <p className="text-sm text-muted-foreground">Bright surfaces for daytime use.</p>
              </button>
              <button
                type="button"
                onClick={() => setMode("dark")}
                className={`rounded-xl border p-4 text-left transition-colors ${
                  theme === "dark" ? "border-foreground/20 bg-muted/50 ring-1 ring-foreground/10" : "hover:bg-muted/30"
                }`}
              >
                <div className="mb-3 h-20 rounded-lg border border-slate-700 bg-slate-950 p-2">
                  <div className="h-2 w-16 rounded bg-slate-700" />
                  <div className="mt-2 space-y-1.5">
                    <div className="h-2 rounded bg-slate-800" />
                    <div className="h-2 w-4/5 rounded bg-slate-800" />
                  </div>
                </div>
                <p className="font-medium">Dark</p>
                <p className="text-sm text-muted-foreground">Lower contrast for low-light environments.</p>
              </button>
            </div>
            <Button variant="outline" onClick={() => setMode(theme === "dark" ? "light" : "dark")}>
              Toggle theme
            </Button>
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader className="border-b">
            <CardTitle>About</CardTitle>
            <CardDescription>Application preferences.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-6 text-sm">
            <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
              <span className="text-muted-foreground">Theme storage</span>
              <span className="font-medium">Local browser</span>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
              <span className="text-muted-foreground">Currency display</span>
              <span className="font-medium">LKR</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
