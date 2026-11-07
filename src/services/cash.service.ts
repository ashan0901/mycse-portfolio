import { createClient } from "@/lib/supabase/client";
import { D, round } from "@/lib/decimal";
import type { CashMovement } from "@/types";

export type CashSummary = {
  deposited: number;
  withdrawn: number;
  adjustments: number;
  buyOutflow: number;
  sellInflow: number;
  balance: number;
};

export const cashService = {
  async list() {
    const sb = createClient();
    const { data, error } = await sb
      .from("cash_movements")
      .select("*")
      .order("movement_date", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data as CashMovement[]) ?? [];
  },

  async create(payload: Pick<CashMovement, "movement_type" | "movement_date" | "amount"> & { reference?: string; notes?: string }) {
    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    const amount = round(D(payload.amount));
    const { data, error } = await sb
      .from("cash_movements")
      .insert({ ...payload, amount, user_id: user!.id })
      .select()
      .single();
    if (error) throw error;
    return data as CashMovement;
  },

  async remove(id: string) {
    const sb = createClient();
    const { error } = await sb.from("cash_movements").delete().eq("id", id);
    if (error) throw error;
  },

  async summary(): Promise<CashSummary> {
    const sb = createClient();
    const [{ data: moves, error: mErr }, { data: txs, error: tErr }] = await Promise.all([
      sb.from("cash_movements").select("movement_type, amount"),
      sb.from("transactions").select("transaction_type, net_amount"),
    ]);
    if (mErr) throw mErr;
    if (tErr) throw tErr;

    let deposited = D(0), withdrawn = D(0), adjustments = D(0), buyOutflow = D(0), sellInflow = D(0);
    for (const m of moves || []) {
      const amt = D(m.amount || 0);
      if (m.movement_type === "DEPOSIT") deposited = deposited.plus(amt);
      else if (m.movement_type === "WITHDRAWAL") withdrawn = withdrawn.plus(amt);
      else adjustments = adjustments.plus(amt);
    }
    for (const t of txs || []) {
      const net = D(t.net_amount || 0);
      if (t.transaction_type === "BUY") buyOutflow = buyOutflow.plus(net);
      else sellInflow = sellInflow.plus(net);
    }
    const balance = deposited.plus(adjustments).plus(sellInflow).minus(withdrawn).minus(buyOutflow);
    return {
      deposited: round(deposited),
      withdrawn: round(withdrawn),
      adjustments: round(adjustments),
      buyOutflow: round(buyOutflow),
      sellInflow: round(sellInflow),
      balance: round(balance),
    };
  },
};
