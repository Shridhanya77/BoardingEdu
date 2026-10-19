import JsonLd from "@/components/JsonLd";
import SchoolDiscovery from "@/components/SchoolDiscovery";
import { faqJsonLd } from "@/lib/home-content";

export default function Home() {
  return (
    <>
      <JsonLd data={faqJsonLd} />
      <SchoolDiscovery />
    </>
  );
}
