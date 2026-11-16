CREATE TYPE "PublisherInvoiceStatus" AS ENUM ('PENDING', 'PAID');

CREATE TABLE "publisher_payment_invoices" (
  "id" TEXT NOT NULL,
  "invoiceNumber" TEXT NOT NULL,
  "publisherId" TEXT NOT NULL,
  "totalEarning" DOUBLE PRECISION NOT NULL,
  "conversionCount" INTEGER NOT NULL,
  "payoutMethod" TEXT,
  "payoutAccount" TEXT,
  "status" "PublisherInvoiceStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "paidAt" TIMESTAMP(3),
  "paidById" TEXT,
  CONSTRAINT "publisher_payment_invoices_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "publisher_payment_invoices_invoiceNumber_key"
  ON "publisher_payment_invoices"("invoiceNumber");
CREATE INDEX "publisher_payment_invoices_publisherId_createdAt_idx"
  ON "publisher_payment_invoices"("publisherId", "createdAt");
CREATE INDEX "publisher_payment_invoices_status_createdAt_idx"
  ON "publisher_payment_invoices"("status", "createdAt");

ALTER TABLE "publisher_payment_invoices"
  ADD CONSTRAINT "publisher_payment_invoices_publisherId_fkey"
  FOREIGN KEY ("publisherId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "publisher_payment_invoices"
  ADD CONSTRAINT "publisher_payment_invoices_paidById_fkey"
  FOREIGN KEY ("paidById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "conversion_leads" ADD COLUMN "publisherInvoiceId" TEXT;
CREATE INDEX "conversion_leads_publisherInvoiceId_idx"
  ON "conversion_leads"("publisherInvoiceId");
ALTER TABLE "conversion_leads"
  ADD CONSTRAINT "conversion_leads_publisherInvoiceId_fkey"
  FOREIGN KEY ("publisherInvoiceId") REFERENCES "publisher_payment_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
