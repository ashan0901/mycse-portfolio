import { D, money, round } from "@/lib/decimal";

export type ClosedTrade = {
  id: string;
  companyId: string;
  ticker: string;
  companyName: string;
  buyDate: string;
  sellDate: string;
  matchedQty: number;
  buyPrice: number;
  sellPrice: number;
  allocatedBuyFees: number;
  allocatedSellFees: number;
  totalBuyCost: number;
  netSellProceeds: number;
  realizedPnl: number;
  returnPct: number;
};

export type InvalidSell = {
  id: string;
  ticker: string;
  date: string;
  requested: number;
  available: number;
};

export type FifoResult = {
  trades: ClosedTrade[];
  invalidSells: InvalidSell[];
};

type Tx = {
  id: string;
  company_id: string;
  transaction_type: "BUY" | "SELL";
  transaction_date: string;
  created_at?: string;
  quantity: number | string;
  price_per_share: number | string;
  total_fees?: number | string;
  companies?: { ticker?: string; company_name?: string } | null;
};

function sortTx(a: Tx, b: Tx) {
  const da = String(a.transaction_date ?? "");
  const db = String(b.transaction_date ?? "");
  if (da !== db) return da.localeCompare(db);
  return String(a.created_at ?? "").localeCompare(String(b.created_at ?? ""));
}

export function buildClosedTrades(transactions: Tx[]): FifoResult {
  const trades: ClosedTrade[] = [];
  const invalidSells: InvalidSell[] = [];

  const byCompany = new Map<string, Tx[]>();
  for (const t of transactions) {
    const id = String(t.company_id ?? "");
    if (!id) continue;
    if (!byCompany.has(id)) byCompany.set(id, []);
    byCompany.get(id)!.push(t);
  }

  let counter = 0;
  for (const [companyId, txs] of byCompany) {
    const buys = txs.filter((t) => t.transaction_type === "BUY").sort(sortTx);
    const sells = txs.filter((t) => t.transaction_type === "SELL").sort(sortTx);

    const remaining = buys.map((b) => ({ tx: b, qty: D(b.quantity) }));

    for (const sell of sells) {
      let toSell = D(sell.quantity);
      const available = remaining.reduce((s, r) => s.plus(r.qty), D(0));
      if (toSell.gt(available)) {
        invalidSells.push({
          id: sell.id,
          ticker: sell.companies?.ticker ?? "",
          date: sell.transaction_date,
          requested: round(toSell),
          available: round(available),
        });
        toSell = available;
      }
      if (toSell.lte(0)) continue;

      const sellFeesTotal = D(sell.total_fees ?? 0);
      const sellQtyTotal = D(sell.quantity);

      for (const r of remaining) {
        if (toSell.lte(0)) break;
        if (r.qty.lte(0)) continue;
        const match = toSell.lt(r.qty) ? toSell : r.qty;

        const buyFeesTotal = D(r.tx.total_fees ?? 0);
        const buyQtyTotal = D(r.tx.quantity);
        const allocatedBuyFees = buyFeesTotal.times(match).div(buyQtyTotal);
        const allocatedSellFees = sellFeesTotal.times(match).div(sellQtyTotal);
        const allocatedBuyCost = D(r.tx.price_per_share).times(match).plus(allocatedBuyFees);
        const allocatedSellProceeds = D(sell.price_per_share).times(match).minus(allocatedSellFees);
        const realizedPnl = allocatedSellProceeds.minus(allocatedBuyCost);
        const returnPct = allocatedBuyCost.gt(0) ? realizedPnl.div(allocatedBuyCost).times(100) : D(0);

        trades.push({
          id: `M${++counter}`,
          companyId,
          ticker: sell.companies?.ticker ?? r.tx.companies?.ticker ?? "",
          companyName: sell.companies?.company_name ?? r.tx.companies?.company_name ?? "",
          buyDate: r.tx.transaction_date,
          sellDate: sell.transaction_date,
          matchedQty: round(match, 4),
          buyPrice: round(D(r.tx.price_per_share), 4),
          sellPrice: round(D(sell.price_per_share), 4),
          allocatedBuyFees: round(allocatedBuyFees),
          allocatedSellFees: round(allocatedSellFees),
          totalBuyCost: round(allocatedBuyCost),
          netSellProceeds: round(allocatedSellProceeds),
          realizedPnl: round(realizedPnl),
          returnPct: round(returnPct, 2),
        });

        r.qty = r.qty.minus(match);
        toSell = toSell.minus(match);
      }
    }
  }

  trades.sort((a, b) => b.sellDate.localeCompare(a.sellDate) || b.buyDate.localeCompare(a.buyDate));
  return { trades, invalidSells };
}