"use client";

import { useEffect, useRef, useState } from "react";
import type * as LeafletNS from "leaflet";
import type { SchoolListItem } from "@/lib/api";
import { schoolProfilePathFromSlugs } from "@/lib/seo-slugs";
import { publicSchoolImageUrl } from "@/lib/school-media";

import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";

const DEFAULT_CENTER: [number, number] = [21.146, 79.088];
const DEFAULT_ZOOM = 5;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function hasCoordinates(school: SchoolListItem): boolean {
  return (
    typeof school.lat === "number" &&
    typeof school.lng === "number" &&
    Number.isFinite(school.lat) &&
    Number.isFinite(school.lng)
  );
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
        <a href="${escapeHtml(schoolPath(school))}">View school</a>
      </div>
    </article>`;
}

export default function SchoolMap({ schools }: { schools: SchoolListItem[] }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const leafletRef = useRef<typeof LeafletNS | null>(null);
  const mapRef = useRef<LeafletNS.Map | null>(null);
  const clusterRef = useRef<LeafletNS.MarkerClusterGroup | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  const located = schools.filter(hasCoordinates);

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
    const icon = L.divIcon({
      className: "school-map-marker",
      html: '<span class="school-map-marker__dot"></span>',
      iconSize: [18, 18],
      iconAnchor: [9, 9],
      popupAnchor: [0, -10],
    });

    located.forEach((school) => {
      const latlng: [number, number] = [school.lat as number, school.lng as number];
      bounds.extend(latlng);
      const marker = L.marker(latlng, { icon, title: school.school_name, keyboard: true });
      marker.bindPopup(popupHtml(school), { minWidth: 200, maxWidth: 260, closeButton: true });
      cluster.addLayer(marker);
    });

    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
  }, [schools, ready]); // eslint-disable-line react-hooks/exhaustive-deps

  if (failed) {
    return (
      <div className="school-map" role="status">
        <p className="school-map__note">The map could not be loaded. Please use the grid or list view instead.</p>
      </div>
    );
  }

  const missing = schools.length - located.length;

  return (
    <div className="school-map">
      <div ref={containerRef} className="school-map__canvas" aria-label="Map of matching schools" />
      <p className="school-map__note" role="status">
        {located.length === 0
          ? "None of the schools in these results have a map location yet."
          : `Showing ${located.length} ${located.length === 1 ? "school" : "schools"} on the map.`}
        {located.length > 0 && missing > 0
          ? ` ${missing} ${missing === 1 ? "school has" : "schools have"} no location and are not shown.`
          : ""}
      </p>
    </div>
  );
}
