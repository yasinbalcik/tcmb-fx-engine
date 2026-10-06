import { TcmbCurrencyRate, TcmbDailyRates } from './types';

/**
 * Parses official TCMB exchange rate XML string into typed TcmbDailyRates.
 * Zero external dependencies.
 */
export function parseTcmbXml(xmlContent: string): TcmbDailyRates {
  if (!xmlContent || typeof xmlContent !== 'string') {
    throw new Error('Invalid TCMB XML content: empty or not a string');
  }

  // Extract Tarih_Date attributes
  const dateMatch = xmlContent.match(/<Tarih_Date\s+[^>]*Date="([^"]+)"[^>]*Bulten_No="([^"]+)"/i) 
    || xmlContent.match(/<Tarih_Date\s+[^>]*Tarih="([^"]+)"[^>]*Bulten_No="([^"]+)"/i);

  let formattedDate = new Date().toISOString().split('T')[0]!;
  let bulletinNo = 'N/A';

  if (dateMatch && dateMatch[1] && dateMatch[2]) {
    bulletinNo = dateMatch[2].trim();
    const rawDate = dateMatch[1].trim();
    // Check if rawDate is MM/DD/YYYY or DD.MM.YYYY
    if (rawDate.includes('/')) {
      const parts = rawDate.split('/');
      if (parts.length === 3) {
        // MM/DD/YYYY -> YYYY-MM-DD
        const month = parts[0]!.padStart(2, '0');
        const day = parts[1]!.padStart(2, '0');
        const year = parts[2]!;
        formattedDate = `${year}-${month}-${day}`;
      }
    } else if (rawDate.includes('.')) {
      const parts = rawDate.split('.');
      if (parts.length === 3) {
        // DD.MM.YYYY -> YYYY-MM-DD
        const day = parts[0]!.padStart(2, '0');
        const month = parts[1]!.padStart(2, '0');
        const year = parts[2]!;
        formattedDate = `${year}-${month}-${day}`;
      }
    }
  }

  const rates: Record<string, TcmbCurrencyRate> = {};

  // Match all <Currency ...> ... </Currency> blocks
  const currencyBlockRegex = /<Currency\s+[^>]*CurrencyCode="([^"]+)"[^>]*>([\s\S]*?)<\/Currency>/gi;
  let blockMatch: RegExpExecArray | null;

  while ((blockMatch = currencyBlockRegex.exec(xmlContent)) !== null) {
    const code = blockMatch[1]!.trim().toUpperCase();
    const body = blockMatch[2]!;

    const unit = parseInt(extractTag(body, 'Unit') || '1', 10);
    const currencyName = extractTag(body, 'CurrencyName') || extractTag(body, 'Isim') || code;
    const forexBuying = parseFloat(extractTag(body, 'ForexBuying') || '0');
    const forexSelling = parseFloat(extractTag(body, 'ForexSelling') || '0');
    
    const banknoteBuyingStr = extractTag(body, 'BanknoteBuying');
    const banknoteSellingStr = extractTag(body, 'BanknoteSelling');
    const crossRateUsdStr = extractTag(body, 'CrossRateUSD');
    const crossRateOtherStr = extractTag(body, 'CrossRateOther');

    const rateEntry: TcmbCurrencyRate = {
      currencyCode: code,
      currencyName,
      unit: isNaN(unit) || unit <= 0 ? 1 : unit,
      forexBuying: isNaN(forexBuying) ? 0 : forexBuying,
      forexSelling: isNaN(forexSelling) ? 0 : forexSelling,
      ...(banknoteBuyingStr ? { banknoteBuying: parseFloat(banknoteBuyingStr) } : {}),
      ...(banknoteSellingStr ? { banknoteSelling: parseFloat(banknoteSellingStr) } : {}),
      ...(crossRateUsdStr ? { crossRateUSD: parseFloat(crossRateUsdStr) } : {}),
      ...(crossRateOtherStr ? { crossRateOther: parseFloat(crossRateOtherStr) } : {})
    };

    rates[code] = rateEntry;
  }

  // Always inject TRY as base currency (1 TRY = 1 TRY)
  rates['TRY'] = {
    currencyCode: 'TRY',
    currencyName: 'TÜRK LİRASI',
    unit: 1,
    forexBuying: 1.0,
    forexSelling: 1.0,
    banknoteBuying: 1.0,
    banknoteSelling: 1.0
  };

  return {
    date: formattedDate,
    bulletinNo,
    rates
  };
}

function extractTag(xml: string, tagName: string): string | null {
  const match = xml.match(new RegExp(`<${tagName}>([^<]*)<\\/${tagName}>`, 'i'));
  if (match && match[1]) {
    const val = match[1].trim();
    return val.length > 0 ? val : null;
  }
  return null;
}
