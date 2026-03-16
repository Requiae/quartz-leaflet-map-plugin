import { ViewTypeRegistration } from '@quartz-community/bases-page';

declare const leafletMapViewRegistration: ViewTypeRegistration;

interface LeafletMapViewConfig {
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
interface MarkerData {
    mapName?: string;
    coordinates: string;
    icon?: string;
    colour?: string;
    minZoom?: number;
}

export { type LeafletMapViewConfig, type MarkerData, leafletMapViewRegistration };
