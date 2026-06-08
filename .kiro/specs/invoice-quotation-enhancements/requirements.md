# Requirements Document

## Introduction

This feature enhances the Aurix CMS invoice and quotation system with production-grade capabilities. The scope covers: complete client detail rendering in documents, new billing/payment organization settings (terms, payment terms, bank details, UPI ID), an updated DocumentRenderer that displays payment information and legal sections, improved document layout and spacing, and a mandatory hardcoded "Powered by Aurix Development" branding footer on all documents. All changes must be backward-compatible and null-safe.

## Glossary

- **DocumentRenderer**: The single React component (`src/components/DocumentRenderer.tsx`) responsible for rendering invoice and quotation previews and PDF exports.
- **Organization**: A tenant workspace in Aurix CMS, stored in the `organizations` Supabase table.
- **Client**: A billing contact stored in the `clients` table, linked to an organization via `org_id`.
- **Invoice**: A financial document stored in the `invoices` table, joined with `clients` and `invoice_items`.
- **Quotation**: A pre-invoice estimate stored in the `quotations` table, joined with `clients` and `quotation_items`.
- **Bill To Section**: The area in DocumentRenderer that displays the recipient's contact details.
- **Payment Information Section**: A new section in DocumentRenderer showing bank details and UPI ID.
- **Payment Terms Section**: A new section in DocumentRenderer showing payment schedule/conditions.
- **Terms & Conditions Section**: A new section in DocumentRenderer showing legal terms.
- **Aurix Footer**: The mandatory hardcoded branding footer: "Powered by Aurix Development".
- **Settings Page**: The `src/pages/Settings.tsx` page where organization admins configure workspace settings.
- **OrgSettingsForm**: The form component within Settings.tsx that handles organization data.
- **Backend API**: The Express.js backend at `backend/src/`.
- **Supabase**: The PostgreSQL database and auth provider used by Aurix CMS.

---

## Requirements

### Requirement 1: Full Client Details in Document Queries

**User Story:** As an organization admin, I want invoices and quotations to display the client's full contact details (name, email, phone, address), so that documents are complete and professional.

#### Acceptance Criteria

1. THE Invoice_Query SHALL join the `clients` table and return a client object containing `id`, `name`, `company`, `email`, `phone`, and `address` fields.
2. THE Quotation_Query SHALL join the `clients` table and return a client object containing `id`, `name`, `company`, `email`, `phone`, and `address` fields.
3. WHEN a client record has a `null` value for `phone` or `address`, THE Invoice_Query SHALL still return the client object with those fields set to `null` rather than omitting the client object.
4. WHEN a client record has a `null` value for `phone` or `address`, THE Quotation_Query SHALL still return the client object with those fields set to `null` rather than omitting the client object.

---

### Requirement 2: Full Client Details Rendered in Bill To Section

**User Story:** As a client receiving an invoice or quotation, I want to see my full contact details in the "Bill To" section, so that the document is accurate and professional.

#### Acceptance Criteria

1. WHEN a document is rendered, THE DocumentRenderer SHALL display the client's name in bold as the primary line of the Bill To section.
2. WHEN a document is rendered and `client.email` is not null, THE DocumentRenderer SHALL display the client's email address below the client name.
3. WHEN a document is rendered and `client.phone` is not null, THE DocumentRenderer SHALL display the client's phone number in the Bill To section.
4. WHEN a document is rendered and `client.address` is not null, THE DocumentRenderer SHALL display the client's address with multi-line support (preserving line breaks) in the Bill To section.
5. WHEN a document is rendered and a client field (`email`, `phone`, or `address`) is `null` or an empty string, THE DocumentRenderer SHALL hide that line entirely rather than rendering an empty or placeholder line.

---

### Requirement 3: New Billing & Payment Columns in Organizations Table

**User Story:** As an organization admin, I want to store terms, payment terms, bank details, and UPI ID at the organization level, so that this information can be included on all invoices and quotations automatically.

#### Acceptance Criteria

1. THE Database_Migration SHALL add a `terms` column of type `TEXT`, nullable, with a default of `NULL` to the `organizations` table.
2. THE Database_Migration SHALL add a `payment_terms` column of type `TEXT`, nullable, with a default of `NULL` to the `organizations` table.
3. THE Database_Migration SHALL add a `bank_details` column of type `TEXT`, nullable, with a default of `NULL` to the `organizations` table.
4. THE Database_Migration SHALL add a `upi_id` column of type `VARCHAR(100)`, nullable, with a default of `NULL` to the `organizations` table.
5. THE Database_Migration SHALL NOT alter or drop any existing columns in the `organizations` table.
6. WHEN the migration is applied to an organization with existing data, THE Database_Migration SHALL leave all pre-existing column values unchanged.

