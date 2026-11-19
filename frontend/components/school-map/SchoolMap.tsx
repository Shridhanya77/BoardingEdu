"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type * as LeafletNS from "leaflet";
import { schools as schoolApi, type SchoolListItem } from "@/lib/api";
import { schoolProfilePathFromSlugs, schoolTypeCategory } from "@/lib/seo-slugs";
import { publicSchoolImageUrl } from "@/lib/school-media";

import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";

const DEFAULT_CENTER: [number, number] = [21.146, 79.088];
const DEFAULT_ZOOM = 5;
type SchoolMapKind = "day" | "boarding" | "day-boarding" | "other";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function schoolMapKind(school: SchoolListItem): SchoolMapKind {
  const categories = school.school_types_detail.map((type) =>
    schoolTypeCategory(type.type_code, type.slug, type.type_name),
  );
  const hasDay = categories.some((category) =>
    category === "day-school" || category === "day-boarding-school",
  );
  const hasBoarding = school.boarding_required || categories.some((category) =>
    category === "boarding-school" || category === "day-boarding-school",
  );

  if (hasDay && hasBoarding) return "day-boarding";
  if (hasBoarding) return "boarding";
  if (hasDay) return "day";
  return "other";
}

function schoolCoordinates(school: SchoolListItem): [number, number] | null {
  if (school.lat == null || school.lng == null) return null;
  const lat = Number(school.lat);
  const lng = Number(school.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return null;
  }
  return [lat, lng];
}

function schoolPath(school: SchoolListItem): string {
  return schoolProfilePathFromSlugs({
    countrySlug: school.country_slug,
    stateSlug: school.state_slug,
    citySlug: school.city_slug,
    localitySlug: school.location_slug,
    schoolSlug: school.slug,
    schoolName: school.school_name,
    schoolTypes: school.school_types_detail,
  });
}

function popupHtml(school: SchoolListItem): string {
  const image = publicSchoolImageUrl(school.school_image_url);
  const place = [school.location_name, school.city_name, school.state_name].filter(Boolean).join(", ");
  const boards = school.boards_detail.map((board) => board.board_name).join(", ");
  return `
    <article class="school-map-popup">
      ${image ? `<img class="school-map-popup__image" src="${escapeHtml(image)}" alt="" loading="lazy" />` : ""}
      <div class="school-map-popup__body">
        <strong>${escapeHtml(school.school_name)}</strong>
        ${place ? `<span class="school-map-popup__place">${escapeHtml(place)}</span>` : ""}
        ${boards ? `<span class="school-map-popup__meta">${escapeHtml(boards)}</span>` : ""}
        <a class="school-map-popup__link" href="${escapeHtml(schoolPath(school))}">View school</a>
      </div>
    </article>`;
}

function trackSchoolListingClick(schoolId: string) {
  schoolApi.trackEngagement(schoolId, "LISTING_CLICK").catch((reason: unknown) => {
    console.error("Could not record this school listing click.", reason);
  });
}

