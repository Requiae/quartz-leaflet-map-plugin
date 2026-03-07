export interface LeafletMapViewConfig {
  mapName?: string;
  image: string;
  height?: number;
  minZoom?: number;
  maxZoom?: number;
  defaultZoom?: number;
  zoomDelta?: number;
  scale?: number;
  unit?: string;
}

export interface MarkerData {
  mapName?: string;
  coordinates: string;
  icon?: string;
  colour?: string;
  minZoom?: number;
}

export const DEFAULTS = {
  minZoom: 0,
  maxZoom: 2,
  zoomDelta: 0.5,
  zoomSnap: 0.01,
  height: 600,
  scale: 1,
  unit: "",
  markerColour: "#21409a",
  markerIcon: "circle-small",
} as const;

export const CDN = {
  leaflet: "1.9.4/dist/leaflet.js",
  lucide: "0.575.0",
} as const;
