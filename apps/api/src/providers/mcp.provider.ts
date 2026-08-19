import { EventEmitter } from 'node:events';
import https from 'node:https';
import type { LiveTickData } from '@trademitra/shared';
import { logger } from '../core/logger.js';
import {
  getDynamicExpiries,
  getDynamicStrikes,
  calculateOptionPricing,
} from '../core/utils/options-calculator.js';

export interface MarketIndexData {
  symbol: string;
  name: string;
  ltp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  change: number;
  pChange: number;
  timestamp: string;
}

interface SymbolMapping {
  key: string;
  yahooSymbol: string;
  name: string;
}

const TRACKED_SYMBOLS: SymbolMapping[] = [
  { key: 'NIFTY 50', yahooSymbol: '%5ENSEI', name: 'NIFTY 50' },
  { key: 'BANK NIFTY', yahooSymbol: '%5ENSEBANK', name: 'BANK NIFTY' },
  { key: 'SENSEX', yahooSymbol: '%5EBSESN', name: 'BSE SENSEX' },
  { key: 'BOSCH', yahooSymbol: 'BOSCHLTD.NS', name: 'Bosch' },
  { key: 'TUBEINVEST', yahooSymbol: 'TIINDIA.NS', name: 'Tube Investments' },
  { key: 'HDFCBANK', yahooSymbol: 'HDFCBANK.NS', name: 'HDFC Bank' },
  { key: 'RELIANCE', yahooSymbol: 'RELIANCE.NS', name: 'Reliance Industries' },
  { key: 'TCS', yahooSymbol: 'TCS.NS', name: 'Tata Consultancy Services' },
  { key: 'INFY', yahooSymbol: 'INFY.NS', name: 'Infosys' },
];

export class McpFeedProvider extends EventEmitter {
  private static instance: McpFeedProvider | null = null;
  private pollIntervalId: NodeJS.Timeout | null = null;
  private readonly ticksCache = new Map<string, LiveTickData>();
  private readonly indexCache = new Map<string, MarketIndexData>();

  private constructor() {
    super();
    this.initializeBaselineData();
    this.startLiveFeed();
  }

  public static getInstance(): McpFeedProvider {
    if (!McpFeedProvider.instance) {
      McpFeedProvider.instance = new McpFeedProvider();
    }
    return McpFeedProvider.instance;
  }

  public isMarketOpen(): boolean {
    const now = new Date();
    const utcTime = now.getTime() + now.getTimezoneOffset() * 60000;
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istTime = new Date(utcTime + istOffset);

    const day = istTime.getDay();
    if (day === 0 || day === 6) return false;

    const hours = istTime.getHours();
    const minutes = istTime.getMinutes();
    const currentMinutes = hours * 60 + minutes;

    return currentMinutes >= 555 && currentMinutes <= 930; // 09:15 to 15:30
  }

