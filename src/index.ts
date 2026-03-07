import { viewRegistry } from "@quartz-community/bases-page";
import { leafletMapViewRegistration } from "./view";

export { leafletMapViewRegistration } from "./view";
export type { LeafletMapViewConfig, MarkerData } from "./types";

viewRegistry.register(leafletMapViewRegistration);
