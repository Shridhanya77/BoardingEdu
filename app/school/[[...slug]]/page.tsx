// app/school/[slug]/[[...tab]]/page.tsx
import { notFound } from 'next/navigation';
import { getSchoolBySlug } from '@/lib/api/schools';
import { SchoolTabMeta, isTabSlug, normalizeTab } from '@/lib/school-tabs';
import { SchoolProfile } from '@/components/school/SchoolProfile';
import { SchoolSchema } from '@/components/school/SchoolSchema';

interface PageProps {
  params: { slug: string; tab?: string[] };
}

export async function generateMetadata({ params }: PageProps) {
  const school = await getSchoolBySlug(params.slug);
  if (!school) return { title: 'School not found' };

  const tabKey = normalizeTab(params.tab?.[0]);
  const meta = SchoolTabMeta[tabKey];

  return {
    title: meta.title(school),
    description: meta.description(school),
    alternates: {
      canonical: `https://boardingedu.com/school/${params.slug}${
        meta.path ? '/' + meta.path : ''
      }`,
    },
    openGraph: {
      title: meta.title(school),
      description: meta.description(school),
      images: [`/school/${params.slug}/opengraph-image?tab=${tabKey}`],
    },
  };
}

export default async function SchoolPage({ params }: PageProps) {
  const school = await getSchoolBySlug(params.slug);
  if (!school) notFound();

  const rawTab = params.tab?.[0];
  const tabKey = isTabSlug(rawTab) ? rawTab : 'overview';

  return (
    <>
      <SchoolSchema school={school} />
      <SchoolProfile school={school} initialTab={tabKey} />
    </>
  );
}

export const revalidate = 3600;