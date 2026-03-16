/* eslint-disable @typescript-eslint/no-namespace */

declare const L: typeof import("leaflet");

type LatLng = import("leaflet").LatLng;
type LatLngTuple = import("leaflet").LatLngTuple;
type LatLngBoundsExpression = import("leaflet").LatLngBoundsExpression;
type LeafletMouseEvent = import("leaflet").LeafletMouseEvent;
type Polyline = import("leaflet").Polyline;
type Tooltip = import("leaflet").Tooltip;
type CircleMarker = import("leaflet").CircleMarker;
type LayerGroup = import("leaflet").LayerGroup;
type Map = import("leaflet").Map;
type Marker = import("leaflet").Marker;
type ControlOptions = import("leaflet").ControlOptions;

type SVGProps = Record<string, string | number | undefined> | { class: string[] };
type IconNode = [tag: string, attrs: SVGProps][];
type Icons = {
    [key: string]: IconNode;
};

interface CreateIconsOptions {
    icons?: Icons;
    nameAttr?: string;
    attrs?: SVGProps;
    root?: Element | Document | DocumentFragment;
    inTemplates?: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-namespace
declare namespace lucide {
    const createElement: (icon: IconNode) => HTMLElement;
    const createIcons: ({ icons, nameAttr, attrs, root, inTemplates }?: CreateIconsOptions) => void;
    const icons: Icons;
    const Ruler: IconNode;
    const MousePointer2: IconNode;
    const Pin: IconNode;
}

type Coordinates = `${number}, ${number}`;

interface MarkerDataSet {
    name: string;
    link: string;
    coordinates: Coordinates;
    icon: string;
    colour: string;
    minZoom: string;
}

interface MapDataSet {
    src: string;
    height: string;
    minZoom: string;
    maxZoom: string;
    defaultZoom: string;
    zoomDelta: string;
    scale: string;
    unit: string;
    enableCopyTool: string;
}

const C = {
    map: {
        default: {
            minZoom: "0",
            maxZoom: "2",
            zoomDelta: "0.5",
            zoomSnap: "0.01",
            height: "600",
            scale: "1",
            unit: "",
            enableCopyTool: "false",
        },
    },
} as const;

async function loadScript(urls: string[]): Promise<void> {
    for (const url of urls) {
        try {
            await new Promise<void>((resolve, reject) => {
                const script = document.createElement("script");
                script.src = url;
                script.onload = () => resolve();
                script.onerror = () => reject(new Error(`Failed to load: ${url}`));
                document.head.appendChild(script);
            });
            return;
        } catch {
            // Try next URL
        }
    }
    throw new Error(`All CDN sources failed for: ${urls.join(", ")}`);
}

async function loadDependencies(): Promise<void> {
    if (typeof L === "undefined") {
        await loadScript([
            "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js",
            "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js",
        ]);
    }
    if (typeof lucide === "undefined") {
        await loadScript([
            "https://cdn.jsdelivr.net/npm/lucide@0.575.0/dist/umd/lucide.min.js",
            "https://unpkg.com/lucide@0.575.0",
        ]);
    }
}

function isNonEmptyObject(value: unknown): value is { [key: string]: string } {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    return (
        Object.keys(value).length > 0 &&
        Object.values(value).every((value) => typeof value === "string")
    );
}

function parseCoordinates(coordinates: Coordinates): LatLngTuple {
    const parsedCoordinates = coordinates
        .replace(/\s/g, "")
        .split(",")
        .map((coordinate) => parseInt(coordinate));

    if (!isLatLngTuple(parsedCoordinates)) {
        throw new Error("Coordinates not properly validated");
    }

    return parsedCoordinates;
}

function isLatLngTuple(value: unknown): value is LatLngTuple {
    return (
        !!value &&
        Array.isArray(value) &&
        value.length === 2 &&
        value.every((value) => typeof value === "number" && !isNaN(value))
    );
}

function createIcons(element: Element): void {
    lucide.createIcons({
        attrs: {
            class: ["leaflet-marker-inner-icon"],
        },
        root: element,
    });
}

function distance(a: LatLng, b: LatLng): number {
    const square = (value: number) => value * value;
    return Math.sqrt(square(a.lat - b.lat) + square(a.lng - b.lng));
}

function getIcon(icon: string): HTMLElement {
    const element = document.createElement("i");
    element.setAttribute("data-lucide", icon);
    lucide.createIcons({ root: element });
    return element;
}

void getIcon;

function isMarkerDataSet(dataset: unknown): dataset is MarkerDataSet {
    if (!isNonEmptyObject(dataset)) return false;
    if (
        !dataset["name"] ||
        !dataset["link"] ||
        !dataset["coordinates"] ||
        !dataset["icon"] ||
        !dataset["colour"] ||
        !dataset["minZoom"]
    ) {
        return false;
    }
    return true;
}

function getMarkerData(map: HTMLElement): MarkerDataSet[] {
    const markers: NodeListOf<HTMLElement> = map.querySelectorAll("div.leaflet-marker");
    const data: MarkerDataSet[] = [];
    markers.forEach((marker) => {
        if (isMarkerDataSet(marker.dataset)) {
            data.push(marker.dataset);
        }
        marker.remove();
    });
    return data;
}

function buildMarkerIcon(link: string, icon: string, colour: string) {
    return L.divIcon({
        className: "leaflet-marker-icon",
        html: `<a href="${link}"><svg class="leaflet-marker-pin" style="fill:${colour}" viewBox="0 0 32 48"><path d="m32,19c0,12 -12,24 -16,29c-4,-5 -16,-16 -16,-29a16,19 0 0 1 32,0"/></svg><i data-lucide="${icon}"></i></a>`,
        iconSize: [32, 48],
        iconAnchor: [16, 48],
        tooltipAnchor: [17, -30],
    });
}

function addMarker(markerData: MarkerDataSet, mapItem: Map) {
    function addMarkerWhenZoom(markerItem: Marker, mapItem: Map, markerZoom: number) {
        const tolerance = 0.00001;
        mapItem.getZoom() >= markerZoom - tolerance
            ? markerItem.addTo(mapItem)
            : markerItem.remove();
        const markerElement = markerItem.getElement();
        if (markerElement) createIcons(markerElement);
    }

    const { link, icon, colour, minZoom, coordinates, name } = markerData;
    const options = { icon: buildMarkerIcon(link, icon, colour) };

    const markerZoom = parseFloat(minZoom);
    const markerItem = L.marker(parseCoordinates(coordinates), options).bindTooltip(name);

    addMarkerWhenZoom(markerItem, mapItem, markerZoom);
    mapItem.on("zoomend", () => addMarkerWhenZoom(markerItem, mapItem, markerZoom));
}

interface SubControlOptions {
    index: number;
    map: Map;
    onSelectCallback: (index: number) => void;
}

class SubControl {
    readonly index: number;
    readonly map: Map;