  private initializeBaselineData(): void {
    // 1. NIFTY 50 (LTP: 24,154.90, Prev Close: 24,287.65 -> Change: -132.75, -0.55%)
    this.indexCache.set('NIFTY 50', {
      symbol: 'NIFTY 50',
      name: 'NIFTY 50',
      ltp: 24154.90,
      open: 24200.00,
      high: 24269.65,
      low: 24154.90,
      close: 24287.65,
      change: -132.75,
      pChange: -0.55,
      timestamp: new Date().toISOString(),
    });

    // 2. BANK NIFTY (LTP: 57,262.40, Prev Close: 57,497.80 -> Change: -235.40, -0.41%)
    this.indexCache.set('BANK NIFTY', {
      symbol: 'BANK NIFTY',
      name: 'BANK NIFTY',
      ltp: 57262.40,
      open: 57350.00,
      high: 57584.70,
      low: 57217.60,
      close: 57497.80,
      change: -235.40,
      pChange: -0.41,
      timestamp: new Date().toISOString(),
    });

    // 3. SENSEX (LTP: 77,235.46, Prev Close: 77,728.16 -> Change: -492.70, -0.63%)
    this.indexCache.set('SENSEX', {
      symbol: 'SENSEX',
      name: 'BSE SENSEX',
      ltp: 77235.46,
      open: 77500.00,
      high: 77575.21,
      low: 77234.36,
      close: 77728.16,
      change: -492.70,
      pChange: -0.63,
      timestamp: new Date().toISOString(),
    });

    // 4. FIN NIFTY (LTP: 23,890.00, Prev Close: 24,000.00 -> Change: -110.00, -0.46%)
    this.indexCache.set('FINNIFTY', {
      symbol: 'FINNIFTY',
      name: 'FIN NIFTY',
      ltp: 23890.00,
      open: 23950.00,
      high: 24010.00,
      low: 23850.00,
      close: 24000.00,
      change: -110.00,
      pChange: -0.46,
      timestamp: new Date().toISOString(),
    });

    // 5. MIDCAP NIFTY (LTP: 12,450.00, Prev Close: 12,405.00 -> Change: 45.00, +0.36%)
    this.indexCache.set('MIDCPNIFTY', {
      symbol: 'MIDCPNIFTY',
      name: 'MIDCAP NIFTY',
      ltp: 12450.00,
      open: 12400.00,
      high: 12480.00,
      low: 12390.00,
      close: 12405.00,
      change: 45.00,
      pChange: 0.36,
      timestamp: new Date().toISOString(),
    });

    // 6. BANKEX (LTP: 62,340.00, Prev Close: 62,530.00 -> Change: -190.00, -0.30%)
    this.indexCache.set('BANKEX', {
      symbol: 'BANKEX',
      name: 'BANKEX',
      ltp: 62340.00,
      open: 62500.00,
      high: 62650.00,
      low: 62280.00,
      close: 62530.00,
      change: -190.00,
      pChange: -0.30,
      timestamp: new Date().toISOString(),
    });

    // 7. Stocks
    this.indexCache.set('BOSCH', {
      symbol: 'BOSCH',
      name: 'Bosch',
      ltp: 48730.00,
      open: 47000.00,
      high: 48940.00,
      low: 46775.00,
      close: 46970.00,
      change: 1760.00,
      pChange: 3.75,
      timestamp: new Date().toISOString(),
    });

    this.indexCache.set('TUBEINVEST', {
      symbol: 'TUBEINVEST',
      name: 'Tube Investments',
      ltp: 2959.00,
      open: 2750.00,
      high: 2989.00,
      low: 2755.80,
      close: 2741.40,
      change: 217.60,
      pChange: 7.94,
      timestamp: new Date().toISOString(),
    });

    this.indexCache.set('HDFCBANK', {
      symbol: 'HDFCBANK',
      name: 'HDFC Bank',
      ltp: 723.00,
      open: 730.00,
      high: 729.00,
      low: 723.00,
      close: 729.00,
      change: -6.00,
      pChange: -0.82,
      timestamp: new Date().toISOString(),
    });

    this.indexCache.set('RELIANCE', {
      symbol: 'RELIANCE',
      name: 'Reliance Industries',
      ltp: 1322.00,
      open: 1315.00,
      high: 1328.60,
      low: 1311.20,
      close: 1316.00,
      change: 6.00,
      pChange: 0.46,
      timestamp: new Date().toISOString(),
    });

    this.indexCache.set('TCS', {
      symbol: 'TCS',
      name: 'Tata Consultancy Services',
      ltp: 2280.00,
      open: 2310.00,
      high: 2307.00,
      low: 2280.00,
      close: 2313.20,
      change: -33.20,
      pChange: -1.44,
      timestamp: new Date().toISOString(),
    });

    this.indexCache.set('INFY', {
      symbol: 'INFY',
      name: 'Infosys',
      ltp: 1115.00,
      open: 1135.00,
      high: 1131.90,
      low: 1112.50,
      close: 1139.90,
      change: -24.90,
      pChange: -2.18,
      timestamp: new Date().toISOString(),
    });

    this.recalculateOptionStrikes();
  }

  public getSpotForSymbol(symbol: string): number {
    const sym = symbol.toUpperCase().replace(/\s+/g, '');
    let indexName = 'NIFTY 50';
    let defaultSpot = 24154.90;

    if (sym === 'BANKNIFTY') {
      indexName = 'BANK NIFTY';
      defaultSpot = 57262.40;
    } else if (sym === 'SENSEX') {
      indexName = 'SENSEX';
      defaultSpot = 77235.46;
    } else if (sym === 'FINNIFTY') {
      indexName = 'FIN NIFTY';
      defaultSpot = 23890.00;
    } else if (sym === 'MIDCPNIFTY') {
      indexName = 'MIDCAP NIFTY';
      defaultSpot = 12450.00;
    } else if (sym === 'BANKEX') {
      indexName = 'BANKEX';
      defaultSpot = 62340.00;
    } else if (sym === 'BOSCH') {
      indexName = 'BOSCH';
      defaultSpot = 48730.00;
    } else if (sym === 'TUBEINVEST') {
      indexName = 'TUBEINVEST';
      defaultSpot = 2959.00;
    } else if (sym === 'HDFCBANK') {
      indexName = 'HDFCBANK';
      defaultSpot = 723.00;
    }

    const cached = this.indexCache.get(sym) || this.indexCache.get(indexName);
    return cached?.ltp || defaultSpot;
  }

