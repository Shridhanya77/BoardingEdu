"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, GraduationCap, X } from "lucide-react";
import {
  apiErrorMessage,
  dashboards,
  schools,
  type ParentRecentSchool,
  type SchoolDetail,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { readRecentSchoolIds, saveRecentSchoolIds } from "@/lib/recent-schools";
import { schoolProfilePathFromSlugs } from "@/lib/seo-slugs";

type RecentSchoolCard = {
  id: string;
  schoolId: string;
  schoolName: string;
  slug: string;
  cityName: string;
  stateName: string;
  countrySlug: string;
  stateSlug: string;
  citySlug: string;
  locationSlug: string | null;
  schoolTypes: SchoolDetail["school_types_detail"];
  imageUrl?: string;
  recentViewId?: string;
};

function localSchoolCard(school: SchoolDetail): RecentSchoolCard {
  return {
    id: school.school_id,
    schoolId: school.school_id,
    schoolName: school.school_name,
    slug: school.slug,
    cityName: school.city_detail.city_name,
    stateName: school.state_detail.state_name,
    countrySlug: school.country_detail.slug,
    stateSlug: school.state_detail.slug,
    citySlug: school.city_detail.slug,
    locationSlug: school.location_detail?.slug ?? null,
    schoolTypes: school.school_types_detail,
    imageUrl: school.school_image_url || undefined,
  };
}

function parentSchoolCard(school: ParentRecentSchool): RecentSchoolCard {
  return {
    id: school.recent_view_id,
    schoolId: school.school_id,
    schoolName: school.school_name,
    slug: school.slug,
    cityName: school.city_name,
    stateName: school.state_name,
    countrySlug: school.country_slug,
    stateSlug: school.state_slug,
    citySlug: school.city_slug,
    locationSlug: school.location_slug,
    schoolTypes: school.school_types_detail,
    recentViewId: school.recent_view_id,
  };
}

export default function RecentlyViewedSchools() {
  const { status, user } = useAuth();
  const isParent = status === "authenticated" && user?.role === "PARENT";
  const [items, setItems] = useState<RecentSchoolCard[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (status === "idle" || status === "loading") return;
    let active = true;
    setLoaded(false);
    if (isParent) {
      dashboards.recentlyViewedSchools()
        .then((rows) => {
          if (active) setItems(rows.map(parentSchoolCard).slice(0, 6));
        })
        .catch((reason: unknown) => {
          if (active) setError(apiErrorMessage(reason));
        })
        .finally(() => {
          if (active) setLoaded(true);
        });
      return () => {
        active = false;
      };
    }

    try {
      const ids = readRecentSchoolIds();
      if (!ids.length) {
        setItems([]);
        setLoaded(true);
        return;
      }
      Promise.allSettled(ids.map((id) => schools.retrieve(id))).then((results) => {
        if (!active) return;
        const loadedSchools = results.flatMap((result) =>
          result.status === "fulfilled" ? [result.value] : [],
        );
        setItems(loadedSchools.slice(0, 6).map(localSchoolCard));
        const loadedIds = new Set(loadedSchools.map((school) => school.school_id));
        saveRecentSchoolIds(ids.filter((id) => loadedIds.has(id)));
        const failed = results.find((result) => result.status === "rejected");
        if (failed?.status === "rejected") setError(apiErrorMessage(failed.reason));
      }).catch((reason: unknown) => {
        if (active) setError(apiErrorMessage(reason));
      }).finally(() => {
        if (active) setLoaded(true);
      });
    } catch (reason) {
      setError(apiErrorMessage(reason));
      setLoaded(true);
    }
    return () => {
      active = false;
    };
  }, [isParent, status]);

  async function removeSchool(school: RecentSchoolCard) {
    setBusy(true);
    setError(null);
    try {
      if (isParent && school.recentViewId) {
        await dashboards.removeRecentlyViewedSchool(school.recentViewId);
      } else {
        saveRecentSchoolIds(items.filter((item) => item.schoolId !== school.schoolId).map((item) => item.schoolId));
      }
      setItems((current) => current.filter((item) => item.id !== school.id));
    } catch (reason) {
      setError(apiErrorMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  async function clearHistory() {
    setBusy(true);
    setError(null);
    try {
      if (isParent) await dashboards.clearRecentlyViewedSchools();
      else saveRecentSchoolIds([]);
      setItems([]);
    } catch (reason) {
      setError(apiErrorMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  if (!loaded && !error) return null;

  return (
    <section className="recent-schools" aria-labelledby="recent-schools-title">
      <div className="recent-schools__heading">
        <div>
          <span className="section-eyebrow">PICK UP WHERE YOU LEFT OFF</span>
          <h2 id="recent-schools-title">Recently viewed schools</h2>
        </div>
        <div className="recent-schools__actions">
          {isParent && (
            <Link href="/dashboard/parent/">View all in dashboard</Link>
          )}
          {items.length > 0 && (
            <button type="button" className="recent-schools__clear" disabled={busy} onClick={() => void clearHistory()}>
              Clear history
            </button>
          )}
        </div>
      </div>
      {error && <p className="recent-schools__error" role="alert">{error}</p>}
      {items.length > 0 ? (
        <div className="recent-schools__grid">
          {items.map((school) => {
            const href = schoolProfilePathFromSlugs({
              countrySlug: school.countrySlug,
              stateSlug: school.stateSlug,
              citySlug: school.citySlug,
              localitySlug: school.locationSlug,
              schoolSlug: school.slug,
              schoolName: school.schoolName,
              schoolTypes: school.schoolTypes,
            });
            return (
              <article className="recent-school-card" key={school.id}>
                <Link className="recent-school-card__link" href={href}>
                  <span className="recent-school-card__media">
                    {school.imageUrl ? (
                      <Image src={school.imageUrl} alt="" fill sizes="(max-width: 700px) 80vw, 260px" unoptimized />
                    ) : (
                      <GraduationCap size={24} aria-hidden />
                    )}
                  </span>
                  <span className="recent-school-card__copy">
                    <strong>{school.schoolName}</strong>
                    <small>{[school.cityName, school.stateName].filter(Boolean).join(", ")}</small>
                    <span>View school <ArrowRight size={14} aria-hidden /></span>
                  </span>
                </Link>
                <button
                  type="button"
                  className="recent-school-card__remove"
                  disabled={busy}
                  onClick={() => void removeSchool(school)}
                  aria-label={`Remove ${school.schoolName} from recently viewed schools`}
                >
                  <X size={15} aria-hidden />
                </button>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="recent-schools__empty">
          <GraduationCap size={22} aria-hidden />
          <p>Schools you explore will appear here so you can easily come back to them.</p>
          <Link href="/schools">Explore schools <ArrowRight size={14} aria-hidden /></Link>
        </div>
      )}
    </section>
  );
}
