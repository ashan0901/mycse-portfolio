"use client";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ForgotPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) throw error;
      toast.success("Check your email for the reset link.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send reset link.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-svh items-center justify-center p-4 sm:p-6">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 border-b">
          <CardTitle className="text-2xl">Reset password</CardTitle>
          <CardDescription>We’ll email you a password reset link.</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>{loading ? "Sending…" : "Send reset link"}</Button>
          </form>
          <div className="mt-4 text-sm text-muted-foreground">
            <Link href="/login" className="hover:text-foreground">Back to sign in</Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

