import { Root } from "mdast";
import { QuartzTransformerPlugin } from "../types";
import { visit } from "unist-util-visit";
import { Node, Parent } from "unist";
import { VFile } from "vfile";
import { Element } from "hast";
import { parse } from "yaml";
import { BuildCtx } from "../../util/ctx";
import { FilePath, FullSlug, resolveRelative, transformLink } from "../../util/path";

/**
 * TYPES.TS
 */

type Wiki = string[][]; // Wiki links take the shape of string[][]
type Coordinates = `${number}, ${number}`;
type Hex = `#${string}`;

interface MarkerObject {
    mapName?: string;
    coordinates: Coordinates;
    icon?: string;
    colour?: Hex;
    minZoom?: number;
}

interface MapObject {
    name?: string;
    image: string | Wiki;
    height?: number;
    minZoom?: number;
    maxZoom?: number;
    defaultZoom?: number;
    zoomDelta?: number;
    scale?: number;
    unit?: string;
}

type ValidatorFunction<T> = (value: unknown) => value is T;

/**
 * CONSTANTS.TS
 */

// Data stored across several invocations of this plugin
const LEAFLET_MAP_PLUGIN_DATA: {
    markerMap: { [key: string]: MarkerEntry[] };
} = {
    markerMap: {
        notDefinedMap: [],
    },
};

const C = {
    regExp: {
        hexColourValidation: /([0-9A-F]{3}){1,2}$/i,
        coordinatesValidation: /[0-9]+\s*,\s*[0-9]+/,
        iconValidation: /([a-z]+:)?[a-z]+([\-][a-z]+)*/,
        url: /https?:/,
        arrayString: /^\[.*[\]]$/,
    },
    map: {
        default: {
            minZoom: 0,
            maxZoom: 2,
            zoomDelta: 0.5,
            zoomSnap: 0.01,
            height: 600,
            scale: 1,
            unit: "",
        },
    },
} as const;

/**
 * UTIL.TS
 */

function isNonEmptyObject(value: unknown): value is { [key: string]: unknown } {
    if (!value || typeof value !== "object") return false;
    return Object.keys.length > 0;
}

function isNotNull<T>(value: T | null): value is T {
    return value !== null;
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}

/**
 * VALIDATORS.TS
 */

type ValidatedProperties = string | Wiki | number;

function stringValidator(value: unknown): value is string {
    return typeof value === "string";
}

function sourcevalidator(value: unknown): value is string | Wiki {
    const preparedValue = typeof value === "string" ? value : value?.toString();
    return !!preparedValue;
}

function numberValidator(value: unknown): value is number {
    return Number.isFinite(value);
}

function positiveNumberValidator(value: unknown): value is number {
    return numberValidator(value) && value > 0;
}

function coordinatesValidator(value: unknown): value is Coordinates {
    return typeof value === "string" && C.regExp.coordinatesValidation.test(value);
}

function iconValidator(value: unknown): value is string {
    return typeof value === "string" && C.regExp.iconValidation.test(value);
}

function colourValidator(value: unknown): value is Hex {
    return typeof value === "string" && C.regExp.hexColourValidation.test(value);
}

const Validator = {
    string: stringValidator,
    source: sourcevalidator,
    number: numberValidator,
    positiveNumber: positiveNumberValidator,
    coordinates: coordinatesValidator,
    icon: iconValidator,
    colour: colourValidator,
} as const satisfies Record<string, ValidatorFunction<ValidatedProperties>>;

/**
 * SCHEMAS.TS
 */

type Schema<T extends string> = Record<
    T,
    { validator: ValidatorFunction<unknown>; required?: boolean }
>;
type ValidatedSchemas = MarkerObject | MapObject;

const markerSchema: Schema<keyof MarkerObject> = {
    mapName: { validator: Validator.string },
    coordinates: { validator: Validator.coordinates, required: true },
    icon: { validator: Validator.icon },
    colour: { validator: Validator.colour },
    minZoom: { validator: Validator.number },
};
const mapSchema: Schema<keyof MapObject> = {
    name: { validator: Validator.string },
    image: { validator: Validator.source, required: true },
    height: { validator: Validator.number },
    minZoom: { validator: Validator.number },
    maxZoom: { validator: Validator.number },
    defaultZoom: { validator: Validator.number },
    zoomDelta: { validator: Validator.positiveNumber },
    scale: { validator: Validator.number },
    unit: { validator: Validator.string },
};

function schemaValidatorFactory<T extends ValidatedSchemas>(
    schema: Schema<string>,
): ValidatorFunction<T> {
    function schemaValidator(value: unknown): value is T {
        if (!isNonEmptyObject(value)) return false;

        return Object.entries(schema)
            .map(([key, validate]) => {
                return (
                    (value[key] === undefined && !validate.required) ||
                    validate.validator(value[key])
                );
            })
            .every(Boolean);
    }
    return schemaValidator;
}

export const SchemaValidator = {
    marker: schemaValidatorFactory<MarkerObject>(markerSchema),
    map: schemaValidatorFactory<MapObject>(mapSchema),
} as const satisfies Record<string, ValidatorFunction<ValidatedSchemas>>;

/**
 * MARKER.TS
 */

interface MarkerEntry extends MarkerObject {
    name: string;
    link: FullSlug;
}

function isProperEntry(entry: unknown): entry is { [key: string]: string | number } {
    if (!isNonEmptyObject(entry)) return false;
    return Object.values(entry).every(
        (property) => typeof property === "string" || typeof property === "number",
    );
}