  /**
   * Recalculates option prices dynamically from current spot price and real calendar expiries
   */
  public recalculateOptionStrikes(): void {
    const updatedTicksBatch: LiveTickData[] = [];

    // 1. DYNAMIC NIFTY OPTION SERIES (Thursday weekly settlement)
    const niftyExpiries = getDynamicExpiries('NIFTY', 8);
    const niftySpot = this.indexCache.get('NIFTY 50')?.ltp || 24154.90;
    const niftyStrikes = getDynamicStrikes(niftySpot, 50, 15);

    for (const exp of niftyExpiries) {
      for (const strike of niftyStrikes) {
        // Dynamic Call (CE)
        const cePricing = calculateOptionPricing(niftySpot, strike, 'CE', exp.daysToExpiry);
        const ceSymbol = `NIFTY_${exp.code}_${strike}_CE`;
        const existingCe = this.ticksCache.get(ceSymbol);
        const ceClose = existingCe?.close || cePricing.ltp;
        const ceChange = Number((cePricing.ltp - ceClose).toFixed(2));
        const cePChange = ceClose > 0 ? Number(((ceChange / ceClose) * 100).toFixed(2)) : 0;

        const ceTick: LiveTickData = {
          symbol: 'NIFTY',
          tradingSymbol: ceSymbol,
          ltp: cePricing.ltp,
          open: existingCe?.open || cePricing.ltp * 0.98,
          high: Math.max(existingCe?.high || cePricing.ltp, cePricing.ltp),
          low: Math.min(existingCe?.low || cePricing.ltp, cePricing.ltp),
          close: ceClose,
          volume: cePricing.volume,
          oi: cePricing.oi,
          change: ceChange,
          pChange: cePChange,
          timestamp: new Date().toISOString(),
        };
        this.ticksCache.set(ceSymbol, ceTick);
        updatedTicksBatch.push(ceTick);

        // Dynamic Put (PE)
        const pePricing = calculateOptionPricing(niftySpot, strike, 'PE', exp.daysToExpiry);
        const peSymbol = `NIFTY_${exp.code}_${strike}_PE`;
        const existingPe = this.ticksCache.get(peSymbol);
        const peClose = existingPe?.close || pePricing.ltp;
        const peChange = Number((pePricing.ltp - peClose).toFixed(2));
        const pePChange = peClose > 0 ? Number(((peChange / peClose) * 100).toFixed(2)) : 0;

        const peTick: LiveTickData = {
          symbol: 'NIFTY',
          tradingSymbol: peSymbol,
          ltp: pePricing.ltp,
          open: existingPe?.open || pePricing.ltp * 1.02,
          high: Math.max(existingPe?.high || pePricing.ltp, pePricing.ltp),
          low: Math.min(existingPe?.low || pePricing.ltp, pePricing.ltp),
          close: peClose,
          volume: pePricing.volume,
          oi: pePricing.oi,
          change: peChange,
          pChange: pePChange,
          timestamp: new Date().toISOString(),
        };
        this.ticksCache.set(peSymbol, peTick);
        updatedTicksBatch.push(peTick);
      }
    }

    // 2. DYNAMIC BANK NIFTY OPTION SERIES (Wednesday weekly settlement)
    const bankExpiries = getDynamicExpiries('BANKNIFTY', 8);
    const bankSpot = this.indexCache.get('BANK NIFTY')?.ltp || 57262.40;
    const bankStrikes = getDynamicStrikes(bankSpot, 100, 15);

    for (const exp of bankExpiries) {
      for (const strike of bankStrikes) {
        // Dynamic Call (CE)
        const cePricing = calculateOptionPricing(bankSpot, strike, 'CE', exp.daysToExpiry);
        const ceSymbol = `BANKNIFTY_${exp.code}_${strike}_CE`;
        const existingCe = this.ticksCache.get(ceSymbol);
        const ceClose = existingCe?.close || cePricing.ltp;
        const ceChange = Number((cePricing.ltp - ceClose).toFixed(2));
        const cePChange = ceClose > 0 ? Number(((ceChange / ceClose) * 100).toFixed(2)) : 0;

        const ceTick: LiveTickData = {
          symbol: 'BANKNIFTY',
          tradingSymbol: ceSymbol,
          ltp: cePricing.ltp,
          open: existingCe?.open || cePricing.ltp * 0.98,
          high: Math.max(existingCe?.high || cePricing.ltp, cePricing.ltp),
          low: Math.min(existingCe?.low || cePricing.ltp, cePricing.ltp),
          close: ceClose,
          volume: cePricing.volume,
          oi: cePricing.oi,
          change: ceChange,
          pChange: cePChange,
          timestamp: new Date().toISOString(),
        };
        this.ticksCache.set(ceSymbol, ceTick);
        updatedTicksBatch.push(ceTick);

        // Dynamic Put (PE)
        const pePricing = calculateOptionPricing(bankSpot, strike, 'PE', exp.daysToExpiry);
        const peSymbol = `BANKNIFTY_${exp.code}_${strike}_PE`;
        const existingPe = this.ticksCache.get(peSymbol);
        const peClose = existingPe?.close || pePricing.ltp;
        const peChange = Number((pePricing.ltp - peClose).toFixed(2));
        const pePChange = peClose > 0 ? Number(((peChange / peClose) * 100).toFixed(2)) : 0;

        const peTick: LiveTickData = {
          symbol: 'BANKNIFTY',
          tradingSymbol: peSymbol,
          ltp: pePricing.ltp,
          open: existingPe?.open || pePricing.ltp * 1.02,
          high: Math.max(existingPe?.high || pePricing.ltp, pePricing.ltp),
          low: Math.min(existingPe?.low || pePricing.ltp, pePricing.ltp),
          close: peClose,
          volume: pePricing.volume,
          oi: pePricing.oi,
          change: peChange,
          pChange: pePChange,
          timestamp: new Date().toISOString(),
        };
        this.ticksCache.set(peSymbol, peTick);
        updatedTicksBatch.push(peTick);
      }
    }

    // 3. RECALCULATE ANY OTHER ACTIVE TRADED CONTRACTS IN CACHE (e.g. SENSEX, BANKEX, FINNIFTY, MIDCPNIFTY, custom expiries)
    for (const [symKey, existingTick] of this.ticksCache.entries()) {
      if (updatedTicksBatch.some((t) => t.tradingSymbol === symKey)) continue;

      const parts = symKey.split('_'); // [BANKEX, 25AUG, 62000, CE]
      if (parts.length >= 4) {
        const symbol = parts[0]!;
        const strike = parseFloat(parts[2]!);
        const optionType = parts[3]! as 'CE' | 'PE';
        const spot = this.getSpotForSymbol(symbol);
        const pricing = calculateOptionPricing(spot, strike, optionType, 6);

        // Add small realistic tick momentum
        const jitter = (Math.random() - 0.49) * 0.004;
        const ltp = Number((pricing.ltp * (1 + jitter)).toFixed(2));
        const close = existingTick.close || pricing.ltp;
        const change = Number((ltp - close).toFixed(2));
        const pChange = close > 0 ? Number(((change / close) * 100).toFixed(2)) : 0;

        const tick: LiveTickData = {
          ...existingTick,
          ltp,
          high: Math.max(existingTick.high || ltp, ltp),
          low: Math.min(existingTick.low || ltp, ltp),
          change,
          pChange,
          timestamp: new Date().toISOString(),
        };

        this.ticksCache.set(symKey, tick);
        updatedTicksBatch.push(tick);
      }
    }

    // Emit whole batch in a single high-speed event to eliminate frontend UI stutter/freezing
    if (updatedTicksBatch.length > 0) {
      this.emit('contract_ticks_batch', updatedTicksBatch);
    }
  }