    private onSelectCallback: (index: number) => void = () => {};
    protected button: HTMLDivElement | undefined;
    protected options: MapDataSet = {
        ...C.map.default,
        defaultZoom: C.map.default.minZoom,
        src: "",
    };
    private _isSelected: boolean = false;
    get isSelected(): boolean {
        return this._isSelected;
    }

    constructor(options: SubControlOptions) {
        this.index = options.index;
        this.map = options.map;
        this.onSelectCallback = options.onSelectCallback;
    }

    setSelected(isSelected: boolean): void {
        if (this._isSelected === isSelected) return;

        this._isSelected = isSelected;
        if (isSelected) {
            this.button?.classList.add("selected");
            this.onSelected();
        } else {
            this.button?.classList.remove("selected");
            this.onDeselected();
        }
    }

    onAdd(containerEl: HTMLElement): void {
        this.button = L.DomUtil.create("div", "leaflet-control-button", containerEl);
        this.button.addEventListener("click", () => this.onSelectCallback(this.index));
        L.DomEvent.disableClickPropagation(containerEl);
        this.onAdded();
    }

    onRemove(): void {
        this.onRemoved();
        this.button?.removeEventListener("click", () => {});
        this.button?.replaceChildren();
    }

    updateSettings(options: MapDataSet): void {
        this.options = { ...this.options, ...options };
    }

