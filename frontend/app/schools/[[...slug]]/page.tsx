import { notFound, redirect } from "next/navigation";
import { ApiError, schools } from "@/lib/api";
import { schoolProfilePath } from "@/components/SchoolProfile";

export default async function LegacySchoolPage({ params }: { params: { slug: string } }) {
  try {
    const school = await schools.bySlug(params.slug);
    redirect(schoolProfilePath(school));
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
}