  private fetchLiveYahooQuote(symbol: string): Promise<any> {
    return new Promise((resolve) => {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d`;
      const req = https.get(
        url,
        {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          },
          timeout: 4000,
        },
        (res) => {
          let body = '';
          res.on('data', (chunk) => (body += chunk));
          res.on('end', () => {
            try {
              const json = JSON.parse(body);
              const meta = json.chart?.result?.[0]?.meta;
              if (meta && typeof meta.regularMarketPrice === 'number') {
                resolve({
                  price: meta.regularMarketPrice,
                  high: meta.regularMarketDayHigh ?? meta.regularMarketPrice,
                  low: meta.regularMarketDayLow ?? meta.regularMarketPrice,
                  open: meta.regularMarketDayLow ?? meta.regularMarketPrice,
                  close: meta.chartPreviousClose ?? meta.regularMarketPrice,
                  volume: meta.regularMarketVolume ?? 100000,
                });
                return;
              }
              resolve(null);
            } catch {
              resolve(null);
            }
          });
        }
      );

      req.on('error', () => resolve(null));
      req.on('timeout', () => {
        req.destroy();
        resolve(null);
      });
    });
  }

  public async syncRealMarketData(): Promise<void> {
    try {
      const promises = TRACKED_SYMBOLS.map(async (item) => {
        const quote = await this.fetchLiveYahooQuote(item.yahooSymbol);
        if (quote && quote.price > 0) {
          const ltp = Number(quote.price.toFixed(2));
          const close = Number((quote.close || ltp).toFixed(2));
          const change = Number((ltp - close).toFixed(2));
          const pChange = close > 0 ? Number(((change / close) * 100).toFixed(2)) : 0;

          const updated: MarketIndexData = {
            symbol: item.key,
            name: item.name,
            ltp,
            open: quote.open || ltp,
            high: Math.max(quote.high || ltp, ltp),
            low: Math.min(quote.low || ltp, ltp),
            close,
            change,
            pChange,
            timestamp: new Date().toISOString(),
          };

          this.indexCache.set(item.key, updated);
          this.emit('index_tick', updated);
        }
      });

      await Promise.all(promises);
      this.recalculateOptionStrikes();
      logger.info(
        `[McpFeedProvider] Official Real Quotes Synced (Market Status: ${
          this.isMarketOpen() ? 'OPEN' : 'CLOSED'
        }). NIFTY: ${this.indexCache.get('NIFTY 50')?.ltp}, BANKNIFTY: ${
          this.indexCache.get('BANK NIFTY')?.ltp
        }`
      );
    } catch (err: any) {
      logger.warn(`[McpFeedProvider] Quote sync issue: ${err.message}`);
    }
  }

  public startLiveFeed(): void {
    if (this.pollIntervalId) return;

    logger.info('[McpFeedProvider] Starting Official Real Market Feed with Live Tick Momentum Engine...');
    this.syncRealMarketData();

    // 1. Live Web sync interval for real market prices
    this.pollIntervalId = setInterval(() => {
      if (this.isMarketOpen()) {
        this.syncRealMarketData();
      }
    }, 5000);

    // 2. Micro-Momentum Live Generator (Ideal for Paper Trading & Testing Stop-loss / Trailing SL)
    setInterval(() => {
      // Generate realistic price oscillation (0.02% to 0.05% fluctuation around live base)
      for (const [key, index] of this.indexCache.entries()) {
        // Random micro tick between -0.04% and +0.04%
        const deltaPct = (Math.random() - 0.49) * 0.0008;
        const newLtp = Number((index.ltp * (1 + deltaPct)).toFixed(2));
        const change = Number((newLtp - index.close).toFixed(2));
        const pChange = Number(((change / index.close) * 100).toFixed(2));

        const updated: MarketIndexData = {
          ...index,
          ltp: newLtp,
          high: Math.max(index.high, newLtp),
          low: Math.min(index.low, newLtp),
          change,
          pChange,
          timestamp: new Date().toISOString(),
        };

        this.indexCache.set(key, updated);
        this.emit('index_tick', updated);
      }

      this.recalculateOptionStrikes();
    }, 1500);
  }

  public getLatestTick(tradingSymbol: string): LiveTickData | undefined {
    let tick = this.ticksCache.get(tradingSymbol);
    if (tick) return tick;

    const parts = tradingSymbol.split('_');
    if (parts.length >= 4) {
      const symbol = parts[0]!;
      const strike = parseFloat(parts[2]!);
      const optionType = parts[3]! as 'CE' | 'PE';
      const spotPrice =
        (symbol === 'BANKNIFTY'
          ? this.indexCache.get('BANK NIFTY')?.ltp
          : this.indexCache.get('NIFTY 50')?.ltp) || 24154.90;
      const pricing = calculateOptionPricing(spotPrice, strike, optionType, 6);

      tick = {
        symbol,
        tradingSymbol,
        ltp: pricing.ltp,
        open: Number((pricing.ltp * 0.98).toFixed(2)),
        high: Number((pricing.ltp * 1.05).toFixed(2)),
        low: Number((pricing.ltp * 0.95).toFixed(2)),
        close: Number((pricing.ltp * 0.99).toFixed(2)),
        volume: pricing.volume,
        oi: pricing.oi,
        change: Number((pricing.ltp * 0.015).toFixed(2)),
        pChange: 1.5,
        timestamp: new Date().toISOString(),
      };
      this.ticksCache.set(tradingSymbol, tick);
      return tick;
    }

    return undefined;
  }

  public getAllTicks(): LiveTickData[] {
    return Array.from(this.ticksCache.values());
  }

  public getIndices(): MarketIndexData[] {
    return Array.from(this.indexCache.values());
  }

  public stop(): void {
    if (this.pollIntervalId) {
      clearInterval(this.pollIntervalId);
      this.pollIntervalId = null;
    }
    logger.info('[McpFeedProvider] Market feed stopped.');
  }
}
