/**
 * tcmb-fx-engine: Type Definitions
 * Zero-dependency TypeScript definitions for TCMB exchange rates,
 * cross-currency math, and corporate revaluation (VUK & TDHP 646/656).
 */

export type RateType = 'ForexBuying' | 'ForexSelling' | 'BanknoteBuying' | 'BanknoteSelling';

export interface TcmbCurrencyRate {
  currencyCode: string;
  currencyName: string;
  unit: number;
  forexBuying: number;
  forexSelling: number;
  banknoteBuying?: number;
  banknoteSelling?: number;
  crossRateUSD?: number;
  crossRateOther?: number;
}

export interface TcmbDailyRates {
  date: string; // YYYY-MM-DD
  bulletinNo: string;
  rates: Record<string, TcmbCurrencyRate>;
}

export interface ConvertOptions {
  from: string;
  to: string;
  amount: number;
  rateType?: RateType;
}

export interface ConversionResult {
  fromCurrency: string;
  toCurrency: string;
  amount: number;
  rate: number;
  convertedAmount: number;
  rateType: RateType;
  viaTRY: boolean;
}

export interface RevaluationItem {
  accountCode: string;
  accountName: string;
  currency: string;
  originalAmount: number;
  bookRate: number;
  bookTRYAmount?: number;
}

export interface JournalEntryLine {
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
}

export interface JournalEntry {
  date: string;
  description: string;
  lines: JournalEntryLine[];
  totalDebit: number;
  totalCredit: number;
  isBalanced: boolean;
}

export interface RevaluationResult {
  accountCode: string;
  accountName: string;
  currency: string;
  originalAmount: number;
  bookRate: number;
  currentRate: number;
  bookTRYAmount: number;
  currentTRYAmount: number;
  exchangeDifference: number;
  isProfit: boolean;
  differenceType: 'PROFIT' | 'LOSS' | 'NEUTRAL';
  suggestedAccount: string; // 646 or 656
}

export interface BatchRevaluationSummary {
  periodDate: string;
  totalProfit: number;
  totalLoss: number;
  netDifference: number;
  results: RevaluationResult[];
  compoundJournalEntry: JournalEntry;
}