---

### Requirement 4: Backend API Supports New Organization Fields

**User Story:** As an organization admin, I want the settings API to accept and persist the new billing fields, so that my payment information is saved correctly.

#### Acceptance Criteria

1. THE Organization_API SHALL accept `terms` (string, max 5000 chars, nullable) in the update organization request body.
2. THE Organization_API SHALL accept `payment_terms` (string, max 2000 chars, nullable) in the update organization request body.
3. THE Organization_API SHALL accept `bank_details` (string, max 2000 chars, nullable) in the update organization request body.
4. THE Organization_API SHALL accept `upi_id` (string, max 100 chars, nullable) in the update organization request body.
5. THE Organization_API SHALL include `terms`, `payment_terms`, `bank_details`, and `upi_id` in the `GET /organizations` response payload.
6. THE Organization_API SHALL include `terms`, `payment_terms`, `bank_details`, and `upi_id` in the `PATCH /organizations` response payload.
7. IF a request to update the organization contains a field value that exceeds the defined maximum length, THEN THE Organization_API SHALL return a 400 Bad Request error with a descriptive message.

---

### Requirement 5: Billing & Payment Settings UI

**User Story:** As an organization admin, I want a dedicated "Billing & Payment Settings" section in the Settings page, so that I can configure and save payment information that appears on documents.

#### Acceptance Criteria

1. THE Settings_Page SHALL render a "Billing & Payment Settings" card section within the OrgSettingsForm.
2. THE Settings_Page SHALL render a textarea field labeled "Terms & Conditions" that maps to the `organizations.terms` column.
3. THE Settings_Page SHALL render a textarea field labeled "Payment Terms" with placeholder text (e.g. "50% advance, 50% after delivery") that maps to the `organizations.payment_terms` column.
4. THE Settings_Page SHALL render a textarea field labeled "Bank Details" that maps to the `organizations.bank_details` column.
5. THE Settings_Page SHALL render an input field labeled "UPI ID" that maps to the `organizations.upi_id` column.
6. WHEN the organization settings are loaded, THE Settings_Page SHALL pre-populate the Billing & Payment fields with the values stored in the organization record.
7. WHEN an admin submits the settings form, THE Settings_Page SHALL include `terms`, `payment_terms`, `bank_details`, and `upi_id` in the PATCH request payload.
8. WHEN the settings form is saved successfully, THE Settings_Page SHALL display a success toast notification.
9. WHEN a non-admin user views the Settings page, THE Settings_Page SHALL render the Billing & Payment fields in a read-only (disabled) state.
10. WHEN the settings form is saved, THE Settings_Page SHALL NOT remove or overwrite any existing branding, currency, timezone, or template settings.

---

### Requirement 6: Payment Information Section in DocumentRenderer

**User Story:** As a client receiving an invoice or quotation, I want to see the organization's bank details and UPI ID on the document, so that I know how to make payment.

#### Acceptance Criteria

1. WHEN `org.bank_details` is not null and not empty, THE DocumentRenderer SHALL render a "Payment Information" section below the totals block.
2. WHEN `org.upi_id` is not null and not empty, THE DocumentRenderer SHALL render the UPI ID within the Payment Information section in the format "UPI ID: [upi_id]".
3. WHEN `org.bank_details` contains newline characters, THE DocumentRenderer SHALL preserve and render those line breaks in the Payment Information section.
4. WHEN both `org.bank_details` and `org.upi_id` are null or empty, THE DocumentRenderer SHALL NOT render the Payment Information section.
5. WHEN only `org.upi_id` is not null and `org.bank_details` is null, THE DocumentRenderer SHALL still render the Payment Information section showing only the UPI ID line.

---

### Requirement 7: Payment Terms Section in DocumentRenderer

**User Story:** As a client receiving an invoice or quotation, I want to see the payment schedule or conditions on the document, so that I understand the payment expectations.

#### Acceptance Criteria

1. WHEN `org.payment_terms` is not null and not empty, THE DocumentRenderer SHALL render a "Payment Terms" section below the Payment Information section (or below totals if Payment Information is absent).
2. WHEN `org.payment_terms` is null or empty, THE DocumentRenderer SHALL NOT render the Payment Terms section.
3. THE DocumentRenderer SHALL render the content of `org.payment_terms` as plain text within the Payment Terms section.

