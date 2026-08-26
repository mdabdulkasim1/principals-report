"use strict";
/**
 * Single source of truth for money. The browser shows a live preview using the
 * same rules, but every stored total is recomputed here so a tampered or stale
 * client can never decide what a bill is worth.
 */

function money(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function clampQty(q) {
  const n = Math.floor(Number(q) || 0);
  return Math.min(Math.max(n, 0), 999);
}

/**
 * @param {Array} lines  [{ price, qty }]
 * @param {Object} order { discountType:'amount'|'percent', discountValue }
 * @param {Object} settings
 */
function computeTotals(lines, order, settings) {
  const s = settings || {};
  const subtotal = money(
    (lines || []).reduce((sum, l) => sum + (Number(l.price) || 0) * clampQty(l.qty), 0)
  );

  const type = order && order.discountType === "percent" ? "percent" : "amount";
  const value = Math.max(0, Number((order && order.discountValue) || 0));
  let discount = type === "percent" ? (subtotal * Math.min(value, 100)) / 100 : value;
  discount = money(Math.min(discount, subtotal));

  const taxable = money(subtotal - discount);

  const scPercent = s.serviceChargeEnabled ? Math.max(0, Number(s.serviceChargePercent) || 0) : 0;
  const serviceCharge = money((taxable * scPercent) / 100);

  const taxPercent = s.taxEnabled ? Math.max(0, Number(s.taxPercent) || 0) : 0;
  const tax = money(((taxable + serviceCharge) * taxPercent) / 100);

  const gross = money(taxable + serviceCharge + tax);
  const total = s.roundOff === false ? gross : Math.round(gross);
  const roundOff = money(total - gross);

  return {
    subtotal,
    discountType: type,
    discountValue: value,
    discount,
    serviceChargePercent: scPercent,
    serviceCharge,
    taxName: s.taxName || "Tax",
    taxPercent,
    tax,
    roundOff,
    total: money(total),
    itemCount: (lines || []).reduce((n, l) => n + clampQty(l.qty), 0),
  };
}

module.exports = { computeTotals, money, clampQty };
