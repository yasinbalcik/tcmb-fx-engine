import { parseTcmbXml, RevaluationEngine, RevaluationItem } from '../src';

const SAMPLE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<Tarih_Date Tarih="06.10.2026" Date="10/06/2026" Bulten_No="2026/194">
	<Currency Kod="USD" CurrencyCode="USD">
		<Unit>1</Unit>
		<Isim>ABD DOLARI</Isim>
		<ForexBuying>34.5000</ForexBuying>
		<ForexSelling>34.5600</ForexSelling>
	</Currency>
	<Currency Kod="EUR" CurrencyCode="EUR">
		<Unit>1</Unit>
		<Isim>EURO</Isim>
		<ForexBuying>37.8000</ForexBuying>
		<ForexSelling>37.8700</ForexSelling>
	</Currency>
</Tarih_Date>`;

function main() {
  console.log('=== Corporate Currency Revaluation (Dönem Sonu Kur Değerlemesi) ===');
  const bulletin = parseTcmbXml(SAMPLE_XML);
  const engine = new RevaluationEngine(bulletin);

  const portfolio: RevaluationItem[] = [
    {
      accountCode: '102.01.001',
      accountName: 'Garanti USD Ticari Vadesiz',
      currency: 'USD',
      originalAmount: 25000,
      bookRate: 33.80 // Önceki kur
    },
    {
      accountCode: '120.02.010',
      accountName: 'Almanya İhracat Alacağı (Mustermann GmbH)',
      currency: 'EUR',
      originalAmount: 18000,
      bookRate: 38.20 // Kur düşmüş
    },
    {
      accountCode: '320.01.004',
      accountName: 'Yabancı Hammadde Tedarikçisi Borcu',
      currency: 'USD',
      originalAmount: 12000,
      bookRate: 33.50 // Borç kur artışı nedeniyle arttı -> Zarar
    }
  ];

  const batch = engine.revaluateBatch(portfolio, 'ForexBuying');

  console.log(`\nDönem Tarihi: ${batch.periodDate}`);
  console.log(`Toplam Kambiyo Karı (646):  +${batch.totalProfit.toLocaleString('tr-TR')} TL`);
  console.log(`Toplam Kambiyo Zararı (656): -${batch.totalLoss.toLocaleString('tr-TR')} TL`);
  console.log(`Net Kur Farkı Etkisi:        ${batch.netDifference > 0 ? '+' : ''}${batch.netDifference.toLocaleString('tr-TR')} TL\n`);

  console.log('--- Otomatik Üretilen Mahsup Fişi (Balanced Journal Entry) ---');
  console.log(`Açıklama: ${batch.compoundJournalEntry.description}`);
  console.log(`Denge Durumu: ${batch.compoundJournalEntry.isBalanced ? 'KUSURSUZ (Dengeli)' : 'Dengesiz!'}`);
  console.log('--------------------------------------------------------------------------------');
  console.log('Hesap Kodu     | Hesap Adı                                  | Borç (TL)   | Alacak (TL)');
  console.log('--------------------------------------------------------------------------------');
  for (const line of batch.compoundJournalEntry.lines) {
    const code = line.accountCode.padEnd(14);
    const name = line.accountName.padEnd(42);
    const debit = line.debit > 0 ? line.debit.toFixed(2).padStart(11) : ''.padStart(11);
    const credit = line.credit > 0 ? line.credit.toFixed(2).padStart(11) : ''.padStart(11);
    console.log(`${code} | ${name} | ${debit} | ${credit}`);
  }
  console.log('--------------------------------------------------------------------------------');
  console.log(`TOPLAM:        |                                            | ${batch.compoundJournalEntry.totalDebit.toFixed(2).padStart(11)} | ${batch.compoundJournalEntry.totalCredit.toFixed(2).padStart(11)}`);
}

main();
