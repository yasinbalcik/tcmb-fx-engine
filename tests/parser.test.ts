import { describe, it } from 'node:test';
import assert from 'node:assert';
import { parseTcmbXml } from '../src/parser';

const MOCK_TCMB_XML = `<?xml version="1.0" encoding="UTF-8"?>
<?xml-stylesheet type="text/xsl" href="isokur.xsl"?>
<Tarih_Date Tarih="06.10.2026" Date="10/06/2026" Bulten_No="2026/194">
	<Currency CrossOrder="0" Kod="USD" CurrencyCode="USD">
		<Unit>1</Unit>
		<Isim>ABD DOLARI</Isim>
		<CurrencyName>US DOLLAR</CurrencyName>
		<ForexBuying>34.2514</ForexBuying>
		<ForexSelling>34.3132</ForexSelling>
		<BanknoteBuying>34.2274</BanknoteBuying>
		<BanknoteSelling>34.3647</BanknoteSelling>
		<CrossRateUSD/>
		<CrossRateOther/>
	</Currency>
	<Currency CrossOrder="1" Kod="EUR" CurrencyCode="EUR">
		<Unit>1</Unit>
		<Isim>EURO</Isim>
		<CurrencyName>EURO</CurrencyName>
		<ForexBuying>37.5210</ForexBuying>
		<ForexSelling>37.5886</ForexSelling>
		<BanknoteBuying>37.4947</BanknoteBuying>
		<BanknoteSelling>37.6450</BanknoteSelling>
		<CrossRateUSD>1.0954</CrossRateUSD>
		<CrossRateOther/>
	</Currency>
	<Currency CrossOrder="11" Kod="JPY" CurrencyCode="JPY">
		<Unit>100</Unit>
		<Isim>JAPON YENİ</Isim>
		<CurrencyName>JAPONESE YEN</CurrencyName>
		<ForexBuying>23.1540</ForexBuying>
		<ForexSelling>23.3082</ForexSelling>
		<BanknoteBuying>22.8530</BanknoteBuying>
		<BanknoteSelling>23.6345</BanknoteSelling>
		<CrossRateUSD>147.45</CrossRateUSD>
		<CrossRateOther/>
	</Currency>
</Tarih_Date>`;

describe('TCMB XML Parser', () => {
  it('should parse bulletin date and number correctly', () => {
    const parsed = parseTcmbXml(MOCK_TCMB_XML);
    assert.strictEqual(parsed.bulletinNo, '2026/194');
    assert.strictEqual(parsed.date, '2026-10-06');
  });

  it('should extract USD rates accurately', () => {
    const parsed = parseTcmbXml(MOCK_TCMB_XML);
    const usd = parsed.rates['USD'];
    assert.ok(usd, 'USD must be present');
    assert.strictEqual(usd.unit, 1);
    assert.strictEqual(usd.forexBuying, 34.2514);
    assert.strictEqual(usd.forexSelling, 34.3132);
    assert.strictEqual(usd.banknoteBuying, 34.2274);
    assert.strictEqual(usd.banknoteSelling, 34.3647);
  });

  it('should extract EUR with cross rate to USD', () => {
    const parsed = parseTcmbXml(MOCK_TCMB_XML);
    const eur = parsed.rates['EUR'];
    assert.ok(eur, 'EUR must be present');
    assert.strictEqual(eur.forexBuying, 37.5210);
    assert.strictEqual(eur.crossRateUSD, 1.0954);
  });

  it('should handle multi-unit currencies like JPY (unit: 100)', () => {
    const parsed = parseTcmbXml(MOCK_TCMB_XML);
    const jpy = parsed.rates['JPY'];
    assert.ok(jpy, 'JPY must be present');
    assert.strictEqual(jpy.unit, 100);
    assert.strictEqual(jpy.forexBuying, 23.1540);
  });

  it('should inject TRY as base currency (1.0)', () => {
    const parsed = parseTcmbXml(MOCK_TCMB_XML);
    const tryRate = parsed.rates['TRY'];
    assert.ok(tryRate, 'TRY must be present');
    assert.strictEqual(tryRate.forexBuying, 1.0);
    assert.strictEqual(tryRate.unit, 1);
  });

  it('should throw descriptive error for invalid XML', () => {
    assert.throws(() => parseTcmbXml(''), /Invalid TCMB XML/);
  });
});
