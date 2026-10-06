import { describe, it } from 'node:test';
import assert from 'node:assert';
import { parseTcmbXml } from '../src/parser';
import { FxConverter } from '../src/converter';

const MOCK_TCMB_XML = `<?xml version="1.0" encoding="UTF-8"?>
<Tarih_Date Tarih="06.10.2026" Date="10/06/2026" Bulten_No="2026/194">
	<Currency CrossOrder="0" Kod="USD" CurrencyCode="USD">
		<Unit>1</Unit>
		<Isim>ABD DOLARI</Isim>
		<CurrencyName>US DOLLAR</CurrencyName>
		<ForexBuying>34.2500</ForexBuying>
		<ForexSelling>34.3000</ForexSelling>
	</Currency>
	<Currency CrossOrder="1" Kod="EUR" CurrencyCode="EUR">
		<Unit>1</Unit>
		<Isim>EURO</Isim>
		<CurrencyName>EURO</CurrencyName>
		<ForexBuying>37.6750</ForexBuying>
		<ForexSelling>37.7300</ForexSelling>
		<CrossRateUSD>1.1000</CrossRateUSD>
	</Currency>
	<Currency CrossOrder="11" Kod="JPY" CurrencyCode="JPY">
		<Unit>100</Unit>
		<Isim>JAPON YENİ</Isim>
		<CurrencyName>JAPONESE YEN</CurrencyName>
		<ForexBuying>23.0000</ForexBuying>
		<ForexSelling>23.2000</ForexSelling>
	</Currency>
</Tarih_Date>`;

describe('FxConverter', () => {
  const dailyRates = parseTcmbXml(MOCK_TCMB_XML);
  const converter = new FxConverter(dailyRates);

  it('should list supported currencies including TRY', () => {
    const list = converter.getSupportedCurrencies();
    assert.ok(list.includes('USD'));
    assert.ok(list.includes('EUR'));
    assert.ok(list.includes('JPY'));
    assert.ok(list.includes('TRY'));
  });

  it('should return identical amount when from equals to', () => {
    const res = converter.convert({ from: 'USD', to: 'USD', amount: 1500 });
    assert.strictEqual(res.convertedAmount, 1500);
    assert.strictEqual(res.rate, 1.0);
    assert.strictEqual(res.viaTRY, false);
  });

  it('should convert Foreign Currency (USD) to TRY correctly', () => {
    // 100 USD * 34.3000 (ForexSelling default) = 3430.00 TRY
    const res = converter.convert({ from: 'USD', to: 'TRY', amount: 100 });
    assert.strictEqual(res.convertedAmount, 3430.0);
    assert.strictEqual(res.rate, 34.3);
  });

  it('should respect ForexBuying rateType when specified', () => {
    // 100 USD * 34.2500 (ForexBuying) = 3425.00 TRY
    const res = converter.convert({ from: 'USD', to: 'TRY', amount: 100, rateType: 'ForexBuying' });
    assert.strictEqual(res.convertedAmount, 3425.0);
    assert.strictEqual(res.rate, 34.25);
  });

  it('should convert TRY to Foreign Currency (USD) correctly', () => {
    // 3430 TRY / 34.3000 = 100 USD
    const res = converter.convert({ from: 'TRY', to: 'USD', amount: 3430 });
    assert.strictEqual(res.convertedAmount, 100.0);
  });

  it('should handle multi-unit conversion properly (JPY with Unit 100)', () => {
    // JPY Unit = 100, ForexSelling = 23.2000 -> 1 JPY = 0.2320 TRY
    // 10,000 JPY * 0.2320 = 2320.00 TRY
    const res = converter.convert({ from: 'JPY', to: 'TRY', amount: 10000 });
    assert.strictEqual(res.rate, 0.232);
    assert.strictEqual(res.convertedAmount, 2320.0);
  });

  it('should convert cross-currency using official CrossRateUSD', () => {
    // EUR cross rate to USD is 1.1000
    // 1000 EUR * 1.1000 = 1100.00 USD
    const res = converter.convert({ from: 'EUR', to: 'USD', amount: 1000 });
    assert.strictEqual(res.convertedAmount, 1100.0);
    assert.strictEqual(res.rate, 1.1);
    assert.strictEqual(res.viaTRY, false);
  });

  it('should convert cross-currency inverse (USD to EUR)', () => {
    // 1100 USD / 1.1000 = 1000.00 EUR
    const res = converter.convert({ from: 'USD', to: 'EUR', amount: 1100 });
    assert.strictEqual(res.convertedAmount, 1000.0);
  });

  it('should throw error for negative amount', () => {
    assert.throws(() => converter.convert({ from: 'USD', to: 'TRY', amount: -50 }), /cannot be negative/);
  });

  it('should throw error for unknown currency', () => {
    assert.throws(() => converter.convert({ from: 'XYZ', to: 'TRY', amount: 100 }), /not found/);
  });
});
