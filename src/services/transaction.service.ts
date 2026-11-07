import { createClient } from "@/lib/supabase/client";
import { D, round } from "@/lib/decimal";
import type { Transaction } from "@/types";

type TxPayload = {
  company_id: string;
  transaction_date: string;
  quantity: number | string;
  price_per_share: number | string;
  fees?: number | string;
  total_fees?: number | string;
  notes?: string;
};

async function holdingsCost(companyId: string, upToDate?: string, excludeId?: string) {
  const sb = createClient();
  let q = sb.from("transactions").select("*").eq("company_id", companyId).order("transaction_date").order("created_at");
  if (upToDate) q = q.lte("transaction_date", upToDate);
  const { data } = await q;
  let qty = D(0), cost = D(0);
  for (const t of data || []) {
    if (excludeId && t.id === excludeId) continue;
    if (t.transaction_type === "BUY") { qty = qty.plus(t.quantity); cost = cost.plus(t.net_amount); }
    else {
      const alloc = qty.gt(0) ? cost.times(t.quantity).div(qty) : D(0);
      qty = qty.minus(t.quantity); cost = cost.minus(alloc);
    }
  }
  return { qty, cost };
}

export const transactionService = {
  async list() {
    const sb = createClient();
    const { data, error } = await sb.from("transactions").select("*, companies(ticker, company_name)").order("transaction_date", { ascending: false }).order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  },
  async get(id: string) {
    const sb = createClient();
    const { data, error } = await sb.from("transactions").select("*, companies(ticker, company_name)").eq("id", id).single();
    if (error) throw error;
    return data as Transaction;
  },
  async holdingsCost(companyId: string, upToDate?: string, excludeId?: string) {
    return holdingsCost(companyId, upToDate, excludeId);
  },
  async createBuy(payload: TxPayload) {
    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    const gross = D(payload.quantity).times(payload.price_per_share);
    const totalFees = D(payload.fees ?? payload.total_fees ?? 0);
    const net = gross.plus(totalFees);
    const { fees: _f, total_fees: _tf, ...rest } = payload as TxPayload & { total_fees?: number | string };
    void _f; void _tf;
    const { data, error } = await sb.from("transactions").insert({
      ...rest, user_id: user!.id, transaction_type: "BUY",
      quantity: round(D(payload.quantity), 4), price_per_share: round(D(payload.price_per_share), 4),
      gross_amount: round(gross), total_fees: round(totalFees), net_amount: round(net),
      cost_basis: null, realized_profit_loss: null,
    }).select().single();
    if (error) throw error;
    return data as Transaction;
  },
  async updateBuy(id: string, payload: TxPayload) {
    const sb = createClient();
    const gross = D(payload.quantity).times(payload.price_per_share);
    const totalFees = D(payload.fees ?? payload.total_fees ?? 0);
    const net = gross.plus(totalFees);
    const { fees: _f, total_fees: _tf, ...rest } = payload as TxPayload & { total_fees?: number | string };
    void _f; void _tf;
    const { data, error } = await sb.from("transactions").update({
      ...rest,
      quantity: round(D(payload.quantity), 4), price_per_share: round(D(payload.price_per_share), 4),
      gross_amount: round(gross), total_fees: round(totalFees), net_amount: round(net),
      cost_basis: null, realized_profit_loss: null,
    }).eq("id", id).eq("transaction_type", "BUY").select().single();
    if (error) throw error;
    return data as Transaction;
  },
  async createSell(payload: TxPayload) {
    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    const { qty: availQty, cost: availCost } = await holdingsCost(payload.company_id, payload.transaction_date);
    const sellQty = D(payload.quantity);
    if (sellQty.gt(availQty) && sellQty.minus(availQty).abs().gt(D("1e-9"))) {
      throw new Error(`Cannot sell ${sellQty.toString()} shares. Only ${availQty.toDecimalPlaces(6).toString()} available on or before ${payload.transaction_date}.`);
    }
    const qtyToSell = sellQty.gt(availQty) ? availQty : sellQty;
    const gross = sellQty.times(payload.price_per_share);
    const totalFees = D(payload.fees ?? payload.total_fees ?? 0);
    const net = gross.minus(totalFees);
    const costBasis = availQty.gt(0) ? availCost.times(qtyToSell).div(availQty) : D(0);
    const realized = net.minus(costBasis);
    const { fees: _f, total_fees: _tf, ...rest } = payload as TxPayload & { total_fees?: number | string };
    void _f; void _tf;
    const { data, error } = await sb.from("transactions").insert({
      ...rest, user_id: user!.id, transaction_type: "SELL",
      quantity: round(qtyToSell, 4), price_per_share: round(D(payload.price_per_share), 4),
      gross_amount: round(gross), total_fees: round(totalFees), net_amount: round(net),
      cost_basis: round(costBasis), realized_profit_loss: round(realized),
    }).select().single();
    if (error) throw error;
    return data as Transaction;
  },
  async updateSell(id: string, payload: TxPayload) {
    const sb = createClient();
    const { qty: availQty, cost: availCost } = await holdingsCost(payload.company_id, payload.transaction_date, id);
    const sellQty = D(payload.quantity);
    if (sellQty.gt(availQty) && sellQty.minus(availQty).abs().gt(D("1e-9"))) {
      throw new Error(`Cannot sell ${sellQty.toString()} shares. Only ${availQty.toDecimalPlaces(6).toString()} available on or before ${payload.transaction_date}.`);
    }
    const qtyToSell = sellQty.gt(availQty) ? availQty : sellQty;
    const gross = sellQty.times(payload.price_per_share);
    const totalFees = D(payload.fees ?? payload.total_fees ?? 0);
    const net = gross.minus(totalFees);
    const costBasis = availQty.gt(0) ? availCost.times(qtyToSell).div(availQty) : D(0);
    const realized = net.minus(costBasis);
    const { fees: _f, total_fees: _tf, ...rest } = payload as TxPayload & { total_fees?: number | string };
    void _f; void _tf;
    const { data, error } = await sb.from("transactions").update({
      ...rest,
      quantity: round(qtyToSell, 4), price_per_share: round(D(payload.price_per_share), 4),
      gross_amount: round(gross), total_fees: round(totalFees), net_amount: round(net),
      cost_basis: round(costBasis), realized_profit_loss: round(realized),
    }).eq("id", id).eq("transaction_type", "SELL").select().single();
    if (error) throw error;
    return data as Transaction;
  },
  async remove(id: string) {
    const sb = createClient();
    const { error } = await sb.from("transactions").delete().eq("id", id);
    if (error) throw error;
  },
};






