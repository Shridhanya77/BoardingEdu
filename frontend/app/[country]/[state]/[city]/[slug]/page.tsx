import { notFound, redirect } from "next/navigation";
import { ApiError, schools } from "@/lib/api";
import type { SchoolDetail } from "@/lib/api";
import SchoolProfile, { schoolProfilePath } from "@/components/SchoolProfile";

type SchoolRouteParams = {
  country: string;
  state: string;
  city: string;
  slug: string;
};

export default async function SchoolLocationPage({ params }: { params: SchoolRouteParams }) {
  let school: SchoolDetail;
  try {
    school = await schools.bySlug(params.slug);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }

  const canonicalPath = schoolProfilePath(school);
  const requestedPath = `/${params.country}/${params.state}/${params.city}/${params.slug}`;
  if (requestedPath !== canonicalPath) redirect(canonicalPath);

  return <SchoolProfile school={school} />;
}
