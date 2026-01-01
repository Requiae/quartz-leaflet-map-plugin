import { Root } from "mdast";
import { QuartzTransformerPlugin } from "../types";
import { visit } from "unist-util-visit";
import { VFile } from "vfile";
import { Element } from "hast";

// Data stored across several invocations of this plugin
const LEAFLET_MAP_PLUGIN_DATA: {
  markerMap: { [key: string]: Marker[] };
} = {
  markerMap: {},
};

// Predefined colours used by the plugin
const markerColourMap = {
  green: "#039c4b",
  lime: "#66d313",
  yellow: "#e2c505",
  pink: "#ff0984",
  blue: "#21409a",
  lightblue: "#04adff",
  brown: "#e48873",
  orange: "#f16623",
  red: "#f44546",
  purple: "#7623a5",
};
type MarkerColour = keyof typeof markerColourMap;

interface Marker {
  name: string;
  link: string;
  position: { x: number; y: number };
  icon: string;
  colour: string;
  minZoom: number;
}

interface FrontmatterMarkerData {
  mapName: string;
  x: string;
  y: string;
  icon: string;
  colour: MarkerColour | string | undefined;
  minZoom: string;
}

interface MapMetadata {
  name: string;
  src: string;
  minZoom: number;
  maxZoom: number;
  initialZoom: number;
  zoomStep: number;
}

function isFrontmatterMarkerData(object: any): object is FrontmatterMarkerData {
  if (!object || !object.x || !object.y || !object.icon) {
    return false;
  }

  // Undefined colours are handled elsewhere, these may pass
  if (!object.colour) {
    return true;
  }

  // We only accept predefined and hex colours
  const testColourValue = object.colour.toLowerCase();
  if (
    !Object.keys(markerColourMap).includes(testColourValue) &&
    !/([0-9A-F]{3}){1,2}$/i.test(testColourValue)
  ) {
    return false;
  }

  return true;
}

function getColourValue(colour: MarkerColour | string | undefined): string {
  if (!colour) {
    return markerColourMap.blue;
  }

  const unparsedColourValue = colour.toLowerCase();
  if (Object.keys(markerColourMap).includes(unparsedColourValue)) {
    return markerColourMap[unparsedColourValue as MarkerColour];
  }
  return `#${unparsedColourValue.toLowerCase()}`;
}

function buildMarkerData(file: VFile): void {
  const { slug, frontmatter } = file.data;
  const markerData = frontmatter?.marker;

  if (!slug || !frontmatter || !frontmatter?.title || !markerData) {
    return;
  }

  let confirmedMarkerData: FrontmatterMarkerData[];
  if (Array.isArray(markerData) && markerData.every((value) => isFrontmatterMarkerData(value))) {
    confirmedMarkerData = markerData;
  } else if (isFrontmatterMarkerData(markerData)) {
    confirmedMarkerData = [markerData];
  } else {
    return;
  }

  for (const marker of confirmedMarkerData) {
    const mapName = marker.mapName.toLowerCase().trim();
    if (LEAFLET_MAP_PLUGIN_DATA.markerMap[mapName] === undefined) {
      LEAFLET_MAP_PLUGIN_DATA.markerMap[mapName] = [];
    }

    LEAFLET_MAP_PLUGIN_DATA.markerMap[mapName].push({
      name: frontmatter.title,
      link: slug,
      position: { x: parseInt(marker.x), y: parseInt(marker.y) },
      icon: marker.icon,
      colour: getColourValue(marker.colour),
      minZoom: marker.minZoom ? parseInt(marker.minZoom) : -1,
    });
  }
}

function buildMarkerObject(marker: Marker, distance: number): Element {
  return {
    type: "element",
    tagName: "div",
    properties: {
      class: ["leaflet-marker"],
      "data-name": marker.name,
      "data-link": `./${"../".repeat(distance)}${marker.link}`,
      "data-pos-x": marker.position.x,
      "data-pos-y": marker.position.y,
      "data-icon": marker.icon,
      "data-colour": marker.colour,
      "data-min-zoom": marker.minZoom,
    },
    children: [],
  };
}

