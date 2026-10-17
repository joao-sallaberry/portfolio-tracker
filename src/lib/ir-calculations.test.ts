import { describe, it, expect } from 'vitest';
import { calculateGrandTotals, calculateSalesByTaxGroup, type IrTrade } from './ir-calculations';

let nextId = 0;
const trade = (
  ticker: string,
  trade_date: string,
  movement_type: string,
  quantity: number,
  price: number,
  extra: Partial<IrTrade> = {},
): IrTrade => ({
  id: String(++nextId).padStart(4, '0'),
  ticker,
  trade_date,
  movement_type,
  quantity,
  price,
  total_value: quantity * price,
  ...extra,
});

describe('calculateSalesByTaxGroup', () => {
  it('charges 15% on stock profit when monthly sales exceed R$20k', () => {
    const months = calculateSalesByTaxGroup([
      trade('PETR4', '2025-01-10', 'BUY', 1000, 30),
      trade('PETR4', '2025-02-10', 'SELL', 1000, 40),
    ], 'Ações e ETFs', 2025);

    expect(months).toHaveLength(1);
    expect(months[0].monthKey).toBe('2025-02');
    expect(months[0].total_sales).toBe(40000);
    expect(months[0].total_profit_loss).toBe(10000);
    expect(months[0].total_tax_due).toBeCloseTo(1500);
    expect(months[0].has_exemption).toBe(false);
    expect(months[0].sales[0].average_price_at_sale).toBe(30);
  });

  it('exempts stock profit when monthly stock sales are up to R$20k', () => {
    const months = calculateSalesByTaxGroup([
      trade('PETR4', '2025-01-10', 'BUY', 1000, 30),
      trade('PETR4', '2025-02-10', 'SELL', 500, 35),
    ], 'Ações e ETFs', 2025);

    expect(months[0].total_sales).toBe(17500);
    expect(months[0].has_exemption).toBe(true);
    expect(months[0].total_tax_due).toBe(0);
    expect(months[0].sales[0].tax_due).toBe(0);
    expect(calculateGrandTotals(months).total_exempt_profit).toBe(2500);
  });

  it('does not apply the R$20k exemption to ETFs', () => {
    const months = calculateSalesByTaxGroup([
      trade('BOVA11', '2025-01-10', 'BUY', 100, 100),
      trade('BOVA11', '2025-02-10', 'SELL', 100, 110),
    ], 'Ações e ETFs', 2025);

    expect(months[0].total_sales).toBe(11000);
    expect(months[0].has_exemption).toBe(false);
    expect(months[0].total_tax_due).toBeCloseTo(150);
  });

  it('nets earlier losses in the month against later gains', () => {
    const months = calculateSalesByTaxGroup([
      trade('VALE3', '2025-01-10', 'BUY', 1000, 60),
      trade('PETR4', '2025-01-10', 'BUY', 1000, 30),
      trade('VALE3', '2025-03-05', 'SELL', 1000, 50), // -10.000
      trade('PETR4', '2025-03-20', 'SELL', 1000, 45), // +15.000
    ], 'Ações e ETFs', 2025);

    const [march] = months;
    expect(march.total_profit_loss).toBe(5000);
    expect(march.sales.map((s) => s.ticker)).toEqual(['VALE3', 'PETR4']);
    expect(march.sales[1].tax_due).toBeCloseTo(750); // 15% of the 5.000 left after the loss
    expect(march.total_tax_due).toBeCloseTo(750);
  });

  it('tracks the accumulated loss across months, starting from the initial loss', () => {
    const months = calculateSalesByTaxGroup([
      trade('VALE3', '2025-01-10', 'BUY', 2000, 60),
      trade('VALE3', '2025-04-10', 'SELL', 1000, 55), // -5.000
      trade('VALE3', '2025-05-10', 'SELL', 1000, 62), // +2.000
    ], 'Ações e ETFs', 2025, -1000);

    expect(months.map((m) => m.accumulated_loss)).toEqual([-6000, -4000]);
  });

  it('never lets the accumulated loss become positive', () => {
    const months = calculateSalesByTaxGroup([
      trade('VALE3', '2025-01-10', 'BUY', 2000, 60),
      trade('VALE3', '2025-04-10', 'SELL', 1000, 59), // -1.000
      trade('VALE3', '2025-05-10', 'SELL', 1000, 70), // +10.000
    ], 'Ações e ETFs', 2025);

    expect(months.map((m) => m.accumulated_loss)).toEqual([-1000, 0]);
  });

  it('does not let exempt profit reduce the accumulated loss', () => {
    const months = calculateSalesByTaxGroup([
      trade('VALE3', '2025-01-10', 'BUY', 1000, 60),
      trade('PETR4', '2025-01-10', 'BUY', 1000, 30),
      trade('VALE3', '2025-04-10', 'SELL', 1000, 55), // -5.000, R$55k sales
      trade('PETR4', '2025-05-10', 'SELL', 500, 35), // +2.500, exempt
    ], 'Ações e ETFs', 2025);

    expect(months[1].has_exemption).toBe(true);
    expect(months.map((m) => m.accumulated_loss)).toEqual([-5000, -5000]);
  });

  it('lists excluded sales without counting them', () => {
    const months = calculateSalesByTaxGroup([
      trade('PETR4', '2025-01-10', 'BUY', 1000, 30),
      trade('PETR4', '2025-02-10', 'SELL', 1000, 40, { exclude_from_ir: true }),
    ], 'Ações e ETFs', 2025);

    const [sale] = months[0].sales;
    expect(sale.excluded_from_ir).toBe(true);
    expect(sale.profit_loss).toBe(0);
    expect(sale.tax_due).toBe(0);
    expect(sale.economic_profit_loss).toBe(10000);
    expect(sale.economic_tax_due).toBeCloseTo(1500);
    expect(months[0].total_sales).toBe(0);
    expect(months[0].total_tax_due).toBe(0);
    expect(months[0].has_exemption).toBe(false);
  });

  it('keeps excluded sales in the average price of later sales', () => {
    const months = calculateSalesByTaxGroup([
      trade('PETR4', '2025-01-10', 'BUY', 100, 10),
      trade('PETR4', '2025-01-11', 'BUY', 100, 30),
      trade('PETR4', '2025-02-10', 'SELL', 100, 40, { exclude_from_ir: true }),
      trade('PETR4', '2025-03-10', 'SELL', 100, 40),
    ], 'Ações e ETFs', 2025);

    expect(months[1].sales[0].average_price_at_sale).toBe(20);
  });

  it('flags oversold sales and charges no tax on them', () => {
    const months = calculateSalesByTaxGroup([
      trade('PETR4', '2025-01-10', 'BUY', 100, 30),
      trade('PETR4', '2025-02-10', 'SELL', 1000, 40),
    ], 'Ações e ETFs', 2025);

    const [sale] = months[0].sales;
    expect(sale.oversold_position).toBe(true);
    expect(sale.tax_due).toBe(0);
    expect(months[0].total_tax_due).toBe(0);
  });

  it('only reports sales of the selected year, using earlier trades for the average price', () => {
    const trades = [
      trade('PETR4', '2024-01-10', 'BUY', 1000, 30),
      trade('PETR4', '2024-06-10', 'SELL', 500, 40),
      trade('PETR4', '2025-02-10', 'SELL', 500, 50),
    ];

    const months = calculateSalesByTaxGroup(trades, 'Ações e ETFs', 2025);
    expect(months).toHaveLength(1);
    expect(months[0].sales[0].average_price_at_sale).toBe(30);
    expect(months[0].sales[0].profit_loss).toBe(10000);
    expect(calculateSalesByTaxGroup(trades, 'Ações e ETFs', 2023)).toEqual([]);
  });

  it('charges 20% on FIIs without the R$20k exemption', () => {
    const months = calculateSalesByTaxGroup([
      trade('MXRF11', '2025-01-10', 'BUY', 1000, 10),
      trade('MXRF11', '2025-02-10', 'SELL', 1000, 11),
      trade('PETR4', '2025-01-10', 'BUY', 100, 30),
      trade('PETR4', '2025-02-10', 'SELL', 100, 40),
    ], 'FIIs', 2025);

    expect(months[0].sales.map((s) => s.ticker)).toEqual(['MXRF11']);
    expect(months[0].has_exemption).toBe(false);
    expect(months[0].total_tax_due).toBeCloseTo(200);
  });

  it('charges no tax on exempt funds', () => {
    const months = calculateSalesByTaxGroup([
      trade('KDIF11', '2025-01-10', 'BUY', 100, 100),
      trade('KDIF11', '2025-02-10', 'SELL', 100, 150),
    ], 'Isentos', 2025);

    expect(months[0].total_profit_loss).toBe(5000);
    expect(months[0].total_tax_due).toBe(0);
  });
});

describe('calculateGrandTotals', () => {
  it('sums the months', () => {
    const months = calculateSalesByTaxGroup([
      trade('PETR4', '2025-01-10', 'BUY', 2000, 30),
      trade('PETR4', '2025-02-10', 'SELL', 1000, 40), // +10.000, taxed
      trade('PETR4', '2025-03-10', 'SELL', 500, 35), // +2.500, exempt
    ], 'Ações e ETFs', 2025);

    const totals = calculateGrandTotals(months);
    expect(totals.total_sales).toBe(57500);
    expect(totals.total_profit_loss).toBe(12500);
    expect(totals.total_tax_due).toBeCloseTo(1500);
    expect(totals.total_exempt_profit).toBe(2500);
  });

  it('returns zeros for no months', () => {
    expect(calculateGrandTotals([])).toEqual({ total_sales: 0, total_profit_loss: 0, total_tax_due: 0, total_exempt_profit: 0 });
  });
});
