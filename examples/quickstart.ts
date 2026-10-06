import { parseTcmbXml, FxConverter } from '../src';

const SAMPLE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<Tarih_Date Tarih="06.10.2026" Date="10/06/2026" Bulten_No="2026/194">
	<Currency Kod="USD" CurrencyCode="USD">
		<Unit>1</Unit>
		<Isim>ABD DOLARI</Isim>
		<CurrencyName>US DOLLAR</CurrencyName>
		<ForexBuying>34.2514</ForexBuying>
		<ForexSelling>34.3132</ForexSelling>
	</Currency>
	<Currency Kod="EUR" CurrencyCode="EUR">
		<Unit>1</Unit>
		<Isim>EURO</Isim>
		<CurrencyName>EURO</CurrencyName>
		<ForexBuying>37.5210</ForexBuying>
		<ForexSelling>37.5886</ForexSelling>
		<CrossRateUSD>1.0954</CrossRateUSD>
	</Currency>
</Tarih_Date>`;

function main() {
  console.log('--- TCMB FX Engine Quickstart ---');
  const bulletin = parseTcmbXml(SAMPLE_XML);
  console.log(`Bulletin Date: ${bulletin.date} (No: ${bulletin.bulletinNo})`);

  const converter = new FxConverter(bulletin);

  // Convert 1,500 USD to TRY
  const usdToTry = converter.convert({ from: 'USD', to: 'TRY', amount: 1500 });
  console.log(`1,500 USD = ${usdToTry.convertedAmount} TRY (Rate: ${usdToTry.rate})`);

  // Convert 1,000 EUR to USD
  const eurToUsd = converter.convert({ from: 'EUR', to: 'USD', amount: 1000 });
  console.log(`1,000 EUR = ${eurToUsd.convertedAmount} USD (Cross Rate: ${eurToUsd.rate})`);
}

main();
