import { describe, it, expect } from 'vitest';
import { calculatePositions, type TradeForCalculation } from './portfolio-calculations';

describe('calculatePositions', () => {
  it('should return empty array for null or empty trades', () => {
    expect(calculatePositions(null)).toEqual([]);
    expect(calculatePositions([])).toEqual([]);
  });

  it('should calculate positions correctly for a single buy', () => {
    const trades: TradeForCalculation[] = [
      {
        ticker: 'PETR4',
        quantity: 100,
        total_value: 3000,
        movement_type: 'BUY',
        trade_date: '2023-01-01',
      },
    ];

    const positions = calculatePositions(trades);
    
    expect(positions).toHaveLength(1);
    expect(positions[0].ticker).toBe('PETR4');
    expect(positions[0].quantity).toBe(100);
    expect(positions[0].avgPrice).toBe(30);
    expect(positions[0].totalValue).toBe(3000);
  });

  it('should aggregate multiple buys correctly', () => {
    const trades: TradeForCalculation[] = [
      {
        ticker: 'PETR4',
        quantity: 100,
        total_value: 3000, // 30 per share
        movement_type: 'BUY',
        trade_date: '2023-01-01',
      },
      {
        ticker: 'PETR4',
        quantity: 100,
        total_value: 4000, // 40 per share
        movement_type: 'BUY',
        trade_date: '2023-01-02',
      },
    ];

    const positions = calculatePositions(trades);
    
    expect(positions).toHaveLength(1);
    expect(positions[0].quantity).toBe(200);
    expect(positions[0].avgPrice).toBe(35); // (3000 + 4000) / 200 = 35
    expect(positions[0].totalValue).toBe(7000);
  });

  it('should calculate moving average correctly when selling', () => {
    const trades: TradeForCalculation[] = [
      {
        ticker: 'PETR4',
        quantity: 100,
        total_value: 3000, // avg 30
        movement_type: 'BUY',
        trade_date: '2023-01-01',
      },
      {
        ticker: 'PETR4',
        quantity: 100,
        total_value: 4000, // avg 35
        movement_type: 'BUY',
        trade_date: '2023-01-02',
      },
      {
        ticker: 'PETR4',
        quantity: 50, // sell 50 shares
        total_value: 2500, // Sold at 50, but cost basis removed should be 50 * avg(35) = 1750
        movement_type: 'SELL',
        trade_date: '2023-01-03',
      },
    ];

    const positions = calculatePositions(trades);
    
    expect(positions).toHaveLength(1);
    expect(positions[0].quantity).toBe(150); // 200 - 50
    // Total value was 7000. Sold 50 shares. Cost removed: 50 * 35 = 1750.
    // Remaining value: 7000 - 1750 = 5250.
    // Avg price: 5250 / 150 = 35
    expect(positions[0].avgPrice).toBe(35);
    expect(positions[0].totalValue).toBe(5250);
  });

  it('should sort trades by date before calculating', () => {
    const trades: TradeForCalculation[] = [
      {
        ticker: 'VALE3',
        quantity: 100,
        total_value: 7000, // avg 70 (Chronologically second)
        movement_type: 'BUY',
        trade_date: '2023-02-01',
      },
      {
        ticker: 'VALE3',
        quantity: 50,
        total_value: 4000, // Sold chronologically third
        movement_type: 'SELL',
        trade_date: '2023-03-01',
      },
      {
        ticker: 'VALE3',
        quantity: 100,
        total_value: 6000, // avg 60 (Chronologically first)
        movement_type: 'BUY',
        trade_date: '2023-01-01',
      },
    ];

    const positions = calculatePositions(trades);
    
    // Process chronologically:
    // 1. Buy 100 @ 60 = 6000
    // 2. Buy 100 @ 70 = 7000 -> Total: 200 @ 13000 (avg: 65)
    // 3. Sell 50 -> removes 50 * 65 = 3250 -> Total: 150 @ 9750 (avg: 65)
    
    expect(positions).toHaveLength(1);
    expect(positions[0].quantity).toBe(150);
    expect(positions[0].avgPrice).toBe(65);
    expect(positions[0].totalValue).toBe(9750);
  });

  it('should filter out positions with 0 quantity', () => {
    const trades: TradeForCalculation[] = [
      {
        ticker: 'WEGE3',
        quantity: 100,
        total_value: 3000,
        movement_type: 'BUY',
        trade_date: '2023-01-01',
      },
      {
        ticker: 'WEGE3',
        quantity: 100,
        total_value: 4000,
        movement_type: 'SELL',
        trade_date: '2023-01-02',
      },
      {
        ticker: 'ITUB4',
        quantity: 100,
        total_value: 2500,
        movement_type: 'BUY',
        trade_date: '2023-01-03',
      },
    ];

    const positions = calculatePositions(trades);
    
    // WEGE3 should be filtered out
    expect(positions).toHaveLength(1);
    expect(positions[0].ticker).toBe('ITUB4');
    expect(positions[0].quantity).toBe(100);
  });
});
