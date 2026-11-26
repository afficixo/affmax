import type { Metadata } from "next"
import LegalDocumentPage from "@/components/legal/LegalDocumentPage"

export const metadata: Metadata = {
  title: "Privacy Policy | Crack Bounty",
  description: "Read the Crack Bounty privacy policy for information about personal data and privacy.",
}

export default function PrivacyPage() {
  return <LegalDocumentPage sourceFile="privacy-policy.html" eyebrow="Privacy & data protection" />
}
