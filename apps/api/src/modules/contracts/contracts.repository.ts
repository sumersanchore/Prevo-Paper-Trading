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

  public async getContractById(identifier: string): Promise<OptionsContractEntity | null> {
    if (!identifier) return null;
    const cleanId = identifier.startsWith('dyn_') ? identifier.replace('dyn_', '') : identifier;

    if (ContractsRepository.contractCache.has(cleanId)) {
      return ContractsRepository.contractCache.get(cleanId)!;
    }
    if (ContractsRepository.contractCache.has(identifier)) {
      return ContractsRepository.contractCache.get(identifier)!;
    }

    const isNumeric = /^\d+$/.test(cleanId);

    try {
      let result;
      if (isNumeric) {
        result = await db.query<IContractRow>(
          `SELECT id, symbol, trading_symbol, expiry_date, strike_price, option_type, lot_size, freeze_limit, exchange, is_active, created_at, updated_at
           FROM options_contracts
           WHERE id = $1`,
          [cleanId]
        );
      } else {
        result = await db.query<IContractRow>(
          `SELECT id, symbol, trading_symbol, expiry_date, strike_price, option_type, lot_size, freeze_limit, exchange, is_active, created_at, updated_at
           FROM options_contracts
           WHERE trading_symbol = $1`,
          [cleanId]
        );
      }

      if (result.rows.length > 0) {
        const entity = this.mapRowToEntity(result.rows[0]!);
        ContractsRepository.contractCache.set(entity.id, entity);
        ContractsRepository.contractCache.set(entity.tradingSymbol, entity);
        ContractsRepository.contractCache.set(identifier, entity);
        return entity;
      }
    } catch {
      // Fallback to insertion/in-memory
    }

    // If dynamic contract not yet in DB, insert it into options_contracts to get a real numeric ID
    const parts = cleanId.split('_'); // [NIFTY, 20AUG, 24250, CE]
    if (parts.length >= 4) {
      const symbol = parts[0]!;
      const expCode = parts[1]!;
      const strike = parseFloat(parts[2]!);
      const optionType = parts[3]! as 'CE' | 'PE';
      const lotSize = symbol === 'BANKNIFTY' ? 15 : 25;
      const freezeLimit = symbol === 'BANKNIFTY' ? 900 : 1800;

      const day = expCode.slice(0, 2);
      const monStr = expCode.slice(2).toUpperCase();
      const monMap: Record<string, string> = {
        JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06',
        JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12',
      };
      const mon = monMap[monStr] || '08';
      const expiryDate = `2026-${mon}-${day}`;

      try {
        const insertRes = await db.query<IContractRow>(
          `INSERT INTO options_contracts (symbol, trading_symbol, expiry_date, strike_price, option_type, lot_size, freeze_limit, exchange, is_active)
           VALUES ($1, $2, $3, $4, $5, $6, $7, 'NFO', TRUE)
           ON CONFLICT (trading_symbol) DO UPDATE SET is_active = TRUE
           RETURNING id, symbol, trading_symbol, expiry_date, strike_price, option_type, lot_size, freeze_limit, exchange, is_active, created_at, updated_at`,
          [symbol, cleanId, expiryDate, strike, optionType, lotSize, freezeLimit]
        );

        if (insertRes.rows.length > 0) {
          const entity = this.mapRowToEntity(insertRes.rows[0]!);
          ContractsRepository.contractCache.set(entity.id, entity);
          ContractsRepository.contractCache.set(entity.tradingSymbol, entity);
          ContractsRepository.contractCache.set(identifier, entity);
          return entity;
        }
      } catch {
        // Fallback
      }
    }

    const fallback = ContractsRepository.fallbackContracts.find((c) => c.id === cleanId || c.tradingSymbol === cleanId) ?? null;
    if (fallback) {
      try {
        const insertRes = await db.query<IContractRow>(
          `INSERT INTO options_contracts (symbol, trading_symbol, expiry_date, strike_price, option_type, lot_size, freeze_limit, exchange, is_active)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE)
           ON CONFLICT (trading_symbol) DO UPDATE SET is_active = TRUE
           RETURNING id, symbol, trading_symbol, expiry_date, strike_price, option_type, lot_size, freeze_limit, exchange, is_active, created_at, updated_at`,
          [
            fallback.symbol,
            fallback.tradingSymbol,
            fallback.expiryDate,
            fallback.strikePrice,
            fallback.optionType,
            fallback.lotSize,
            fallback.freezeLimit,
            fallback.exchange || 'NFO',
          ]
        );
        if (insertRes.rows.length > 0) {
          const entity = this.mapRowToEntity(insertRes.rows[0]!);
          ContractsRepository.contractCache.set(entity.id, entity);
          ContractsRepository.contractCache.set(entity.tradingSymbol, entity);
          ContractsRepository.contractCache.set(identifier, entity);
          return entity;
        }
      } catch {
        // DB not available or table locked
      }

      ContractsRepository.contractCache.set(fallback.id, fallback);
      ContractsRepository.contractCache.set(fallback.tradingSymbol, fallback);
      ContractsRepository.contractCache.set(identifier, fallback);
    }
    return fallback;
  }
}
