import { ViewTypeRegistration } from "@quartz-community/bases-page";

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
interface LeafletMapPluginOptions {
    enableCopyTool?: boolean;
}
interface MarkerData {
    mapName?: string;
    coordinates: string;
    icon?: string;
    colour?: string;
    minZoom?: number;
}

declare const leafletMapViewRegistration: ViewTypeRegistration;

declare function registerLeafletMap(userOpts?: Partial<LeafletMapPluginOptions>): void;
/**
 * Called by Quartz's config-loader with merged options from
 * `quartz.config.yaml` and `package.json` defaultOptions.
 */
declare function init(options?: Record<string, unknown>): void;

export {
    type LeafletMapPluginOptions,
    type LeafletMapViewConfig,
    type MarkerData,
    init,
    leafletMapViewRegistration,
    registerLeafletMap,
};
