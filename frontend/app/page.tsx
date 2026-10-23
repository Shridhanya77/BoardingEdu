import JsonLd from "@/components/JsonLd";
import SchoolDiscovery from "@/components/SchoolDiscovery";
import { faqJsonLd } from "@/lib/home-content";
import { schoolSearchPath } from "@/lib/school-urls";
import { redirect } from "next/navigation";

type HomeProps = {
  searchParams?: { search?: string | string[] };
};

export default function Home({ searchParams }: HomeProps) {
  const searchQuery = Array.isArray(searchParams?.search)
    ? searchParams.search[0]
    : searchParams?.search;
  if (searchQuery?.trim()) redirect(schoolSearchPath(searchQuery));

  return (
    <>
      <JsonLd data={faqJsonLd} />
      <SchoolDiscovery />
    </>
  );
}
