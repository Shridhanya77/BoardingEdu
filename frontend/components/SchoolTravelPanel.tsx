"use client";

import { useEffect, useState } from "react";
import { Landmark, Plane, Train } from "lucide-react";

type PlaceKind = "railway" | "airport" | "metro" | "landmark";
type Place = {
  name: string;
  latitude: number;
  longitude: number;
  distanceKm?: number;
  durationMinutes?: number;
  routeUnavailable?: boolean;
};
type TravelState = {
  status: "loading" | "ready" | "error" | "unavailable";
  places: Partial<Record<PlaceKind, Place>>;
};
type OverpassElement = {
  lat?: number;
  lon?: number;
  center?: { lat?: number; lon?: number };
  tags?: Record<string, string>;
};

const PLACE_CATEGORIES: {
  kind: PlaceKind;
  label: string;
  query: string;
  Icon: typeof Train;
}[] = [
  { kind: "railway", label: "Railway station", query: "railway station", Icon: Train },
  { kind: "airport", label: "Airport", query: "airport", Icon: Plane },
  { kind: "metro", label: "Metro station", query: "metro station", Icon: Train },
  { kind: "landmark", label: "Major landmark", query: "landmark", Icon: Landmark },
];

function kmBetween(lat1: number, lng1: number, lat2: number, lng2: number) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earth = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const boundedA = Math.min(1, Math.max(0, a));
  return earth * 2 * Math.atan2(Math.sqrt(boundedA), Math.sqrt(1 - boundedA));
}

function placeKind(tags: Record<string, string>): PlaceKind | null {
  if (tags.aeroway === "aerodrome" || tags.aeroway === "airport") return "airport";
  if (tags.station === "subway" || tags.railway === "subway_station") return "metro";
  if (tags.railway === "station") return "railway";
  if (tags.tourism === "attraction" || tags.historic) return "landmark";
  return null;
}

function formatDriveTime(minutes: number) {
  const roundedMinutes = Math.max(1, Math.round(minutes));
  if (roundedMinutes < 60) return `about ${roundedMinutes} min by road`;
  const hours = Math.floor(roundedMinutes / 60);
  const remainder = roundedMinutes % 60;
  return remainder
    ? `about ${hours} hr ${remainder} min by road`
    : `about ${hours} hr by road`;
}

