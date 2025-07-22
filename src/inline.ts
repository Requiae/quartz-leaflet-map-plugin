interface MarkerDataSet {
  name: string;
  link: string;
  posX: string;
  posY: string;
  icon: string;
  colour: string;
  minZoom: string;
}

interface MapDataSet {
  base: string;
  src: string;
  minZoom: string;
  maxZoom: string;
}

function buildIcon(icon: string, colour: string) {
  return L.divIcon({
    className: "custom-div-icon",
    html: `
      <svg class="marker" style="fill:${colour}" viewBox="0 0 233.3 349.9">
        <path d="M116.6 0A116.8 115.9 0 0 0 0 115.7c0 25.8 16.5 67.7 50.6 128.2 24 42.8 47.7 78.5 48.7 80l17.3 26 17.4-26c1-1.5 24.7-37.2 48.7-80 34-60.5 50.6-102.4 50.6-128.2C233.3 52 181 0 116.6 0"/>
      </svg>
      <iconify-icon class="icon" icon="${icon}"></iconify-icon>
    `,
    iconSize: [32, 48],
    iconAnchor: [16, 48],
    tooltipAnchor: [17, -36],
  });
}

function getMarkerOnClick(url: string): L.LeafletMouseEventHandlerFn {
  return (_event: L.LeafletMouseEvent) => {
    window.location.href = `${url}`;
  };
}

function addMarker(markerData: MarkerDataSet, mapItem: L.Map) {
  function addMarkerWhenZoom(markerItem: L.Marker, mapItem: L.Map, markerZoom: number) {
    mapItem.getZoom() >= markerZoom ? markerItem.addTo(mapItem) : markerItem.remove();
  }

  const options = { icon: buildIcon(markerData.icon, markerData.colour) };

  const markerZoom = parseInt(markerData.minZoom);
  const markerItem = L.marker([parseInt(markerData.posY), parseInt(markerData.posX)], options)
    .bindTooltip(markerData.name)
    .on("click", getMarkerOnClick(markerData.link));

  addMarkerWhenZoom(markerItem, mapItem, markerZoom);
  mapItem.on("zoomend", () => addMarkerWhenZoom(markerItem, mapItem, markerZoom));
}

function isMarkerDataSet(dataset: any): dataset is MarkerDataSet {
  if (
    !dataset["name"] ||
    !dataset["link"] ||
    !dataset["posX"] ||
    !dataset["posY"] ||
    !dataset["icon"] ||
    !dataset["colour"] ||
    !dataset["minZoom"]
  ) {
    return false;
  }
  return true;
}

function isMapDataSet(dataset: any): dataset is MapDataSet {
  if (!dataset["src"] || !dataset["minZoom"] || !dataset["maxZoom"]) {
    return false;
  }
  return true;
}

function getMarkerData(markers: NodeListOf<HTMLElement>): MarkerDataSet[] {
  const data = [];
  for (const marker of markers) {
    if (isMarkerDataSet(marker.dataset)) {
      data.push(marker.dataset);
    }
    marker.remove();
  }
  return data;
}

function getMapData(maps: NodeListOf<HTMLElement>): MapDataSet[] {
  const data = [];
  for (const map of maps) {
    if (isMapDataSet(map.dataset)) {
      data.push(map.dataset);
    }
  }
  return data;
}

async function getMeta(url: string): Promise<HTMLImageElement> {
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
): Promise<L.Map | undefined> {
  const dataset = mapElement.dataset;
  if (!isMapDataSet(dataset)) {
    return;
  }

  const image = await getMeta(dataset.src);

  mapElement.style.aspectRatio = (image.naturalWidth / image.naturalHeight).toString();

  const bounds: L.LatLngBoundsExpression = [
    [0, 0],
    [image.naturalHeight / 2, image.naturalWidth / 2],
  ];

  const mapItem = L.map(mapElement, {
    crs: L.CRS.Simple,
    maxBounds: bounds,
    minZoom: parseInt(dataset.minZoom),
    maxZoom: parseInt(dataset.maxZoom),
  });

  L.imageOverlay(dataset.src, bounds).addTo(mapItem);

  mapItem.fitBounds(bounds);
  markers.map((marker) => addMarker(marker, mapItem));

  return mapItem;
}

function cleanupMap(mapItem: L.Map | undefined) {
  if (!mapItem) {
    return;
  }

  mapItem.clearAllEventListeners();
  mapItem.remove();
}

document.addEventListener("nav", async () => {
  const maps: NodeListOf<HTMLElement> = document.querySelectorAll("div.leaflet-map");
  for (const map of maps) {
    const markers: NodeListOf<HTMLElement> = map.querySelectorAll("div.leaflet-marker");
    const markerData = getMarkerData(markers);

    const mapItem = await initialiseMap(map, markerData);
    window.addCleanup(() => cleanupMap(mapItem));
  }
});
