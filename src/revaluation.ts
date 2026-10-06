import { 
  TcmbDailyRates, 
  RateType, 
  RevaluationItem, 
  RevaluationResult, 
  BatchRevaluationSummary, 
  JournalEntry, 
  JournalEntryLine 
} from './types';
import { FxConverter } from './converter';

/**
 * Corporate Foreign Currency Revaluation Engine (VUK & TDHP 646/656)
 */
export class RevaluationEngine {
  private converter: FxConverter;
  private periodDate: string;

  constructor(dailyRates: TcmbDailyRates) {
    this.converter = new FxConverter(dailyRates);
    this.periodDate = dailyRates.date;
  }

  /**
   * Revaluates a single account balance against TCMB bulletin rates.
   * In VUK standards:
   * - Foreign currency cash (100) and bank balances (102) are valued at Forex Buying (Döviz Alış) or Banknote Buying (Efektif Alış).
   * - Receivables (120) and payables (320) are valued at Forex Buying rate (Maliye Bakanlığı tebliği gereği).
   */
  public revaluate(item: RevaluationItem, rateType: RateType = 'ForexBuying'): RevaluationResult {
    const rateEntry = this.converter.getRate(item.currency);
    if (!rateEntry) {
      throw new Error(`Currency ${item.currency} not found in TCMB bulletin`);
    }

    const rawCurrentRate = rateType === 'ForexBuying' 
      ? rateEntry.forexBuying 
      : (rateType === 'BanknoteBuying' ? (rateEntry.banknoteBuying ?? rateEntry.forexBuying) : rateEntry.forexSelling);
    
    const currentRate = roundTo(rawCurrentRate / rateEntry.unit, 4);
    const bookTRYAmount = item.bookTRYAmount ?? roundTo(item.originalAmount * item.bookRate, 2);
    const currentTRYAmount = roundTo(item.originalAmount * currentRate, 2);

    const isLiability = isLiabilityAccount(item.accountCode);
    const rawDiff = currentTRYAmount - bookTRYAmount;

    // For Assets (Aktif): If current > book -> Profit
    // For Liabilities (Pasif): If current > book -> Loss (debt increased in TRY)
    let isProfit = false;
    let differenceType: 'PROFIT' | 'LOSS' | 'NEUTRAL' = 'NEUTRAL';

    if (Math.abs(rawDiff) < 0.009) {
      differenceType = 'NEUTRAL';
    } else if (!isLiability) {
      // Asset
      isProfit = rawDiff > 0;
      differenceType = isProfit ? 'PROFIT' : 'LOSS';
    } else {
      // Liability
      isProfit = rawDiff < 0;
      differenceType = isProfit ? 'PROFIT' : 'LOSS';
    }

    const exchangeDifference = roundTo(Math.abs(rawDiff), 2);
    const suggestedAccount = isProfit ? '646' : '656';

    return {
      accountCode: item.accountCode,
      accountName: item.accountName,
      currency: item.currency.toUpperCase(),
      originalAmount: item.originalAmount,
      bookRate: item.bookRate,
      currentRate,
      bookTRYAmount,
      currentTRYAmount,
      exchangeDifference,
      isProfit,
      differenceType,
      suggestedAccount
    };
  }

  /**
   * Revaluates an entire ledger of foreign currency accounts and generates
   * a balanced compound journal entry (Mahsup Fişi).
   */
  public revaluateBatch(items: RevaluationItem[], rateType: RateType = 'ForexBuying'): BatchRevaluationSummary {
    const results: RevaluationResult[] = [];
    let totalProfit = 0;
    let totalLoss = 0;

    const lines: JournalEntryLine[] = [];

    for (const item of items) {
      const res = this.revaluate(item, rateType);
      results.push(res);

      if (res.differenceType === 'NEUTRAL' || res.exchangeDifference === 0) {
        continue;
      }

      const isLiability = isLiabilityAccount(item.accountCode);

      if (res.isProfit) {
        totalProfit += res.exchangeDifference;
        if (!isLiability) {
          // Asset value increased: Debit Asset, Credit 646
          lines.push({
            accountCode: item.accountCode,
            accountName: `${item.accountName} (Kur Değerleme)`,
            debit: res.exchangeDifference,
            credit: 0
          });
          lines.push({
            accountCode: '646.01.001',
            accountName: 'Kambiyo Karları',
            debit: 0,
            credit: res.exchangeDifference
          });
        } else {
          // Liability value decreased: Debit Liability, Credit 646
          lines.push({
            accountCode: item.accountCode,
            accountName: `${item.accountName} (Kur Değerleme)`,
            debit: res.exchangeDifference,
            credit: 0
          });
          lines.push({
            accountCode: '646.01.001',
            accountName: 'Kambiyo Karları',
            debit: 0,
            credit: res.exchangeDifference
          });
        }
      } else {
        totalLoss += res.exchangeDifference;
        if (!isLiability) {
          // Asset value decreased: Debit 656, Credit Asset
          lines.push({
            accountCode: '656.01.001',
            accountName: 'Kambiyo Zararları',
            debit: res.exchangeDifference,
            credit: 0
          });
          lines.push({
            accountCode: item.accountCode,
            accountName: `${item.accountName} (Kur Değerleme)`,
            debit: 0,
            credit: res.exchangeDifference
          });
        } else {
          // Liability value increased: Debit 656, Credit Liability
          lines.push({
            accountCode: '656.01.001',
            accountName: 'Kambiyo Zararları',
            debit: res.exchangeDifference,
            credit: 0
          });
          lines.push({
            accountCode: item.accountCode,
            accountName: `${item.accountName} (Kur Değerleme)`,
            debit: 0,
            credit: res.exchangeDifference
          });
        }
      }
    }

    totalProfit = roundTo(totalProfit, 2);
    totalLoss = roundTo(totalLoss, 2);
    const netDifference = roundTo(totalProfit - totalLoss, 2);

    const totalDebit = roundTo(lines.reduce((sum, l) => sum + l.debit, 0), 2);
    const totalCredit = roundTo(lines.reduce((sum, l) => sum + l.credit, 0), 2);

    const compoundJournalEntry: JournalEntry = {
      date: this.periodDate,
      description: `TCMB Kurları Dönem Sonu Kur Farkı Değerleme Kaydı (${this.periodDate})`,
      lines,
      totalDebit,
      totalCredit,
      isBalanced: Math.abs(totalDebit - totalCredit) < 0.01
    };

    return {
      periodDate: this.periodDate,
      totalProfit,
      totalLoss,
      netDifference,
      results,
      compoundJournalEntry
    };
  }
}

/**
 * Determines whether an account code belongs to Liabilities (Pasif - Borç/Kaynak)
 * in Turkish Uniform Chart of Accounts (TDHP).
 * 3xx: Kısa Vadeli Yabancı Kaynaklar (300 Banka Kredileri, 320 Satıcılar vb.)
 * 4xx: Uzun Vadeli Yabancı Kaynaklar
 */
function isLiabilityAccount(accountCode: string): boolean {
  const clean = accountCode.trim();
  return clean.startsWith('3') || clean.startsWith('4');
}

function roundTo(num: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round((num + Number.EPSILON) * factor) / factor;
}
