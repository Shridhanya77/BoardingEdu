// app/schools/[[...slug]]/page.tsx
import { notFound } from 'next/navigation';
import { parseSlug, validateGeography } from '@/lib/pseo/parse-slug';
import { generatePseoMetadata } from '@/lib/pseo/metadata';
import { buildMeiliFilter } from '@/lib/pseo/meili-filter';
import { ListingPage } from '@/components/listing/ListingPage';
import { fetchSchoolListing } from '@/lib/api/schools';

interface PageProps {
  params: { slug?: string[] };
  searchParams: Record<string, string | string[] | undefined>;
}

export async function generateMetadata({ params }: PageProps) {
  const parsed = parseSlug(params.slug ?? []);
  if (!parsed) return { title: 'Not found' };
  return generatePseoMetadata(parsed);
}

export default async function SchoolsCatchAll({ params, searchParams }: PageProps) {
  const parsed = parseSlug(params.slug ?? []);
  if (!parsed) notFound();
  if (!(await validateGeography(parsed))) notFound();

  const filter = buildMeiliFilter(parsed);
  const data = await fetchSchoolListing({ filter, searchParams });

  return (
    <ListingPage
      parsedSlug={parsed}
      breadcrumbs={buildBreadcrumbs(parsed)}
      schools={data.hits}
      facetDistribution={data.facetDistribution}
      total={data.estimatedTotalHits}
    />
  );
}

export async function generateStaticParams() {
  const hotCombos = await getHotPseoCombinations();
  return hotCombos.map(c => ({ slug: c.segments }));
}

export const revalidate = 3600;