---

### Requirement 8: Terms & Conditions Section in DocumentRenderer

**User Story:** As an organization admin, I want the terms and conditions to appear on every invoice and quotation, so that clients are legally informed.

#### Acceptance Criteria

1. WHEN `org.terms` is not null and not empty, THE DocumentRenderer SHALL render a "Terms & Conditions" section as the last section before the Aurix footer.
2. WHEN `org.terms` is null or empty, THE DocumentRenderer SHALL NOT render the Terms & Conditions section.
3. THE DocumentRenderer SHALL render the content of `org.terms` as plain text within the Terms & Conditions section.

---

### Requirement 9: Document Layout and Spacing Improvements

**User Story:** As a client receiving a document, I want the invoice or quotation to be well-spaced and readable, so that I can quickly understand the billing information.

#### Acceptance Criteria

1. THE DocumentRenderer SHALL render section headings (Bill To, items table header, totals, Payment Information, Payment Terms, Terms & Conditions) in bold with slightly larger text than body content.
2. THE DocumentRenderer SHALL apply consistent vertical spacing (margin) between the header block, Bill To block, items table, totals block, and each new section.
3. THE DocumentRenderer SHALL render a visual divider (horizontal rule or border) between the totals block and the new payment/terms sections.
4. THE DocumentRenderer SHALL align all monetary values and totals to the right side of the document.
5. WHEN the document is exported as a PDF, THE DocumentRenderer SHALL produce a layout that is not overcrowded and maintains the same section spacing as the UI preview.

---

### Requirement 10: Mandatory Aurix Branding Footer

**User Story:** As Aurix Development, I want every invoice and quotation to display a "Powered by Aurix Development" footer, so that the platform brand is always visible on client-facing documents.

#### Acceptance Criteria

1. THE DocumentRenderer SHALL render the text "Powered by Aurix Development" as a footer at the bottom of every document.
2. THE DocumentRenderer SHALL render the Aurix footer in both the UI preview and the PDF export.
3. THE DocumentRenderer SHALL render the Aurix footer regardless of the organization's settings, template selection, or branding configuration.
4. THE DocumentRenderer SHALL NOT provide any mechanism (prop, setting, or toggle) to hide or remove the Aurix footer.
5. THE Aurix_Footer SHALL be hardcoded directly inside the DocumentRenderer component and SHALL NOT be sourced from any API response, database field, or frontend configuration.

---

### Requirement 11: Organization Data Passed to DocumentRenderer

**User Story:** As a developer, I want the DocumentRenderer to receive the full organization object including new billing fields, so that payment sections render correctly.

#### Acceptance Criteria

1. THE Quotations_Page SHALL pass `org.terms`, `org.payment_terms`, `org.bank_details`, and `org.upi_id` to the DocumentRenderer `data.org` object when rendering a quotation preview.
2. THE Invoices_Page SHALL pass `org.terms`, `org.payment_terms`, `org.bank_details`, and `org.upi_id` to the DocumentRenderer `data.org` object when rendering an invoice preview.
3. THE DocumentData_Type SHALL include `terms`, `payment_terms`, `bank_details`, and `upi_id` as optional nullable string fields within the `org` object definition.
4. WHEN any of the new org fields are absent from the data passed to DocumentRenderer, THE DocumentRenderer SHALL treat them as null and SHALL NOT throw a runtime error.

---

### Requirement 12: Data Safety and Backward Compatibility

**User Story:** As an organization admin, I want all existing invoices and quotations to continue working after this update, so that no historical data is lost or broken.

#### Acceptance Criteria

1. THE DocumentRenderer SHALL NOT crash or throw a runtime error when any field in `data.org` or `data.client` is null, undefined, or missing.
2. THE DocumentRenderer SHALL NOT crash or throw a runtime error when `data.items` is an empty array.
3. THE DocumentRenderer SHALL NOT crash or throw a runtime error when `data.taxes` is null or an empty array.
4. WHEN an existing invoice or quotation record does not have the new org fields populated, THE DocumentRenderer SHALL render the document without the Payment Information, Payment Terms, and Terms & Conditions sections rather than showing empty sections.
5. THE Database_Migration SHALL be applied using `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` syntax to ensure idempotency and prevent errors on re-run.
