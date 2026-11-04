"use client";

import { useEffect, useState } from "react";
import { Landmark, Plane, Train } from "lucide-react";

type Place = { name: string; km: number };
type Distances = { railway?: Place; airport?: Place };

function kmBetween(lat1: number, lng1: number, lat2: number, lng2: number) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earth = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return earth * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
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
  const [distances, setDistances] = useState<Distances>({});
  const hasCoordinates = latitude != null && longitude != null;

  useEffect(() => {
    if (!hasCoordinates || latitude == null || longitude == null) return;
    const controller = new AbortController();
    const query = `[out:json][timeout:12];(node(around:70000,${latitude},${longitude})[railway=station];node(around:150000,${latitude},${longitude})[aeroway=aerodrome];);out body 30;`;
    fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      body: query,
      signal: controller.signal,
      headers: { "Content-Type": "text/plain" },
    })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("lookup failed"))))
      .then((payload: { elements?: { lat?: number; lon?: number; tags?: Record<string, string> }[] }) => {
        let railway: Place | undefined;
        let airport: Place | undefined;
        for (const element of payload.elements ?? []) {
          if (element.lat == null || element.lon == null) continue;
          const tags = element.tags ?? {};
          const name = tags.name;
          if (!name) continue;
          const km = kmBetween(latitude, longitude, element.lat, element.lon);
          if (tags.railway === "station" && (!railway || km < railway.km)) railway = { name, km };
          if (tags.aeroway === "aerodrome" && (!airport || km < airport.km)) airport = { name, km };
        }
        setDistances({ railway, airport });
      })
      .catch(() => setDistances({}));
    return () => controller.abort();
  }, [hasCoordinates, latitude, longitude]);

  const cards = [
    { label: "Railway station", query: "railway station", Icon: Train, place: distances.railway },
    { label: "Airport", query: "airport", Icon: Plane, place: distances.airport },
    { label: "Metro station", query: "metro station", Icon: Train, place: undefined },
    { label: "Major landmark", query: "landmark", Icon: Landmark, place: undefined },
  ];

  return (
    <div className="school-travel__grid">
      {cards.map(({ label, query, Icon, place }) => {
        const near = hasCoordinates ? `${latitude},${longitude}` : locationLabel;
        const href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${query} near ${near}`)}`;
        return (
          <a className="school-travel__card" href={href} target="_blank" rel="noreferrer" key={label}>
            <span className="school-travel__icon"><Icon size={20} aria-hidden /></span>
            <span className="school-travel__label">{label}</span>
            <strong>{place ? place.name : "Explore nearby"}</strong>
            <span className="school-travel__distance">
              {place
                ? `${place.km < 10 ? place.km.toFixed(1) : Math.round(place.km)} km from the school`
                : hasCoordinates
                  ? "Open nearby places in Maps"
                  : "Search by school location"}
            </span>
          </a>
        );
      })}
    </div>
  );
}
