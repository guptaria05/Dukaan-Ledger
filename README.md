# Dukaan Ledger

A mobile-first shop-management app for independent retailers.

## Current build

- Expo SDK 58, React Native and TypeScript.
- Local SQLite persistence (offline-first).
- Product inventory and low-stock visibility.
- Purchase recording with weighted-average inventory cost.
- Sales with stock deduction and partial payments.
- Customer ledger and outstanding balances (udhaar).
- Customer payment collection.
- Shop expense entry and monthly gross/net profit summaries.
- GitHub Actions checks for dependency compatibility, Expo diagnostics, TypeScript, unit tests and Android bundle export.

## Run locally

Requirements: Node.js 22.13+ and npm.

```bash
npm install
npx expo install --fix
npx expo start
```

Run checks:

```bash
npm run doctor
npm run typecheck
npm test
npm run export:android
```

## Build an installable Android APK

The project includes EAS build profiles. After creating an Expo account and configuring EAS:

```bash
npx eas-cli build --platform android --profile preview
```

The preview profile creates an APK for direct installation. The production profile creates an Android App Bundle for a future Play Store release. Build signing and release credentials must remain in the build service, never in Git.

## Data and privacy

The current milestone stores shop records locally in SQLite on the device. It does not yet include user accounts, cloud synchronization, remote backup or a production backend. See [the privacy policy draft](docs/privacy-policy.md).

Cloud accounts, multiple shops, employee permissions and cross-device sync are planned, not yet implemented. Do not use this development build as the only record of a real shop's accounts until backup/export and recovery have been completed and tested.

## Financial calculations

Money is stored as integer paise. Sales capture the product's weighted-average unit cost at the time of sale, so later purchase-price changes do not rewrite the cost used for historical gross-profit calculations. Customer credit sales require a customer record.

## Project docs

- [Architecture](docs/architecture.md)
- [Roadmap](docs/roadmap.md)
- [Testing strategy](docs/testing.md)
- [Privacy policy draft](docs/privacy-policy.md)

Private project. Add a license before distributing the source publicly.
