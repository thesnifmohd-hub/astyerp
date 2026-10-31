import React, { useEffect, useRef } from 'react';
import L from 'leaflet';

interface SiteGeofencePickerProps {
  lat: number;
  lng: number;
  radiusM: number;
  interactive?: boolean;
  onChange?: (lat: number, lng: number) => void;
}

/**
 * Interactive Leaflet + OpenStreetMap Geofence Picker (SPEC Section 4.1)
 */
export function SiteGeofencePicker({
  lat,
  lng,
  radiusM,
  interactive = true,
  onChange,
}: SiteGeofencePickerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const circleRef = useRef<L.Circle | null>(null);
  const markerRef = useRef<L.CircleMarker | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [lat, lng],
      zoom: 16,
      scrollWheelZoom: false,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    const marker = L.circleMarker([lat, lng], {
      radius: 8,
      color: '#1D2527',
      fillColor: '#1D2527',
      fillOpacity: 1,
    }).addTo(map);

    const circle = L.circle([lat, lng], {
      radius: radiusM,
      color: '#1D2527',
      fillColor: '#8DA1B1',
      fillOpacity: 0.28,
      weight: 2,
    }).addTo(map);

    if (interactive && onChange) {
      map.on('click', (e: L.LeafletMouseEvent) => {
        const nextLat = Number(e.latlng.lat.toFixed(6));
        const nextLng = Number(e.latlng.lng.toFixed(6));
        onChange(nextLat, nextLng);
      });
    }

    mapRef.current = map;
    circleRef.current = circle;
    markerRef.current = marker;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current || !circleRef.current || !markerRef.current) return;
    markerRef.current.setLatLng([lat, lng]);
    circleRef.current.setLatLng([lat, lng]);
    circleRef.current.setRadius(radiusM);
    mapRef.current.setView([lat, lng]);
  }, [lat, lng, radiusM]);

  return (
    <div className="space-y-1.5">
      <div
        ref={containerRef}
        className="h-64 w-full rounded-xl border border-asty-border z-0 overflow-hidden"
      />
      <p className="text-xs text-slate-500">
        {interactive
          ? `Click anywhere on the OpenStreetMap canvas to set GPS pin • Allowed check-in radius: ${radiusM} m`
          : `GPS Pin: ${lat.toFixed(5)}, ${lng.toFixed(5)} • Geofence Radius: ${radiusM} m`}
      </p>
    </div>
  );
}

