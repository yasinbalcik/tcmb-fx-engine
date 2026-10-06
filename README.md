# tcmb-fx-engine 🇹🇷

[![CI](https://github.com/yasinbalcik/tcmb-fx-engine/actions/workflows/ci.yml/badge.svg)](https://github.com/yasinbalcik/tcmb-fx-engine/actions)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![Zero Dependencies](https://img.shields.io/badge/dependencies-0-brightgreen.svg)](package.json)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Zero-dependency, type-safe TypeScript engine for TCMB (Central Bank of the Republic of Turkey / Türkiye Cumhuriyet Merkez Bankası) exchange rates, cross-currency math, and corporate foreign exchange revaluation (VUK & TDHP 646/656).**

---

## ⚡ Core Capabilities

- **Zero Runtime Dependencies:** Built strictly using modern TypeScript and native web/Node APIs (`fetch`). No external XML or HTTP libraries.
- **TCMB Daily & Historical Feed:** Parses official TCMB daily rate bulletins (`/kurlar/today.xml` and historical `/kurlar/YYYYMM/DDMMYYYY.xml`).
- **Precision Currency Conversion:**
  - Direct conversion (Forex to TRY and TRY to Forex).
  - Cross-currency conversions (EUR/USD, GBP/USD, etc.) utilizing official TCMB cross rates and triangular conversion.
  - Multi-unit scaling (e.g. 100 JPY / 100 IRR).
  - High-precision decimal rounding preventing IEEE 754 floating-point drift.
- **Corporate Accounting & VUK Revaluation (Dönem Sonu Kur Değerlemesi):**
  - Revaluates foreign currency asset (100 Kasa, 102 Banka, 120 Alıcılar) and liability (320 Satıcılar, 300 Krediler) balances.
  - Automatically classifies exchange gains and losses into Turkish Uniform Chart of Accounts (**TDHP 646 Kambiyo Karları** / **656 Kambiyo Zararları**).
  - Generates balanced compound accounting journal entries (Mahsup Fişi) with exact penny verification (`totalDebit === totalCredit`).

---

## 📦 Installation

```bash
npm install tcmb-fx-engine
# or using pnpm / yarn
pnpm add tcmb-fx-engine
```

---

## 🚀 Quickstart

### 1. Fetching & Converting Rates

```typescript
import { TcmbClient, FxConverter } from 'tcmb-fx-engine';

// Fetch today's official rates from TCMB
const bulletin = await TcmbClient.fetchToday();
console.log(`TCMB Bulletin: ${bulletin.date} (No: ${bulletin.bulletinNo})`);

const converter = new FxConverter(bulletin);

// Convert 1,500 USD to TRY (using ForexSelling)
const usdToTry = converter.convert({
  from: 'USD',
  to: 'TRY',
  amount: 1500
});
console.log(`1,500 USD = ${usdToTry.convertedAmount} TRY (Rate: ${usdToTry.rate})`);

// Cross-currency conversion: EUR to USD
const eurToUsd = converter.convert({
  from: 'EUR',
  to: 'USD',
  amount: 1000
});
console.log(`1,000 EUR = ${eurToUsd.convertedAmount} USD (Cross Rate: ${eurToUsd.rate})`);
```

---

### 2. Corporate Revaluation & Automated Journal Entries (TDHP 646/656)

```typescript
import { TcmbClient, RevaluationEngine, RevaluationItem } from 'tcmb-fx-engine';

const bulletin = await TcmbClient.fetchToday();
const engine = new RevaluationEngine(bulletin);

// Define foreign currency ledger portfolio
const portfolio: RevaluationItem[] = [
  {
    accountCode: '102.01.001',
    accountName: 'Garanti USD Ticari Vadesiz',
    currency: 'USD',
    originalAmount: 25000,
    bookRate: 33.80 // Recorded book rate
  },
  {
    accountCode: '320.01.004',
    accountName: 'Yabancı Hammadde Tedarikçisi Borcu',
    currency: 'USD',
    originalAmount: 12000,
    bookRate: 33.50 // Liability (Borç)
  }
];

// Perform batch revaluation at ForexBuying rate (VUK standard)
const summary = engine.revaluateBatch(portfolio, 'ForexBuying');

console.log(`Toplam Kambiyo Karı (646):  +${summary.totalProfit} TL`);
console.log(`Toplam Kambiyo Zararı (656): -${summary.totalLoss} TL`);
console.log(`Net Kur Farkı:               ${summary.netDifference} TL`);

// Inspect generated balanced journal entry (Mahsup Fişi)
console.log(`Balanced: ${summary.compoundJournalEntry.isBalanced}`);
console.log(`Total Debit:  ${summary.compoundJournalEntry.totalDebit}`);
console.log(`Total Credit: ${summary.compoundJournalEntry.totalCredit}`);
```

---

## 🛠️ Testing & Verification

Comprehensive test suite covering XML parsing, multi-unit calculations, cross rates, and double-entry accounting balance:

```bash
npm test
```

Result:
```text
✔ FxConverter (10 tests passing)
✔ TCMB XML Parser (6 tests passing)
✔ RevaluationEngine (VUK & TDHP 646/656) (4 tests passing)
ℹ pass 20 / fail 0
```

---

## 📄 License

MIT © [Yasin BALÇIK](https://github.com/yasinbalcik)
