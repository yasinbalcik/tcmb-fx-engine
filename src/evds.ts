import { parseTcmbXml } from './parser';
import { TcmbDailyRates } from './types';

/**
 * TCMB Web and EVDS API Client (Zero external dependencies).
 */
export class TcmbClient {
  /**
   * Fetches and parses today's official TCMB exchange rate bulletin.
   */
  public static async fetchToday(): Promise<TcmbDailyRates> {
    const xml = await httpGet('https://www.tcmb.gov.tr/kurlar/today.xml');
    return parseTcmbXml(xml);
  }

  /**
   * Fetches and parses historical TCMB bulletin by date.
   * Format: YYYY-MM-DD or Date object.
   */
  public static async fetchHistorical(date: Date | string): Promise<TcmbDailyRates> {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) {
      throw new Error(`Invalid date provided for historical bulletin: ${date}`);
    }

    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');

    // TCMB Historical URL Format: /kurlar/YYYYMM/DDMMYYYY.xml
    const url = `https://www.tcmb.gov.tr/kurlar/${year}${month}/${day}${month}${year}.xml`;
    const xml = await httpGet(url);
    return parseTcmbXml(xml);
  }

  /**
   * Parses official TCMB EVDS (Electronic Data Distribution System) v2 JSON response.
   */
  public static parseEvdsJson(evdsJson: any): Record<string, number> {
    if (!evdsJson || !Array.isArray(evdsJson.items)) {
      throw new Error('Invalid EVDS JSON: expected items array');
    }

    const results: Record<string, number> = {};
    for (const item of evdsJson.items) {
      const dateKey = item.Tarih || item.date;
      if (!dateKey) continue;

      for (const [key, val] of Object.entries(item)) {
        if (key === 'Tarih' || key === 'date') continue;
        if (val !== null && val !== undefined) {
          const num = parseFloat(String(val));
          if (!isNaN(num)) {
            results[`${dateKey}_${key}`] = num;
          }
        }
      }
    }
    return results;
  }
}

async function httpGet(urlStr: string): Promise<string> {
  const res = await fetch(urlStr);
  if (!res.ok) {
    throw new Error(`TCMB request failed with status code ${res.status} for ${urlStr}`);
  }
  return res.text();
}
