import type {
  ViewRenderer,
  ViewRendererProps,
  ViewTypeRegistration,
} from "@quartz-community/bases-page";
import leafletMapCss from "./styles/leaflet-map.scss";
import leafletMapScript from "./scripts/leaflet-map.inline";
import { DEFAULTS } from "./types";
import type { MarkerData } from "./types";

type MarkerWithEntry = MarkerData & {
  name: string;
  link: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const toNumber = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

const getString = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim().length > 0 ? value : undefined;

const leafletMapRenderer: ViewRenderer = ({ entries, view }: ViewRendererProps) => {
  const mapName = getString(view.mapName);
  const imageSource = getString(view.image);

  if (!imageSource) {
    return <div>Leaflet map view requires an image.</div>;
  }

  const minZoom = toNumber(view.minZoom) ?? DEFAULTS.minZoom;
  const maxZoom = Math.max(toNumber(view.maxZoom) ?? DEFAULTS.maxZoom, minZoom);
  const defaultZoom = Math.min(Math.max(toNumber(view.defaultZoom) ?? minZoom, minZoom), maxZoom);
  const zoomDelta = toNumber(view.zoomDelta) ?? DEFAULTS.zoomDelta;
  const height = toNumber(view.height) ?? DEFAULTS.height;
  const scale = toNumber(view.scale) ?? DEFAULTS.scale;
  const unit = getString(view.unit) ?? DEFAULTS.unit;

  const markers: MarkerWithEntry[] = [];
  for (const entry of entries) {
    const markerValue = entry.properties.marker;
    if (!Array.isArray(markerValue)) continue;

    for (const marker of markerValue) {
      if (!isRecord(marker)) continue;
      const coordinates = getString(marker.coordinates);
      if (!coordinates) continue;

      markers.push({
        name: entry.title,
        link: `/${entry.slug}`,
        mapName: getString(marker.mapName),
        coordinates,
        icon: getString(marker.icon),
        colour: getString(marker.colour),
        minZoom: toNumber(marker.minZoom),
      });
    }
  }

  const filteredMarkers = markers.filter((marker) => {
    if (mapName) return !marker.mapName || marker.mapName === mapName;
    return marker.mapName === undefined;
  });

  return (
    <div>
      <div
        class="leaflet-map"
        data-src={imageSource}
        data-height={height}
        data-min-zoom={minZoom}
        data-max-zoom={maxZoom}
        data-default-zoom={defaultZoom}
        data-zoom-delta={zoomDelta}
        data-scale={scale}
        data-unit={unit}
        data-enable-copy-tool="false"
      >
        {filteredMarkers.map((marker) => (
          <div
            class="leaflet-marker"
            data-name={marker.name}
            data-link={marker.link}
            data-coordinates={marker.coordinates}
            data-icon={(marker.icon ?? DEFAULTS.markerIcon).replace("lucide-", "")}
            data-colour={marker.colour ?? DEFAULTS.markerColour}
            data-min-zoom={marker.minZoom ?? minZoom}
          />
        ))}
      </div>
    </div>
  );
};

export const leafletMapViewRegistration: ViewTypeRegistration = {
  id: "leaflet-map",
  name: "Map",
  icon: "map",
  render: leafletMapRenderer,
  css: leafletMapCss,
  afterDOMLoaded: leafletMapScript,
};
