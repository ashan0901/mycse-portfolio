import Decimal from "decimal.js";
export const D = (v: number | string) => new Decimal(v);
export const round = (v: Decimal, dp = 4) => v.toDecimalPlaces(dp).toNumber();
export const money = (v: number) => new Intl.NumberFormat("en-LK", { style: "currency", currency: "LKR" }).format(v);
