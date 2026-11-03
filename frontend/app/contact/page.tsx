import type { Metadata } from "next";
import Link from "next/link";
import LegalPage from "@/components/legal/LegalPage";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Contact Us | BoardingEdu",
  description: "Contact BoardingEdu for school search help and admission counselling.",
  path: "/contact",
});

export default function ContactPage() {
  return (
    <LegalPage title="Contact Us" updated="3 November 2026">
      <p>
        Email <a href="mailto:hello@boardingedu.com">hello@boardingedu.com</a> or call
        {" "}<a href="tel:+918046110000">+91 80-4611-0000</a>.
      </p>
      <p>
        Parents can also <Link href="/counselling/">request counselling</Link>. The same form is available
        from Get Counselling in the site header.
      </p>
    </LegalPage>
  );
}