    protected onAdded(): void {
        throw new Error("Not implemented");
    }

    protected onRemoved(): void {}
    protected onSelected(): void {}
    protected onDeselected(): void {}

    mapClicked(_event: LeafletMouseEvent): void {
        throw new Error("Not implemented");
    }
}

class PanControl extends SubControl {
    override onAdded(): void {
        if (this.button) {
            this.button.appendChild(lucide.createElement(lucide.MousePointer2));
            this.button.ariaLabel = "Pan";
        }
    }

    override mapClicked(_event: LeafletMouseEvent): void {}
}

enum MeasureState {
    Ready,
    Measuring,
    Finishing,
    Done,
}

class MeasureControl extends SubControl {
    private state: MeasureState = MeasureState.Ready;
    private pathItems: LatLng[] = [];
    private distance: number = 0;

    private lineLayer: LayerGroup | undefined;
    private pointLayer: LayerGroup | undefined;
    private pathLine: Polyline | undefined;
    private previewLine: Polyline | undefined;
    private previewTooltip: Tooltip | undefined;
    private lastElement: CircleMarker | undefined;

    override onAdded(): void {
        if (this.button) {
            this.button.appendChild(lucide.createElement(lucide.Ruler));
            this.button.ariaLabel = "Measure";
        }

        this.lineLayer = L.layerGroup().addTo(this.map);
        this.pointLayer = L.layerGroup().addTo(this.map);

        this.pathLine = L.polyline([]).addTo(this.lineLayer);
        this.previewLine = L.polyline([], { dashArray: "8" }).addTo(this.lineLayer);
        this.previewTooltip = this.getTooltip(true).setLatLng([0, 0]);
    }

    override onSelected(): void {
        this.map.getContainer().style.cursor = "crosshair";
        this.map.on("mousemove", (event: LeafletMouseEvent) => {
            this.renderPreview(event.latlng);
        });
    }

    override onDeselected(): void {
        this.map.getContainer().style.cursor = "";
        this.map.removeEventListener("mousemove");
        this.resetPath();
        this.state = MeasureState.Ready;
    }

    override mapClicked(event: LeafletMouseEvent): void {
        if (!this.lineLayer) throw new Error("Line layer not initialised");
        switch (this.state) {
            case MeasureState.Ready:
            case MeasureState.Measuring: {
                this.state = MeasureState.Measuring;
                this.pathItems.push(event.latlng);
                this.renderPath();
                this.previewTooltip?.addTo(this.lineLayer);
                this.renderPreview(event.latlng);
                break;
            }
            case MeasureState.Finishing: {
                this.state = MeasureState.Done;
                this.lastElement?.bindTooltip(this.getTooltip(true)).bringToFront();
                this.previewTooltip?.remove();
                break;
            }
            case MeasureState.Done: {
                this.resetPath();
                this.state = MeasureState.Ready;
            }
        }
    }

    private renderPath(): void {
        this.cleanLastElement();
        this.updatePolyline(this.pathLine, this.pathItems);

        const lastCoordinate = this.pathItems.at(-1);
        if (lastCoordinate === undefined) return;

        this.lastElement = this.getCircleMarker(lastCoordinate);

        const secondLastCoordinate = this.pathItems.at(-2);
        if (secondLastCoordinate === undefined) return;

        this.distance +=
            distance(lastCoordinate, secondLastCoordinate) * parseFloat(this.options.scale);
    }

    private renderPreview(mouseCoordinate: LatLng): void {
        if (this.state !== MeasureState.Measuring) return;

        const lastCoordinate = this.pathItems.at(-1);
        if (lastCoordinate === undefined) return;

        this.updatePolyline(this.previewLine, [lastCoordinate, mouseCoordinate]);
        this.previewTooltip = this.previewTooltip
            ?.setLatLng(mouseCoordinate)
            .setContent(
                this.getContent(
                    this.distance +
                        distance(lastCoordinate, mouseCoordinate) * parseFloat(this.options.scale),
                ),
            );
    }

