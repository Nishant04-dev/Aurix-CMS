# Requirements Document

## Introduction

Aurix CMS already has a canonical currency formatter (`src/lib/currency.ts`) and an org-currency hook (`src/hooks/use-org-currency.ts`), but two components bypass them with hardcoded `en-IN` locale formatters. This feature closes those gaps so every monetary value in the UI and PDF layer is formatted consistently using the organization's configured currency and its correct locale.

The scope is intentionally narrow: fix the two non-compliant components, harden the canonical formatter against null/undefined input, and verify no other raw-number displays exist.

## Glossary

- **Formatter**: `formatCurrency(amount, currencyCode)` exported from `src/lib/currency.ts` — the single canonical function for formatting monetary values.
- **OrgCurrency_Hook**: `useOrgCurrency()` exported from `src/hooks/use-org-currency.ts` — the React hook that binds the Formatter to the organization's currency and exposes `fmt(amount)`.
- **FormModals**: The React component file `src/components/FormModals.tsx`.
- **DocumentRenderer**: The React component file `src/components/DocumentRenderer.tsx`.
- **Local_fmt**: Any module-scoped or inline formatting function that is not the canonical Formatter.
- **Currency_Code**: An ISO 4217 string (e.g. `"INR"`, `"USD"`, `"EUR"`) stored in the `currency` column of the organizations table.
- **Locale**: A BCP 47 language tag (e.g. `"en-IN"`, `"en-US"`) mapped per Currency_Code in `SUPPORTED_CURRENCIES`.
- **PDF_Layer**: The html2canvas + jsPDF rendering path triggered by the Download PDF button inside DocumentRenderer.

---

## Requirements

### Requirement 1: Canonical Formatter is the Single Source of Truth

**User Story:** As a developer, I want one authoritative currency formatting function, so that changing locale or symbol behavior requires editing exactly one file.

#### Acceptance Criteria

1. THE Formatter SHALL be the only function in the codebase that converts a numeric amount to a localized currency string for display.
2. THE Formatter SHALL use `Intl.NumberFormat` with the Locale mapped to the given Currency_Code via `SUPPORTED_CURRENCIES`.
3. WHEN a Currency_Code is not found in `SUPPORTED_CURRENCIES`, THE Formatter SHALL fall back to `"INR"` locale (`en-IN`) and the `₹` symbol.
4. WHEN `amount` is `null` or `undefined`, THE Formatter SHALL treat the value as `0` and return a formatted zero string (e.g. `₹0.00`).
5. WHEN `currencyCode` is `null`, `undefined`, or an empty string, THE Formatter SHALL treat the Currency_Code as `"INR"`.
6. THE Formatter SHALL always render exactly 2 decimal places, except for Currency_Codes that have zero decimal places by ISO 4217 convention (e.g. `"JPY"`), in which case THE Formatter SHALL render 0 decimal places.
7. THE Formatter SHALL always render thousand separators appropriate for the resolved Locale (e.g. `1,234.00` for `en-US`, `1,234.00` for `en-IN`).

---

### Requirement 2: FormModals Uses OrgCurrency_Hook

**User Story:** As an admin, I want invoice totals and line-item prices shown in the invoice creation modal to reflect my organization's currency, so that the modal is consistent with the rest of the application.

#### Acceptance Criteria

1. THE FormModals SHALL import and call `useOrgCurrency()` to obtain a bound `fmt` function.
2. THE FormModals SHALL NOT define or call any Local_fmt function for monetary display.
3. WHEN the InvoiceFormModal renders a subtotal, tax line amount, or total, THE FormModals SHALL format each value using the `fmt` function from `useOrgCurrency()`.
4. WHEN the organization's Currency_Code changes, THE FormModals SHALL display updated formatted values on the next render without requiring a page reload.

---

### Requirement 3: DocumentRenderer Uses Locale-Aware Formatter

**User Story:** As an admin, I want invoices and quotations rendered in the correct currency format for the document's currency, so that PDFs and previews show the right symbol and locale.

#### Acceptance Criteria

1. THE DocumentRenderer SHALL import `formatCurrency` from `src/lib/currency.ts`.
2. THE DocumentRenderer SHALL NOT define or call any Local_fmt function for monetary display.
3. WHEN DocumentRenderer renders a unit price, line-item amount, subtotal, tax amount, or total, THE DocumentRenderer SHALL call `formatCurrency(amount, data.currency)` where `data.currency` is the Currency_Code passed via the `DocumentData` prop.
4. WHEN `data.currency` is absent or empty, THE DocumentRenderer SHALL pass `"INR"` as the Currency_Code to the Formatter.
5. WHEN the PDF_Layer captures the rendered document, THE DocumentRenderer SHALL produce formatted currency strings identical to those shown in the live preview.

---

### Requirement 4: No Raw Number Displays in UI or PDF

**User Story:** As a user, I want every monetary value I see — in tables, modals, previews, and PDFs — to show a currency symbol and proper formatting, so that I never see a bare number like `1234` or `1234.00` without a symbol.

#### Acceptance Criteria

1. THE FormModals SHALL NOT render any monetary amount as a plain number string without a currency symbol.
2. THE DocumentRenderer SHALL NOT render any monetary amount as a plain number string without a currency symbol.
3. WHEN an item's `unit_price` or computed line total is zero, THE Formatter SHALL still render a formatted zero (e.g. `₹0.00`) rather than `0` or an empty string.

---

### Requirement 5: Backend Stores Numeric Values Only

**User Story:** As a developer, I want the database to store raw numeric amounts, so that the same data can be formatted differently for different locales without requiring data migration.

#### Acceptance Criteria

1. THE Backend SHALL store all monetary amounts as numeric database types (e.g. `NUMERIC`, `DECIMAL`) without currency symbols or locale-specific separators.
2. THE Backend SHALL NOT apply any currency formatting before returning amounts in API responses.
3. WHEN the Frontend receives an amount from the API, THE Frontend SHALL be responsible for all currency formatting before display.
