export const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export const num = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

export const pct = new Intl.NumberFormat("en-US", {
  style: "percent",
  maximumFractionDigits: 1,
});

export function formatValue(value, type = "money") {
  if (type === "percent") return pct.format(value);
  if (type === "number") return num.format(value);
  if (type === "decimal") return value.toFixed(2);
  return money.format(value);
}
