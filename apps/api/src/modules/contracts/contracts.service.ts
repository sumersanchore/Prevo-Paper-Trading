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
    let indexName = 'NIFTY 50';
    let defaultSpot = 24154.90;
    let defaultChange = -132.75;
    let defaultPChange = -0.55;
    let step = 50;

    if (sym === 'BANKNIFTY') {
      indexName = 'BANK NIFTY';
      defaultSpot = 57262.40;
      defaultChange = -235.40;
      defaultPChange = -0.41;
      step = 100;
    } else if (sym === 'SENSEX') {
      indexName = 'SENSEX';
      defaultSpot = 77235.46;
      defaultChange = -492.70;
      defaultPChange = -0.63;
      step = 100;
    } else if (sym === 'FINNIFTY') {
      indexName = 'FIN NIFTY';
      defaultSpot = 23890.00;
      defaultChange = -110.00;
      defaultPChange = -0.46;
      step = 50;
    } else if (sym === 'MIDCPNIFTY') {
      indexName = 'MIDCAP NIFTY';
      defaultSpot = 12450.00;
      defaultChange = 45.00;
      defaultPChange = 0.36;
      step = 25;
    } else if (sym === 'BANKEX') {
      indexName = 'BANKEX';
      defaultSpot = 62340.00;
      defaultChange = -190.00;
      defaultPChange = -0.30;
      step = 100;
    } else if (sym === 'BOSCH') {
      indexName = 'BOSCH';
      defaultSpot = 48730.00;
      defaultChange = 1760.00;
      defaultPChange = 3.75;
      step = 250;
    } else if (sym === 'TUBEINVEST') {
      indexName = 'TUBEINVEST';
      defaultSpot = 2959.00;
      defaultChange = 217.60;
      defaultPChange = 7.94;
      step = 20;
    } else if (sym === 'HDFCBANK') {
      indexName = 'HDFCBANK';
      defaultSpot = 723.00;
      defaultChange = -6.00;
      defaultPChange = -0.82;
      step = 10;
    }

    const indexData = this.feedProvider.getIndices().find((i) => 
      i.symbol.toUpperCase().replace(/\s+/g, '') === sym ||
      i.symbol.toUpperCase() === indexName.toUpperCase()
    );
    const spotPrice = indexData ? indexData.ltp : defaultSpot;
    const change = indexData ? indexData.change : defaultChange;
    const pChange = indexData ? indexData.pChange : defaultPChange;

    // 1. Dynamically compute all active weekly & monthly expiries from live calendar
    const dynamicExpiries = getDynamicExpiries(symbol, 8);
    const expiries = dynamicExpiries.map((e) => e.date);
    const selectedExpiry = expiry && expiries.includes(expiry) ? expiry : expiries[0]!;
    const activeExpiryObj = dynamicExpiries.find((e) => e.date === selectedExpiry) || dynamicExpiries[0]!;

    // 2. Dynamically compute strike ladder centered around live spot price (7 above ATM, 1 ATM, 7 below ATM)
    const strikes = getDynamicStrikes(spotPrice, step, 15);
    const prevSpot = spotPrice - change;

    // 3. Generate Option Chain strikes dynamically with precise intrinsic & time-decay values
    const chain: OptionChainStrikeItem[] = [];

    for (const strike of strikes) {
      const ceSymbol = `${symbol}_${activeExpiryObj.code}_${strike}_CE`;
      const peSymbol = `${symbol}_${activeExpiryObj.code}_${strike}_PE`;

      const liveCe = this.feedProvider.getLatestTick(ceSymbol);
      const livePe = this.feedProvider.getLatestTick(peSymbol);

      const cePricing = calculateOptionPricing(spotPrice, strike, 'CE', activeExpiryObj.daysToExpiry);
      const pePricing = calculateOptionPricing(spotPrice, strike, 'PE', activeExpiryObj.daysToExpiry);

      const prevCePricing = calculateOptionPricing(prevSpot, strike, 'CE', activeExpiryObj.daysToExpiry);
      const prevPePricing = calculateOptionPricing(prevSpot, strike, 'PE', activeExpiryObj.daysToExpiry);

      const ceLtp = liveCe?.ltp ?? cePricing.ltp;
      const peLtp = livePe?.ltp ?? pePricing.ltp;

      const ceClose = prevCePricing.ltp;
      const peClose = prevPePricing.ltp;

      const computedCeChange = Number((ceLtp - ceClose).toFixed(2));
      const computedCePChange = ceClose > 0 ? Number(((computedCeChange / ceClose) * 100).toFixed(2)) : 0;

      const computedPeChange = Number((peLtp - peClose).toFixed(2));
      const computedPePChange = peClose > 0 ? Number(((computedPeChange / peClose) * 100).toFixed(2)) : 0;

      const ceContract = await this.repository.getContractById(ceSymbol);
      const peContract = await this.repository.getContractById(peSymbol);

      chain.push({
        strikePrice: strike,
        ce: {
          contractId: ceContract ? ceContract.id : ceSymbol,
          tradingSymbol: ceSymbol,
          ltp: ceLtp,
          change: liveCe?.change ?? computedCeChange,
          pChange: liveCe?.pChange ?? computedCePChange,
          oi: liveCe?.oi ?? cePricing.oi,
          volume: liveCe?.volume ?? cePricing.volume,
          iv: cePricing.iv,
        },
        pe: {
          contractId: peContract ? peContract.id : peSymbol,
          tradingSymbol: peSymbol,
          ltp: peLtp,
          change: livePe?.change ?? computedPeChange,
          pChange: livePe?.pChange ?? computedPePChange,
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