export default function SchoolMap({ schools }: { schools: SchoolListItem[] }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const leafletRef = useRef<typeof LeafletNS | null>(null);
  const mapRef = useRef<LeafletNS.Map | null>(null);
  const clusterRef = useRef<LeafletNS.MarkerClusterGroup | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  const located = schools.flatMap((school) => {
    const coordinates = schoolCoordinates(school);
    return coordinates ? [{ school, coordinates }] : [];
  });
  const groups: { key: SchoolMapKind; label: string; schools: SchoolListItem[] }[] = [
    { key: "day" as const, label: "Day schools", schools: schools.filter((school) => schoolMapKind(school) === "day") },
    { key: "boarding" as const, label: "Boarding schools", schools: schools.filter((school) => schoolMapKind(school) === "boarding") },
    { key: "day-boarding" as const, label: "Day & boarding schools", schools: schools.filter((school) => schoolMapKind(school) === "day-boarding") },
    { key: "other" as const, label: "Other schools", schools: schools.filter((school) => schoolMapKind(school) === "other") },
  ].filter((group) => group.schools.length > 0);

  useEffect(() => {
    let cancelled = false;

    async function setup() {
      if (!containerRef.current || mapRef.current) return;
      try {
        const leaflet = await import("leaflet");
        await import("leaflet.markercluster");
        if (cancelled || !containerRef.current) return;

        const map = leaflet.map(containerRef.current, {
          center: DEFAULT_CENTER,
          zoom: DEFAULT_ZOOM,
          scrollWheelZoom: false,
        });
        leaflet
          .tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            maxZoom: 19,
            minZoom: 3,
            attribution: "&copy; OpenStreetMap contributors",
          })
          .addTo(map);

        const cluster = leaflet.markerClusterGroup({
          showCoverageOnHover: false,
          maxClusterRadius: 55,
          spiderfyOnMaxZoom: true,
          chunkedLoading: true,
        });
        map.addLayer(cluster);

        leafletRef.current = leaflet;
        mapRef.current = map;
        clusterRef.current = cluster;
        setReady(true);
      } catch {
        if (!cancelled) setFailed(true);
      }
    }

    void setup();
    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      leafletRef.current = null;
      clusterRef.current = null;
    };
  }, []);

  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    const cluster = clusterRef.current;
    if (!L || !map || !cluster) return;

    cluster.clearLayers();
    if (located.length === 0) return;

    const bounds = L.latLngBounds([]);
    located.forEach(({ school, coordinates }) => {
      const kind = schoolMapKind(school);
      const icon = L.divIcon({
        className: `school-map-marker school-map-marker--${kind}`,
        html: '<span class="school-map-marker__pin"><span></span></span>',
        iconSize: [26, 34],
        iconAnchor: [13, 32],
        popupAnchor: [0, -30],
      });
      const latlng = coordinates;
      bounds.extend(latlng);
      const marker = L.marker(latlng, { icon, title: school.school_name, keyboard: true });
      marker.bindPopup(popupHtml(school), { minWidth: 200, maxWidth: 260, closeButton: true });
      marker.on("popupopen", () => {
        const link = marker.getPopup()?.getElement()?.querySelector<HTMLAnchorElement>(
          ".school-map-popup__link",
        );
        if (!link || link.dataset.engagementTracked) return;
        link.dataset.engagementTracked = "true";
        link.addEventListener("click", () => trackSchoolListingClick(school.school_id));
      });
      cluster.addLayer(marker);
    });

    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
  }, [schools, ready]); // eslint-disable-line react-hooks/exhaustive-deps

  const missing = schools.length - located.length;

  return (
    <div className="school-map">
      <div className="school-map__layout">
        {failed ? (
          <div className="school-map__unavailable" role="status">
            The map could not be loaded. You can still browse the matching schools by type.
          </div>
        ) : (
          <div ref={containerRef} className="school-map__canvas" aria-label="Map of matching schools" />
        )}
        <aside className="school-map__directory" aria-label="Matching schools by type">
          <h2>Schools on this map</h2>
          <div className="school-map__legend" aria-label="Map marker legend">
            {groups.map((group) => (
              <span key={group.key}>
                <i className={`school-map__legend-marker school-map__legend-marker--${group.key}`} aria-hidden />
                {group.label}
              </span>
            ))}
          </div>
          {groups.length > 0 ? groups.map((group) => (
            <section className="school-map__group" key={group.key}>
              <h3>
                <i className={`school-map__legend-marker school-map__legend-marker--${group.key}`} aria-hidden />
                {group.label} <span>({group.schools.length})</span>
              </h3>
              <ul>
                {group.schools.map((school) => (
                  <li key={school.school_id}>
                    <Link
                      href={schoolPath(school)}
                      onClick={() => {
                        trackSchoolListingClick(school.school_id);
                      }}
                    >
                      <strong>{school.school_name}</strong>
                      <span>
                        {[school.location_name, school.city_name, school.state_name]
                          .filter(Boolean)
                          .join(", ") || "Location not listed"}
                      </span>
                      {schoolCoordinates(school) == null && (
                        <small>Map location not provided</small>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )) : (
            <p className="school-map__empty">No matching schools are available.</p>
          )}
        </aside>
      </div>
      <p className="school-map__note" role="status">
        {located.length === 0
          ? "None of these schools have coordinates yet, so map markers cannot be shown."
          : `Showing ${located.length} of ${schools.length} matching ${schools.length === 1 ? "school" : "schools"} on the map.`}
        {located.length > 0 && missing > 0
          ? ` ${missing} ${missing === 1 ? "school is" : "schools are"} still listed but need a map location.`
          : ""}
      </p>
    </div>
  );
}
