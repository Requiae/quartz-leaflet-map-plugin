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

/**
 * Called by Quartz's config-loader with merged options from
 * `quartz.config.yaml` and `package.json` defaultOptions.
 */
export function init(options?: Record<string, unknown>): void {
    registerLeafletMap(options as Partial<LeafletMapPluginOptions> | undefined);
}

viewRegistry.register(leafletMapViewRegistration);