function parseMarkerFromEntry(entry: unknown, name: string, link: FullSlug): MarkerEntry | null {
    if (!isProperEntry(entry)) return null;
    if (!SchemaValidator.marker(entry)) return null;
    return {
        ...entry,
        name,
        link,
    };
}

function buildMarkerData(file: VFile): void {
    const { slug, frontmatter } = file.data;
    const markerData = frontmatter?.marker;

    if (!slug || !frontmatter || !frontmatter?.title || !markerData || !Array.isArray(markerData)) {
        return;
    }

    markerData
        .map((entry) => parseMarkerFromEntry(entry, frontmatter.title, slug))
        .filter(isNotNull)
        .forEach((marker) => {
            const mapName = marker.mapName;

            if (!mapName) {
                LEAFLET_MAP_PLUGIN_DATA.markerMap["notDefinedMap"]?.push(marker);
                return;
            }

            if (LEAFLET_MAP_PLUGIN_DATA.markerMap[mapName] === undefined) {
                LEAFLET_MAP_PLUGIN_DATA.markerMap[mapName] = [];
            }

            LEAFLET_MAP_PLUGIN_DATA.markerMap[mapName]?.push(marker);
        });
}

function buildMarkerElement(
    marker: MarkerEntry,
    currentSlug: FullSlug,
    mapMinZoom: number,
): Element {
    return {
        type: "element",
        tagName: "div",
        properties: {
            class: ["leaflet-marker"],
            "data-name": marker.name,
            "data-link": resolveRelative(currentSlug, marker.link as FullSlug),
            "data-coordinates": marker.coordinates,
            "data-icon": marker.icon,
            "data-colour": marker.colour,
            "data-min-zoom": marker.minZoom ?? mapMinZoom,
        },
        children: [],
    };
}

declare module "vfile" {
    interface DataMap {
        slug: FullSlug;
        filePath: FilePath;
        relativePath: FilePath;
        frontmatter: { [key: string]: unknown } & { title: string };
    }
}

/**
 * MAP.TS
 */

type ExtendedNode = Node & {
    value?: string;
    children?: Node[];
    properties?: { [key: string]: string };
};

function source(node: ExtendedNode): string {
    if (node.type === "text" && node.value !== undefined) return node.value;
    if (node.children === undefined) return "";

    return node.children.map((child) => source(child)).join("");
}

function parseMapFromNode(node: ExtendedNode): MapObject | undefined {
    const entry: unknown = parse(source(node));
    if (!isNonEmptyObject(entry) || !Array.isArray(entry.views)) return;
    return entry.views
        .map((view) => {
            if (!isProperEntry(view)) return null;
            // Confirm we are working with the right type of base
            if (!view.type || view.type !== "leaflet-map") return null;

            const object = {
                name: view.mapName,
                image: view.image,
                height: view.height,
                minZoom: view.minZoom,
                maxZoom: view.maxZoom,
                defaultZoom: view.defaultZoom,
                zoomDelta: view.zoomDelta,
                scale: parseFloat((view.scale ?? "").toString()),
                unit: view.unit,
            };

            if (!SchemaValidator.map(object)) return null;
            return object;
        })
        .filter(isNotNull)
        .at(0);
}

function buildMapData(ctx: BuildCtx, file: VFile, node: ExtendedNode): Element | undefined {
    const mapData = parseMapFromNode(node);
    if (!mapData) return;

    const currentSlug = file.data.slug;
    if (!currentSlug) throw new Error(`${file.path} has no slug`);
    const mapSource = transformLink(currentSlug, mapData.image.toString(), {
        strategy: "shortest",
        allSlugs: ctx.allSlugs,
    });

    const undefinedMarkers = LEAFLET_MAP_PLUGIN_DATA.markerMap["notDefinedMap"] ?? [];
    const definedMarkers = mapData.name
        ? (LEAFLET_MAP_PLUGIN_DATA.markerMap[mapData.name] ?? [])
        : [];
    const markers = [...undefinedMarkers, ...definedMarkers];

    const minZoom = mapData.minZoom ?? C.map.default.minZoom;
    const maxZoom = Math.max(mapData.maxZoom ?? C.map.default.maxZoom, minZoom);

    return {
        type: "element",
        tagName: "div",
        properties: {},
        children: [
            {
                type: "element",
                tagName: "div",
                properties: {
                    class: ["leaflet-map"],
                    "data-src": mapSource,
                    "data-height": mapData.height ?? C.map.default.height,
                    "data-min-zoom": minZoom,
                    "data-max-zoom": maxZoom,
                    "data-default-zoom": clamp(mapData.defaultZoom ?? minZoom, minZoom, maxZoom),
                    "data-zoom-delta": mapData.zoomDelta ?? C.map.default.zoomDelta,
                    "data-scale": mapData.scale ?? C.map.default.scale,
                    "data-unit": mapData.unit ?? C.map.default.unit,
                },
                children: markers.map((marker) => buildMarkerElement(marker, currentSlug, minZoom)),
            },
        ],
    };
}

function transformMapElement(ctx: BuildCtx, tree: Root, file: VFile): void {
    visit(
        tree,
        { tagName: "code" },
        (node: ExtendedNode, index: number | undefined, parent: Parent | undefined) => {
            if (node.properties?.dataLanguage !== "base" || !parent || index === undefined) {
                return;
            }

            const leafletElement = buildMapData(ctx, file, node);
            if (!leafletElement) return;

            // Replace the codeblock with the leaflet element
            parent.children[index] = leafletElement;
        },
    );
}

/**
 * CORE.TS
 */

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
    htmlPlugins(ctx) {
        return [
            () => {
                return (tree: Root, file: VFile) => transformMapElement(ctx, tree, file);
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
