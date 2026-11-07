export type TxType = "BUY" | "SELL";
export type CashMovementType = "DEPOSIT" | "WITHDRAWAL" | "ADJUSTMENT";

export interface Company {
  id: string; user_id: string; company_name: string; ticker: string;
  sector?: string; description?: string; current_market_price?: number;
  notes?: string; created_at: string; updated_at: string;
}

export interface Transaction {
  id: string; user_id: string; company_id: string; transaction_type: TxType;
  transaction_date: string; quantity: number; price_per_share: number;
  gross_amount: number; total_fees: number; net_amount: number;
  cost_basis?: number; realized_profit_loss?: number; notes?: string;
  companies?: { ticker?: string; company_name?: string };
}

export interface CashMovement {
  id: string;
  user_id: string;
  movement_type: CashMovementType;
  movement_date: string;
  amount: number;
  reference?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

