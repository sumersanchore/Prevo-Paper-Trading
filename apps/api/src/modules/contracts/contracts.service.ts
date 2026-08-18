import { ContractsRepository } from './contracts.repository.js';
import { McpFeedProvider } from '../../providers/mcp.provider.js';
import {
  getDynamicExpiries,
  getDynamicStrikes,
  calculateOptionPricing,
} from '../../core/utils/options-calculator.js';
import type { OptionChainStrikeItem, OptionsContractEntity } from '@trademitra/shared';

export class ContractsService {
  private readonly repository: ContractsRepository;
  private readonly feedProvider: McpFeedProvider;

  constructor(
    repository = new ContractsRepository(),
    feedProvider = McpFeedProvider.getInstance()
  ) {
    this.repository = repository;
    this.feedProvider = feedProvider;
  }

  public async getContracts(symbol = 'NIFTY'): Promise<OptionsContractEntity[]> {
    return this.repository.getContractsBySymbol(symbol);
  }

  public async getOptionChain(
    symbol = 'NIFTY',
    expiry?: string
  ): Promise<{
    symbol: string;
    spotPrice: number;
    change: number;
    pChange: number;
    expiries: string[];
    selectedExpiry: string;
    chain: OptionChainStrikeItem[];
  }> {
    const sym = symbol.toUpperCase().replace(/\s+/g, '');
    const isBankNifty = sym === 'BANKNIFTY';
    const isSensex = sym === 'SENSEX';
    const indexName = isBankNifty ? 'BANK NIFTY' : isSensex ? 'SENSEX' : 'NIFTY 50';
    const indexData = this.feedProvider.getIndices().find((i) => i.symbol === indexName);
    const spotPrice = indexData
      ? indexData.ltp
      : isBankNifty
      ? 57262.40
      : isSensex
      ? 77235.46
      : 24154.90;
    const change = indexData
      ? indexData.change
      : isBankNifty
      ? -235.40
      : isSensex
      ? -492.70
      : -132.75;
    const pChange = indexData
      ? indexData.pChange
      : isBankNifty
      ? -0.41
      : isSensex
      ? -0.63
      : -0.55;

    // 1. Dynamically compute all active weekly & monthly expiries from live calendar
    const dynamicExpiries = getDynamicExpiries(symbol, 8);
    const expiries = dynamicExpiries.map((e) => e.date);
    const selectedExpiry = expiry && expiries.includes(expiry) ? expiry : expiries[0]!;
    const activeExpiryObj = dynamicExpiries.find((e) => e.date === selectedExpiry) || dynamicExpiries[0]!;

    // 2. Dynamically compute strike ladder centered around live spot price (Step: 50 for NIFTY, 100 for BANKNIFTY)
    const step = isBankNifty ? 100 : 50;
    const strikes = getDynamicStrikes(spotPrice, step, 17);

    // 3. Generate Option Chain strikes dynamically with precise intrinsic & time-decay values
    const chain: OptionChainStrikeItem[] = [];

    for (const strike of strikes) {
      const ceSymbol = `${symbol}_${activeExpiryObj.code}_${strike}_CE`;
      const peSymbol = `${symbol}_${activeExpiryObj.code}_${strike}_PE`;

      const liveCe = this.feedProvider.getLatestTick(ceSymbol);
      const livePe = this.feedProvider.getLatestTick(peSymbol);

      const cePricing = calculateOptionPricing(spotPrice, strike, 'CE', activeExpiryObj.daysToExpiry);
      const pePricing = calculateOptionPricing(spotPrice, strike, 'PE', activeExpiryObj.daysToExpiry);

      const ceLtp = liveCe?.ltp ?? cePricing.ltp;
      const peLtp = livePe?.ltp ?? pePricing.ltp;

      chain.push({
        strikePrice: strike,
        ce: {
          contractId: `dyn_${ceSymbol}`,
          tradingSymbol: ceSymbol,
          ltp: ceLtp,
          change: liveCe?.change ?? Number((ceLtp * 0.015).toFixed(2)),
          pChange: liveCe?.pChange ?? 1.25,
          oi: liveCe?.oi ?? cePricing.oi,
          volume: liveCe?.volume ?? cePricing.volume,
          iv: cePricing.iv,
        },
        pe: {
          contractId: `dyn_${peSymbol}`,
          tradingSymbol: peSymbol,
          ltp: peLtp,
          change: livePe?.change ?? Number((-peLtp * 0.012).toFixed(2)),
          pChange: livePe?.pChange ?? -1.10,
          oi: livePe?.oi ?? pePricing.oi,
          volume: livePe?.volume ?? pePricing.volume,
          iv: pePricing.iv,
        },
      });
    }

    return {
      symbol,
      spotPrice,
      change,
      pChange,
      expiries,
      selectedExpiry,
      chain,
    };
  }
}
