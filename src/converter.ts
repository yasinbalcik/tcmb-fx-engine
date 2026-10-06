import { TcmbDailyRates, RateType, ConvertOptions, ConversionResult } from './types';

/**
 * Currency conversion and cross-rate calculation engine.
 */
export class FxConverter {
  private dailyRates: TcmbDailyRates;

  constructor(dailyRates: TcmbDailyRates) {
    this.dailyRates = dailyRates;
  }

  /**
   * Returns available currency codes in the current bulletin.
   */
  public getSupportedCurrencies(): string[] {
    return Object.keys(this.dailyRates.rates);
  }

  /**
   * Retrieves specific rate for a currency code.
   */
  public getRate(currencyCode: string): import('./types').TcmbCurrencyRate | undefined {
    return this.dailyRates.rates[currencyCode.toUpperCase()];
  }

  /**
   * Converts an amount from one currency to another using TCMB bulletin rates.
   */
  public convert(options: ConvertOptions): ConversionResult {
    const { from, to, amount, rateType = 'ForexSelling' } = options;

    if (amount < 0) {
      throw new Error(`Amount cannot be negative: ${amount}`);
    }

    const fromCode = from.toUpperCase();
    const toCode = to.toUpperCase();

    if (fromCode === toCode) {
      return {
        fromCurrency: fromCode,
        toCurrency: toCode,
        amount,
        rate: 1.0,
        convertedAmount: amount,
        rateType,
        viaTRY: false
      };
    }

    // 1. Direct Conversion: From Currency -> TRY
    if (toCode === 'TRY') {
      const fromEntry = this.getRate(fromCode);
      if (!fromEntry) {
        throw new Error(`Currency ${fromCode} not found in TCMB bulletin`);
      }
      const rawRate = this.resolveRateValue(fromEntry, rateType);
      const effectiveRate = roundTo(rawRate / fromEntry.unit, 6);
      const convertedAmount = roundTo(amount * effectiveRate, 4);

      return {
        fromCurrency: fromCode,
        toCurrency: 'TRY',
        amount,
        rate: effectiveRate,
        convertedAmount,
        rateType,
        viaTRY: false
      };
    }

    // 2. Direct Conversion: TRY -> Target Currency
    if (fromCode === 'TRY') {
      const toEntry = this.getRate(toCode);
      if (!toEntry) {
        throw new Error(`Currency ${toCode} not found in TCMB bulletin`);
      }
      const rawRate = this.resolveRateValue(toEntry, rateType);
      const effectiveRate = rawRate / toEntry.unit;
      if (effectiveRate === 0) {
        throw new Error(`Exchange rate for ${toCode} is zero`);
      }
      const targetRate = 1 / effectiveRate;
      const convertedAmount = roundTo(amount / effectiveRate, 4);

      return {
        fromCurrency: 'TRY',
        toCurrency: toCode,
        amount,
        rate: roundTo(targetRate, 6),
        convertedAmount,
        rateType,
        viaTRY: false
      };
    }

    // 3. Cross Currency Conversion (e.g. EUR to USD or USD to EUR)
    const fromEntry = this.getRate(fromCode);
    const toEntry = this.getRate(toCode);

    if (!fromEntry) {
      throw new Error(`Currency ${fromCode} not found in TCMB bulletin`);
    }
    if (!toEntry) {
      throw new Error(`Currency ${toCode} not found in TCMB bulletin`);
    }

    // Check if direct cross rate is provided by TCMB
    let crossRate: number | null = null;

    if (toCode === 'USD' && fromEntry.crossRateUSD && fromEntry.crossRateUSD > 0) {
      crossRate = fromEntry.crossRateUSD;
    } else if (fromCode === 'USD' && toEntry.crossRateUSD && toEntry.crossRateUSD > 0) {
      crossRate = 1 / toEntry.crossRateUSD;
    }

    if (crossRate !== null) {
      const convertedAmount = roundTo(amount * crossRate, 4);
      return {
        fromCurrency: fromCode,
        toCurrency: toCode,
        amount,
        rate: roundTo(crossRate, 6),
        convertedAmount,
        rateType,
        viaTRY: false
      };
    }

    // Triangular Conversion via TRY
    const fromUnitRate = this.resolveRateValue(fromEntry, rateType) / fromEntry.unit;
    const toUnitRate = this.resolveRateValue(toEntry, rateType) / toEntry.unit;

    if (toUnitRate === 0) {
      throw new Error(`Target currency ${toCode} rate is zero`);
    }

    const calculatedCrossRate = fromUnitRate / toUnitRate;
    const convertedAmount = roundTo(amount * calculatedCrossRate, 4);

    return {
      fromCurrency: fromCode,
      toCurrency: toCode,
      amount,
      rate: roundTo(calculatedCrossRate, 6),
      convertedAmount,
      rateType,
      viaTRY: true
    };
  }

  private resolveRateValue(entry: import('./types').TcmbCurrencyRate, rateType: RateType): number {
    switch (rateType) {
      case 'ForexBuying':
        return entry.forexBuying;
      case 'ForexSelling':
        return entry.forexSelling;
      case 'BanknoteBuying':
        return entry.banknoteBuying ?? entry.forexBuying;
      case 'BanknoteSelling':
        return entry.banknoteSelling ?? entry.forexSelling;
      default:
        return entry.forexSelling;
    }
  }
}

function roundTo(num: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round((num + Number.EPSILON) * factor) / factor;
}
