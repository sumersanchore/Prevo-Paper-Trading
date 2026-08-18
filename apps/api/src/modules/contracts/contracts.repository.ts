import { db } from '@trademitra/database';
import type { OptionsContractEntity } from '@trademitra/shared';

export interface IContractRow {
  id: string;
  symbol: string;
  trading_symbol: string;
  expiry_date: Date | string;
  strike_price: string | number;
  option_type: 'CE' | 'PE';
  lot_size: number;
  freeze_limit: number;
  exchange: string;
  is_active: boolean;
  created_at: Date | string;
  updated_at: Date | string;
}

export class ContractsRepository {
  private static readonly fallbackContracts: OptionsContractEntity[] = (() => {
    const list: OptionsContractEntity[] = [];
    const strikes = [23950, 24000, 24050, 24100, 24150, 24200, 24250, 24300, 24350, 24400, 24450, 24500];
    const expiries = [
      { date: '2026-08-25', code: '25AUG' },
      { date: '2026-09-01', code: '01SEP' },
      { date: '2026-09-08', code: '08SEP' },
      { date: '2026-09-15', code: '15SEP' },
      { date: '2026-09-22', code: '22SEP' },
      { date: '2026-09-29', code: '29SEP' },
      { date: '2026-10-27', code: '27OCT' },
      { date: '2026-11-24', code: '24NOV' },
      { date: '2026-12-29', code: '29DEC' },
    ];
    let id = 1;
    for (const exp of expiries) {
      for (const strike of strikes) {
        list.push({
          id: String(id++),
          symbol: 'NIFTY',
          tradingSymbol: `NIFTY_${exp.code}_${strike}_CE`,
          expiryDate: exp.date,
          strikePrice: strike,
          optionType: 'CE',
          lotSize: 25,
          freezeLimit: 1800,
          exchange: 'NFO',
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        list.push({
          id: String(id++),
          symbol: 'NIFTY',
          tradingSymbol: `NIFTY_${exp.code}_${strike}_PE`,
          expiryDate: exp.date,
          strikePrice: strike,
          optionType: 'PE',
          lotSize: 25,
          freezeLimit: 1800,
          exchange: 'NFO',
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }
    }

    // BANKNIFTY Option contracts
    const bankStrikes = [57000, 57100, 57200, 57300, 57400, 57500, 57600];
    for (const exp of expiries) {
      for (const strike of bankStrikes) {
        list.push({
          id: String(id++),
          symbol: 'BANKNIFTY',
          tradingSymbol: `BANKNIFTY_${exp.code}_${strike}_CE`,
          expiryDate: exp.date,
          strikePrice: strike,
          optionType: 'CE',
          lotSize: 15,
          freezeLimit: 900,
          exchange: 'NFO',
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        list.push({
          id: String(id++),
          symbol: 'BANKNIFTY',
          tradingSymbol: `BANKNIFTY_${exp.code}_${strike}_PE`,
          expiryDate: exp.date,
          strikePrice: strike,
          optionType: 'PE',
          lotSize: 15,
          freezeLimit: 900,
          exchange: 'NFO',
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }
    }
    return list;
  })();

  private mapRowToEntity(row: IContractRow): OptionsContractEntity {
    return {
      id: String(row.id),
      symbol: row.symbol,
      tradingSymbol: row.trading_symbol,
      expiryDate: typeof row.expiry_date === 'string' ? row.expiry_date : row.expiry_date.toISOString().split('T')[0]!,
      strikePrice: Number(row.strike_price),
      optionType: row.option_type,
      lotSize: row.lot_size,
      freezeLimit: row.freeze_limit,
      exchange: row.exchange,
      isActive: row.is_active,
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString(),
    };
  }

  public async getContractsBySymbol(symbol = 'NIFTY'): Promise<OptionsContractEntity[]> {
    try {
      const result = await db.query<IContractRow>(
        `SELECT id, symbol, trading_symbol, expiry_date, strike_price, option_type, lot_size, freeze_limit, exchange, is_active, created_at, updated_at
         FROM options_contracts
         WHERE symbol = $1 AND is_active = TRUE
         ORDER BY strike_price ASC, option_type ASC`,
        [symbol]
      );

      if (result.rows.length > 0) {
        return result.rows.map((r) => this.mapRowToEntity(r));
      }
    } catch {
      // Fallback
    }

    return ContractsRepository.fallbackContracts.filter((c) => c.symbol === symbol);
  }

  private static readonly contractCache = new Map<string, OptionsContractEntity>();

  public async getContractById(id: string): Promise<OptionsContractEntity | null> {
    if (ContractsRepository.contractCache.has(id)) {
      return ContractsRepository.contractCache.get(id)!;
    }

    // 1. Check if ID is a dynamic trading symbol reference (e.g. dyn_NIFTY_25AUG_24250_CE)
    if (id.startsWith('dyn_')) {
      const tradingSymbol = id.replace('dyn_', '');
      const parts = tradingSymbol.split('_'); // [NIFTY, 25AUG, 24250, CE]
      if (parts.length >= 4) {
        const symbol = parts[0]!;
        const strike = parseFloat(parts[2]!);
        const optionType = parts[3]! as 'CE' | 'PE';
        const lotSize = symbol === 'BANKNIFTY' ? 15 : 25;
        const entity: OptionsContractEntity = {
          id,
          symbol,
          tradingSymbol,
          expiryDate: '2026-08-25',
          strikePrice: strike,
          optionType,
          lotSize,
          freezeLimit: symbol === 'BANKNIFTY' ? 900 : 1800,
          exchange: 'NFO',
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        ContractsRepository.contractCache.set(id, entity);
        ContractsRepository.contractCache.set(tradingSymbol, entity);
        return entity;
      }
    }

    try {
      const result = await db.query<IContractRow>(
        `SELECT id, symbol, trading_symbol, expiry_date, strike_price, option_type, lot_size, freeze_limit, exchange, is_active, created_at, updated_at
         FROM options_contracts
         WHERE id = $1 OR trading_symbol = $1`,
        [id]
      );

      if (result.rows.length > 0) {
        const entity = this.mapRowToEntity(result.rows[0]!);
        ContractsRepository.contractCache.set(id, entity);
        ContractsRepository.contractCache.set(entity.id, entity);
        ContractsRepository.contractCache.set(entity.tradingSymbol, entity);
        return entity;
      }
    } catch {
      // Fallback
    }

    const fallback = ContractsRepository.fallbackContracts.find((c) => c.id === id || c.tradingSymbol === id) ?? null;
    if (fallback) {
      ContractsRepository.contractCache.set(id, fallback);
      ContractsRepository.contractCache.set(fallback.id, fallback);
      ContractsRepository.contractCache.set(fallback.tradingSymbol, fallback);
    }
    return fallback;
  }
}
