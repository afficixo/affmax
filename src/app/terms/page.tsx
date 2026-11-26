import type { Metadata } from "next"
import LegalDocumentPage from "@/components/legal/LegalDocumentPage"

export const metadata: Metadata = {
  title: "Terms and Conditions | Crack Bounty",
  description: "Review the terms and conditions for Crack Bounty publishers and network participation.",
}

export default function TermsPage() {
  return <LegalDocumentPage sourceFile="terms-of-service.html" eyebrow="Publisher agreement" />
}