    private resetPath(): void {
        this.pathItems = [];
        this.distance = 0;
        this.cleanLastElement();
        this.pointLayer?.clearLayers();
        this.updatePolyline(this.pathLine, []);
        this.updatePolyline(this.previewLine, []);
        this.previewTooltip?.remove();
    }

    private updatePolyline(line: Polyline | undefined, coordinates: LatLng[]): void {
        line?.setLatLngs(coordinates).redraw();
        line?.getElement()?.classList.remove("leaflet-interactive");
    }

    private cleanLastElement(): void {
        this.lastElement?.removeEventListener("click");
        this.lastElement?.getElement()?.classList.remove("leaflet-interactive");
    }

    private getTooltip(permanent: boolean = false): Tooltip {
        return L.tooltip({ permanent, offset: [15, 0] }).setContent(this.getContent(this.distance));
    }

    private getCircleMarker(coordinate: LatLng): CircleMarker {
        if (!this.pointLayer) throw new Error("Point layer not initialised");
        return L.circleMarker(coordinate, {
            radius: 4,
            fill: true,
            fillColor: "#3388ff",
            fillOpacity: 1,
        })
            .addTo(this.pointLayer)
            .addEventListener("click", () => (this.state = MeasureState.Finishing));
    }

    private getContent(measurement: number): string {
        return `${measurement.toFixed(1)} ${this.options?.unit ?? C.map.default.unit}`;
    }
}

class CopyControl extends SubControl {
    private previewTooltip: Tooltip | undefined;
    override onAdded(): void {
        if (this.button) {
            this.button.appendChild(lucide.createElement(lucide.Pin));
            this.button.ariaLabel = "Copy";
        }
        this.previewTooltip = L.tooltip({ permanent: true, offset: [15, 0] }).setLatLng([0, 0]);
    }

    override onSelected(): void {
        this.map.getContainer().style.cursor = "crosshair";
        this.map.on("mousemove", (event: LeafletMouseEvent) => {
            this.renderPreview(event.latlng);
        });
        this.previewTooltip?.addTo(this.map);
    }

    override onDeselected(): void {
        this.map.getContainer().style.cursor = "";
        this.map.removeEventListener("mousemove");
        this.previewTooltip?.remove();
    }

    override mapClicked(event: LeafletMouseEvent): void {
        void navigator.clipboard.writeText(this.getContent(event.latlng));
    }

    private renderPreview(mouseCoordinate: LatLng): void {
        this.previewTooltip
            ?.setContent(this.getContent(mouseCoordinate))
            .setLatLng(mouseCoordinate);
    }

