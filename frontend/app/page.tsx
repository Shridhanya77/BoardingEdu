import JsonLd from "@/components/JsonLd";
import SchoolDiscovery from "@/components/SchoolDiscovery";
import { faqJsonLd as savedFaqJsonLd } from "@/lib/home-content";
import { faqJsonLd as buildFaqJsonLd } from "@/lib/structured-data";
import { schools } from "@/lib/api";
import { schoolSearchPath } from "@/lib/school-urls";
import { redirect } from "next/navigation";

type HomeProps = {
  searchParams?: { search?: string | string[] };
};

export default async function Home({ searchParams }: HomeProps) {
  const searchQuery = Array.isArray(searchParams?.search)
    ? searchParams.search[0]
    : searchParams?.search;
  if (searchQuery?.trim()) redirect(schoolSearchPath(searchQuery));

  let structuredFaqs: ReturnType<typeof buildFaqJsonLd> | null = savedFaqJsonLd;
  try {
    const publishedFaqs = await schools.faqs();
    structuredFaqs = publishedFaqs.length ? buildFaqJsonLd(publishedFaqs) : null;
  } catch (reason) {
    console.error("Could not load FAQ structured data from the public API.", reason);
  }

  return (
    <>
      {structuredFaqs && <JsonLd data={structuredFaqs} />}
      <SchoolDiscovery />
    </>
  );
}
