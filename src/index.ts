import { viewRegistry } from "@quartz-community/bases-page";
import { leafletMapViewRegistration } from "./view";
import { defaultOptions } from "./types";
import type { LeafletMapPluginOptions } from "./types";

export { leafletMapViewRegistration } from "./view";
export type { LeafletMapViewConfig, MarkerData, LeafletMapPluginOptions } from "./types";

export function registerLeafletMap(userOpts?: Partial<LeafletMapPluginOptions>): void {
    const opts = { ...defaultOptions, ...userOpts };
    viewRegistry.register({
        ...leafletMapViewRegistration,
        options: opts,
    });
}

viewRegistry.register(leafletMapViewRegistration);