    private getContent(coordinate: LatLng): string {
        return `${Math.round(coordinate.lat)}, ${Math.round(coordinate.lng)}`;
    }
}

interface ControlContainerOptions extends ControlOptions {
    enableCopyTool: boolean;
}

const DefaultControlContainerOptions: ControlContainerOptions = { enableCopyTool: false };

// Lazily define ControlContainer after Leaflet is loaded (L.Control is unavailable at parse time)
type ControlContainerClass = new (options: ControlContainerOptions) => L.Control & {
    updateSettings(options: MapDataSet): void;
};
let _ControlContainer: ControlContainerClass | null = null;

function getControlContainerClass(): ControlContainerClass {
    if (_ControlContainer) return _ControlContainer;

    class ControlContainer extends L.Control {
        private controls: SubControl[] = [];
        private activeIndex: number = 0;
        private settings: ControlContainerOptions;

        constructor(options: ControlContainerOptions) {
            super({ position: "topleft" });
            this.settings = { ...DefaultControlContainerOptions, ...options };
        }

        override onAdd(map: Map): HTMLElement {
            this.registerSubControl(PanControl, map);
            this.registerSubControl(MeasureControl, map);
            if (this.settings.enableCopyTool) this.registerSubControl(CopyControl, map);

            const containerEl = L.DomUtil.create("div", "leaflet-bar leaflet-control");

            for (const control of this.controls) {
                control.onAdd(containerEl);
            }
            this.controls[this.activeIndex]?.setSelected(true);

            map.on("click", (event: LeafletMouseEvent) => {
                for (const control of this.controls) {
                    if (control.isSelected) control.mapClicked(event);
                }
            });

            return containerEl;
        }

        override onRemove(map: Map | undefined): void {
            map?.removeEventListener("click");

            for (const control of this.controls) {
                control.onRemove();
            }
            this.controls = [];
        }

        updateSettings(options: MapDataSet): void {
            for (const control of this.controls) {
                control.updateSettings(options);
            }
        }

        private registerSubControl(control: typeof SubControl, map: Map): void {
            const onSelectCallback = (controlIndex: number) => {
                this.controls.at(this.activeIndex)?.setSelected(false);
                this.controls.at(controlIndex)?.setSelected(true);
                this.activeIndex = controlIndex;
            };
            const options = { index: this.controls.length, map, onSelectCallback };
            this.controls.push(new control(options));
        }
    }

    _ControlContainer = ControlContainer as unknown as ControlContainerClass;
    return _ControlContainer;
}

function isMapDataSet(dataset: unknown): dataset is MapDataSet {
    if (!isNonEmptyObject(dataset)) return false;
    if (
        !dataset["src"] ||
        !dataset["height"] ||
        !dataset["minZoom"] ||
        !dataset["maxZoom"] ||
        !dataset["defaultZoom"] ||
        !dataset["zoomDelta"] ||
        !dataset["scale"] ||
        !dataset["unit"]
    ) {
        return false;
    }
    return true;
}

async function getImageMeta(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = (error) => reject(error);
        image.src = url;
    });
}

async function initialiseMap(
    mapElement: HTMLElement,
    markers: MarkerDataSet[],
): Promise<Map | undefined> {
    const dataset = mapElement.dataset;
    if (!isMapDataSet(dataset)) {
        return;
    }

    const image = await getImageMeta(dataset.src);

    mapElement.style.aspectRatio = (image.naturalWidth / image.naturalHeight).toString();

    const bounds: LatLngBoundsExpression = [
        [0, 0],
        [image.naturalHeight, image.naturalWidth],
    ];

    const mapItem = L.map(mapElement, {
        crs: L.CRS.Simple,
        maxBounds: bounds,
        minZoom: parseFloat(dataset.minZoom),
        maxZoom: parseFloat(dataset.maxZoom),
        zoomSnap: 0.01,
        zoomDelta: parseFloat(dataset.zoomDelta),
    });

    const ControlContainer = getControlContainerClass();
    const controls = new ControlContainer({
        enableCopyTool: dataset.enableCopyTool === "true",
    }) as InstanceType<typeof L.Control<ControlContainerOptions>> & {
        updateSettings(options: MapDataSet): void;
    };
    controls.addTo(mapItem);
    controls.updateSettings(dataset);

    L.imageOverlay(dataset.src, bounds).addTo(mapItem);

    mapItem.fitBounds(bounds);
    markers.map((marker) => addMarker(marker, mapItem));
    mapItem.setZoom(parseFloat(dataset.defaultZoom));

    return mapItem;
}

function cleanupMap(mapItem: Map | undefined) {
    mapItem?.clearAllEventListeners();
    mapItem?.remove();
}

async function initializeLeafletMaps() {
    const maps: NodeListOf<HTMLElement> = document.querySelectorAll("div.leaflet-map");
    if (maps.length === 0) return;

    try {
        await loadDependencies();
    } catch (err) {
        console.error("[leaflet-map] Failed to load dependencies:", err);
        for (const map of Array.from(maps)) {
            map.textContent =
                "Failed to load map dependencies. Check your browser's content blocking settings.";
        }
        return;
    }

    for (const map of Array.from(maps)) {
        const markerData = getMarkerData(map);
        const mapItem = await initialiseMap(map, markerData);
        window.addCleanup(() => cleanupMap(mapItem));
    }
}

document.addEventListener("nav", initializeLeafletMaps);
document.addEventListener("render", initializeLeafletMaps);

export default "";