function collectMapMetadata(node: any): MapMetadata {
  // Parse data stored in callout meta data
  const calloutMetadata = ((node.properties?.dataCalloutMetadata ?? "") as string).replaceAll(
    /(\\n)| /g,
    "",
  );

  var minZoom = parseFloat((calloutMetadata.match(/minZoom:\s?(-?\d+\.?\d*)/) ?? ["", "0"])[1]);
  var maxZoom = parseFloat((calloutMetadata.match(/maxZoom:\s?(-?\d+\.?\d*)/) ?? ["", "2"])[1]);
  var initialZoom = parseFloat(
    (calloutMetadata.match(/initialZoom:\s?(-?\d+\.?\d*)/) ?? ["", minZoom.toString()])[1],
  );
  var zoomStep = parseFloat((calloutMetadata.match(/zoomStep:\s?(-?\d+\.?\d*)/) ?? ["", "0.5"])[1]);

  // Parse data stored in callout content
  var name = "";
  visit(node, { type: "text" }, (target: any, _index: any, _parent: any) => {
    if (!target.value || target.value.replaceAll(/(\n)| /g, "") === "") {
      return;
    }

    // Only use the first actual string found, this should be the title
    if (name === "") {
      name = target.value;
    }
  });

  var src = "";
  visit(node, { tagName: "img" }, (target: any, _index: any, _parent: any) => {
    src = target.properties.src;
  });

  return { minZoom, maxZoom, initialZoom, zoomStep, name, src };
}

export const LeafletMap: QuartzTransformerPlugin = () => ({
  name: "LeafletMapPlugin",
  markdownPlugins() {
    return [
      () => {
        // For every file, check if the frontmatter contains marker data,
        // and if so add it to a global constant
        return (_tree: Root, file: VFile) => buildMarkerData(file);
      },
    ];
  },
  htmlPlugins() {
    return [
      () => {
        return (tree: Root, file: VFile) => {
          visit(tree, { tagName: "blockquote" }, (node: any, index: any, parent: any) => {
            if (node.properties?.dataCallout !== "map" || !parent || index === undefined) {
              return;
            }

            const mapMetaData = collectMapMetadata(node);
            const mapName = mapMetaData.name.toLowerCase().trim();
            const markers = LEAFLET_MAP_PLUGIN_DATA.markerMap[mapName] ?? [];

            // Fix slug based navigation based on distance to root
            const distanceToRoot = (file.data.filePath ?? "/").split("/").length - 2; // Deduct root directory and current page from distance

            // Build the new leaflet element
            const leafletContainer: Element = {
              type: "element",
              tagName: "div",
              properties: {},
              children: [
                {
                  type: "element",
                  tagName: "div",
                  properties: {
                    class: ["leaflet-map"],
                    "data-src": mapMetaData.src,
                    "data-min-zoom": mapMetaData.minZoom,
                    "data-max-zoom": mapMetaData.maxZoom,
                    "data-initial-zoom": mapMetaData.initialZoom,
                    "data-zoom-step": mapMetaData.zoomStep,
                  },
                  children: markers.map((marker) => buildMarkerObject(marker, distanceToRoot)),
                },
              ],
            };

            // Replace the blockquote with the leaflet element
            parent.children[index] = leafletContainer;
          });
        };
      },
    ];
  },
  externalResources() {
    return {
      css: [
        { content: "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" },
        {
          inline: true,
          content: `INLINE_CSS_SOURCE`,
        },
      ],
      js: [
        {
          loadTime: "afterDOMReady",
          src: "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js",
          contentType: "external",
        },
        {
          loadTime: "beforeDOMReady",
          src: "https://code.iconify.design/iconify-icon/3.0.0/iconify-icon.min.js",
          contentType: "external",
        },
        {
          loadTime: "afterDOMReady",
          contentType: "inline",
          script: `INLINE_JS_SOURCE`,
        },
      ],
    };
  },
});