export default function SchoolTravelPanel({
  latitude,
  longitude,
  locationLabel,
}: {
  latitude: number | null;
  longitude: number | null;
  locationLabel: string;
}) {
  const hasCoordinates =
    latitude != null &&
    longitude != null &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    Math.abs(latitude) <= 90 &&
    Math.abs(longitude) <= 180;
  const [travel, setTravel] = useState<TravelState>({
    status: hasCoordinates ? "loading" : "unavailable",
    places: {},
  });

  useEffect(() => {
    if (!hasCoordinates || latitude == null || longitude == null) {
      setTravel({ status: "unavailable", places: {} });
      return;
    }
    const originLatitude = latitude;
    const originLongitude = longitude;

    const controller = new AbortController();
    setTravel({ status: "loading", places: {} });

    async function loadNearbyPlaces() {
      const query = `[out:json][timeout:12];(
        node(around:80000,${originLatitude},${originLongitude})[railway=station][name];
        way(around:80000,${originLatitude},${originLongitude})[railway=station][name];
        node(around:150000,${originLatitude},${originLongitude})[aeroway~"^(aerodrome|airport)$"][name];
        way(around:150000,${originLatitude},${originLongitude})[aeroway~"^(aerodrome|airport)$"][name];
        node(around:50000,${originLatitude},${originLongitude})[station=subway][name];
        way(around:50000,${originLatitude},${originLongitude})[station=subway][name];
        node(around:15000,${originLatitude},${originLongitude})[tourism=attraction][name];
        way(around:15000,${originLatitude},${originLongitude})[tourism=attraction][name];
        node(around:15000,${originLatitude},${originLongitude})[historic][name];
        way(around:15000,${originLatitude},${originLongitude})[historic][name];
      );out center 80;`;
      const nearbyResponse = await fetch("https://overpass-api.de/api/interpreter", {
        method: "POST",
        body: query,
        signal: controller.signal,
        headers: { "Content-Type": "text/plain" },
      });
      if (!nearbyResponse.ok) throw new Error("Nearby places are unavailable.");

      const payload = await nearbyResponse.json() as { elements?: OverpassElement[] };
      const nearest: Partial<Record<PlaceKind, Place & { directKm: number }>> = {};
      for (const element of payload.elements ?? []) {
        const lat = element.center?.lat ?? element.lat;
        const lon = element.center?.lon ?? element.lon;
        const tags = element.tags ?? {};
        const kind = placeKind(tags);
        const name = tags.name || tags["name:en"];
        if (lat == null || lon == null || !kind || !name) continue;

        const directKm = kmBetween(originLatitude, originLongitude, lat, lon);
        const existing = nearest[kind];
        if (!existing || directKm < existing.directKm) {
          nearest[kind] = { name, latitude: lat, longitude: lon, directKm };
        }
      }

      const destinations = PLACE_CATEGORIES.flatMap(({ kind }) => {
        const place = nearest[kind];
        return place ? [{ kind, place }] : [];
      });
      const places: Partial<Record<PlaceKind, Place>> = {};

      if (destinations.length) {
        try {
          const coordinates = [
            `${originLongitude},${originLatitude}`,
            ...destinations.map(({ place }) => `${place.longitude},${place.latitude}`),
          ].join(";");
          const routeResponse = await fetch(
            `https://router.project-osrm.org/table/v1/driving/${coordinates}?sources=0&annotations=distance,duration`,
            { signal: controller.signal },
          );
          if (!routeResponse.ok) throw new Error("Route estimates are unavailable.");
          const routeData = await routeResponse.json() as {
            code?: string;
            distances?: (number | null)[][];
            durations?: (number | null)[][];
          };
          if (routeData.code !== "Ok") throw new Error("Route estimates are unavailable.");

          destinations.forEach(({ kind, place }, index) => {
            const distance = routeData.distances?.[0]?.[index + 1];
            const duration = routeData.durations?.[0]?.[index + 1];
            places[kind] = typeof distance === "number" &&
              Number.isFinite(distance) &&
              typeof duration === "number" &&
              Number.isFinite(duration)
              ? { ...place, distanceKm: distance / 1000, durationMinutes: duration / 60 }
              : { ...place, routeUnavailable: true };
          });
        } catch {
          if (controller.signal.aborted) return;
          for (const category of PLACE_CATEGORIES) {
            const place = nearest[category.kind];
            if (place) places[category.kind] = { ...place, routeUnavailable: true };
          }
          setTravel({ status: "ready", places });
          return;
        }
      }

      if (!controller.signal.aborted) setTravel({ status: "ready", places });
    }

    loadNearbyPlaces().catch(() => {
      if (controller.signal.aborted) return;
      setTravel({ status: "error", places: {} });
    });

    return () => controller.abort();
  }, [hasCoordinates, latitude, longitude]);

  return (
    <div className="school-travel__grid">
      {PLACE_CATEGORIES.map(({ kind, label, query, Icon }) => {
        const place = travel.places[kind];
        const near = hasCoordinates ? `${latitude},${longitude}` : locationLabel;
        const href = place && hasCoordinates
          ? `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(near)}&destination=${encodeURIComponent(`${place.latitude},${place.longitude}`)}&travelmode=driving`
          : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${query} near ${near}`)}`;

        let detail = "Find this place from the school location";
        if (travel.status === "loading") detail = "Finding the nearest location…";
        if (travel.status === "error") detail = "Nearby travel details are unavailable";
        if (travel.status === "unavailable") detail = "Add school coordinates for route estimates";
        if (travel.status === "ready" && !place) detail = "No nearby listing found";
        if (place?.routeUnavailable) detail = "Route distance and time are unavailable";
        if (place?.distanceKm != null && place.durationMinutes != null) {
          detail = `${place.distanceKm.toFixed(1)} km from the school · ${formatDriveTime(place.durationMinutes)}`;
        }

        return (
          <a className="school-travel__card" href={href} target="_blank" rel="noreferrer" key={kind}>
            <span className="school-travel__icon"><Icon size={20} aria-hidden /></span>
            <span className="school-travel__label">{label}</span>
            <strong>
              {travel.status === "loading"
                ? "Searching nearby"
                : travel.status === "error"
                  ? "Nearby details unavailable"
                  : place?.name ?? (travel.status === "unavailable" ? "Location not available" : "No nearby listing")}
            </strong>
            <span className="school-travel__distance">{detail}</span>
          </a>
        );
      })}
    </div>
  );
}
