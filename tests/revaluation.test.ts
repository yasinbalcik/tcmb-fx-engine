import { describe, it } from 'node:test';
import assert from 'node:assert';
import { parseTcmbXml } from '../src/parser';
import { RevaluationEngine } from '../src/revaluation';
import { RevaluationItem } from '../src/types';

const MOCK_TCMB_XML = `<?xml version="1.0" encoding="UTF-8"?>
<Tarih_Date Tarih="06.10.2026" Date="10/06/2026" Bulten_No="2026/194">
	<Currency CrossOrder="0" Kod="USD" CurrencyCode="USD">
		<Unit>1</Unit>
		<Isim>ABD DOLARI</Isim>
		<CurrencyName>US DOLLAR</CurrencyName>
		<ForexBuying>35.0000</ForexBuying>
		<ForexSelling>35.1000</ForexSelling>
	</Currency>
	<Currency CrossOrder="1" Kod="EUR" CurrencyCode="EUR">
		<Unit>1</Unit>
		<Isim>EURO</Isim>
		<CurrencyName>EURO</CurrencyName>
		<ForexBuying>38.0000</ForexBuying>
		<ForexSelling>38.2000</ForexSelling>
	</Currency>
</Tarih_Date>`;

describe('RevaluationEngine (VUK & TDHP 646/656)', () => {
  const dailyRates = parseTcmbXml(MOCK_TCMB_XML);
  const engine = new RevaluationEngine(dailyRates);

  it('should calculate exchange gain (646) for Asset account when rate increases', () => {
    // 102.01 Banka USD hesabı:
    // 10,000 USD defterde 34.00 TL ile kayıtlı = 340,000 TL
    // Dönem sonu TCMB Alış kuru = 35.00 TL = 350,000 TL
    // Kur farkı = +10,000 TL (Kambiyo Karı - 646)
    const item: RevaluationItem = {
      accountCode: '102.01.001',
      accountName: 'Garanti Bankası USD Hesabı',
      currency: 'USD',
      originalAmount: 10000,
      bookRate: 34.00
    };

    const res = engine.revaluate(item, 'ForexBuying');
    assert.strictEqual(res.bookTRYAmount, 340000.0);
    assert.strictEqual(res.currentTRYAmount, 350000.0);
    assert.strictEqual(res.exchangeDifference, 10000.0);
    assert.strictEqual(res.isProfit, true);
    assert.strictEqual(res.differenceType, 'PROFIT');
    assert.strictEqual(res.suggestedAccount, '646');
  });

  it('should calculate exchange loss (656) for Asset account when rate decreases', () => {
    // 120.01 Alıcılar EUR hesabı:
    // 5,000 EUR defterde 39.00 TL ile kayıtlı = 195,000 TL
    // Dönem sonu TCMB Alış kuru = 38.00 TL = 190,000 TL
    // Kur farkı = -5,000 TL (Kambiyo Zararı - 656)
    const item: RevaluationItem = {
      accountCode: '120.01.005',
      accountName: 'Yurt Dışı Müşteri Alacağı',
      currency: 'EUR',
      originalAmount: 5000,
      bookRate: 39.00
    };

    const res = engine.revaluate(item, 'ForexBuying');
    assert.strictEqual(res.bookTRYAmount, 195000.0);
    assert.strictEqual(res.currentTRYAmount, 190000.0);
    assert.strictEqual(res.exchangeDifference, 5000.0);
    assert.strictEqual(res.isProfit, false);
    assert.strictEqual(res.differenceType, 'LOSS');
    assert.strictEqual(res.suggestedAccount, '656');
  });

  it('should calculate exchange loss (656) for Liability account (320 Satıcılar) when rate increases', () => {
    // 320.01 Satıcılar USD hesabı (Borç):
    // 10,000 USD borç defterde 33.00 TL ile kayıtlı = 330,000 TL
    // Dönem sonu TCMB Alış kuru = 35.00 TL = 350,000 TL (Borcumuz arttı!)
    // Kur farkı = 20,000 TL Zarar (Kambiyo Zararı - 656)
    const item: RevaluationItem = {
      accountCode: '320.01.002',
      accountName: 'Yabancı Tedarikçi Borcu',
      currency: 'USD',
      originalAmount: 10000,
      bookRate: 33.00
    };

    const res = engine.revaluate(item, 'ForexBuying');
    assert.strictEqual(res.bookTRYAmount, 330000.0);
    assert.strictEqual(res.currentTRYAmount, 350000.0);
    assert.strictEqual(res.exchangeDifference, 20000.0);
    assert.strictEqual(res.isProfit, false);
    assert.strictEqual(res.differenceType, 'LOSS');
    assert.strictEqual(res.suggestedAccount, '656');
  });

  it('should generate balanced compound journal entry (Mahsup Fişi) in batch revaluation', () => {
    const items: RevaluationItem[] = [
      {
        accountCode: '102.01.001',
        accountName: 'Banka USD',
        currency: 'USD',
        originalAmount: 10000,
        bookRate: 34.00 // +10,000 TL Kar
      },
      {
        accountCode: '120.01.001',
        accountName: 'Alıcı EUR',
        currency: 'EUR',
        originalAmount: 2000,
        bookRate: 39.00 // -2,000 TL Zarar
      }
    ];

    const batch = engine.revaluateBatch(items, 'ForexBuying');
    assert.strictEqual(batch.totalProfit, 10000.0);
    assert.strictEqual(batch.totalLoss, 2000.0);
    assert.strictEqual(batch.netDifference, 8000.0);

    const entry = batch.compoundJournalEntry;
    assert.strictEqual(entry.isBalanced, true, 'Journal entry must be mathematically balanced');
    assert.strictEqual(entry.totalDebit, entry.totalCredit);
    assert.strictEqual(entry.totalDebit, 12000.0); // 10k profit + 2k loss booked to both sides
  });
});
