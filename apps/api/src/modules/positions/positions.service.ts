import { PositionsRepository } from './positions.repository.js';
import { ContractsRepository } from '../contracts/contracts.repository.js';
import { McpFeedProvider } from '../../providers/mcp.provider.js';
import type { OptionPositionEntity } from '@trademitra/shared';

export interface HydratedPosition extends OptionPositionEntity {
  tradingSymbol: string;
  symbol: string;
  strikePrice: number;
  optionType: 'CE' | 'PE';
  lotSize: number;
  ltp: number;
  currentValue: number;
  totalPnl: number;
  pnlPercentage: number;
}

export interface PositionsSummary {
  positions: HydratedPosition[];
  totalRealizedPnl: number;
  totalUnrealizedPnl: number;
  netPnl: number;
  openPositionsCount: number;
  closedPositionsCount: number;
}

export class PositionsService {
  private readonly positionsRepo: PositionsRepository;
  private readonly contractsRepo: ContractsRepository;
  private readonly feedProvider: McpFeedProvider;

  constructor(
    positionsRepo = new PositionsRepository(),
    contractsRepo = new ContractsRepository(),
    feedProvider = McpFeedProvider.getInstance()
  ) {
    this.positionsRepo = positionsRepo;
    this.contractsRepo = contractsRepo;
    this.feedProvider = feedProvider;
  }

  public async getPositionsSummary(userId: string): Promise<PositionsSummary> {
    const rawPositions = await this.positionsRepo.getPositionsByUserId(userId);
    const hydratedPositions: HydratedPosition[] = [];

    let totalRealized = 0;
    let totalUnrealized = 0;
    let openCount = 0;
    let closedCount = 0;

    for (const pos of rawPositions) {
      const contract = await this.contractsRepo.getContractById(pos.contractId);
      const tradingSymbol = contract?.tradingSymbol ?? `NIFTY_CONTRACT_${pos.contractId}`;
      const tick = this.feedProvider.getLatestTick(tradingSymbol);

      const ltp = tick ? tick.ltp : (contract?.optionType === 'CE' ? 120.5 : 95.2);
      const netQty = pos.netQuantity;

      // Unrealized PnL calculation
      let unrealizedPnl = 0;
      if (netQty > 0) {
        unrealizedPnl = Number((netQty * (ltp - pos.averageBuyPrice)).toFixed(2));
      } else if (netQty < 0) {
        unrealizedPnl = Number((Math.abs(netQty) * (pos.averageSellPrice - ltp)).toFixed(2));
      }

      const totalPnl = Number((pos.realizedPnl + unrealizedPnl).toFixed(2));
      const investedValue = netQty > 0 ? netQty * pos.averageBuyPrice : 0;
      const pnlPercentage =
        investedValue > 0 ? Number(((totalPnl / investedValue) * 100).toFixed(2)) : 0;

      const currentValue = Number((Math.abs(netQty) * ltp).toFixed(2));

      totalRealized += pos.realizedPnl;
      totalUnrealized += unrealizedPnl;

      if (pos.status === 'OPEN' && netQty !== 0) {
        openCount++;
      } else {
        closedCount++;
      }

      hydratedPositions.push({
        ...pos,
        tradingSymbol,
        symbol: contract?.symbol ?? 'NIFTY',
        strikePrice: contract?.strikePrice ?? 24500,
        optionType: contract?.optionType ?? 'CE',
        lotSize: contract?.lotSize ?? 25,
        ltp,
        currentValue,
        unrealizedPnl,
        totalPnl,
        pnlPercentage,
      });
    }

    return {
      positions: hydratedPositions,
      totalRealizedPnl: Number(totalRealized.toFixed(2)),
      totalUnrealizedPnl: Number(totalUnrealized.toFixed(2)),
      netPnl: Number((totalRealized + totalUnrealized).toFixed(2)),
      openPositionsCount: openCount,
      closedPositionsCount: closedCount,
    };
  }
}
