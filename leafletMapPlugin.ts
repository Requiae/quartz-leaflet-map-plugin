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
  minZoom?: number;
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
  zoomStep: number;
}

function isFrontmatterMarkerData(object: any): object is FrontmatterMarkerData {
  if (!object || !("x" in object) || !("y" in object) || !("icon" in object)) {
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
      minZoom: marker.minZoom ? parseInt(marker.minZoom) : undefined,
    });
  }
}

function buildMarkerObject(marker: Marker, distance: number, mapMinZoom: number): Element {
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
      "data-min-zoom": marker.minZoom ?? mapMinZoom,
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

  return { minZoom, maxZoom, zoomStep, name, src };
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
                    "data-zoom-step": mapMetaData.zoomStep,
                  },
                  children: markers.map((marker) =>
                    buildMarkerObject(marker, distanceToRoot, mapMetaData.minZoom),
                  ),
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
          content: `.leaflet-map{width:100%;margin:0;z-index:0;background-color:#5078b41a;.leaflet-image-layer{margin:0!important}}.custom-div-icon .icon{position:absolute;width:32px;height:19px;font-size:19px;top:8px;left:0;z-index:inherit;margin:0 auto;display:flex;align-items:center;justify-content:center;color:#ebebec}.custom-div-icon .marker{position:absolute;width:32px;height:48px;margin:0 auto;z-index:inherit}`,
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
          script: `var __awaiter=this&&this.__awaiter||function(e,a,t,i){function o(n){return n instanceof t?n:new t(function(c){c(n)})}return new(t||(t=Promise))(function(n,c){function l(u){try{r(i.next(u))}catch(f){c(f)}}function s(u){try{r(i.throw(u))}catch(f){c(f)}}function r(u){u.done?n(u.value):o(u.value).then(l,s)}r((i=i.apply(e,a||[])).next())})},__generator=this&&this.__generator||function(e,a){var t={label:0,sent:function(){if(n[0]&1)throw n[1];return n[1]},trys:[],ops:[]},i,o,n,c=Object.create((typeof Iterator=="function"?Iterator:Object).prototype);return c.next=l(0),c.throw=l(1),c.return=l(2),typeof Symbol=="function"&&(c[Symbol.iterator]=function(){return this}),c;function l(r){return function(u){return s([r,u])}}function s(r){if(i)throw new TypeError("Generator is already executing.");for(;c&&(c=0,r[0]&&(t=0)),t;)try{if(i=1,o&&(n=r[0]&2?o.return:r[0]?o.throw||((n=o.return)&&n.call(o),0):o.next)&&!(n=n.call(o,r[1])).done)return n;switch(o=0,n&&(r=[r[0]&2,n.value]),r[0]){case 0:case 1:n=r;break;case 4:return t.label++,{value:r[1],done:!1};case 5:t.label++,o=r[1],r=[0];continue;case 7:r=t.ops.pop(),t.trys.pop();continue;default:if(n=t.trys,!(n=n.length>0&&n[n.length-1])&&(r[0]===6||r[0]===2)){t=0;continue}if(r[0]===3&&(!n||r[1]>n[0]&&r[1]<n[3])){t.label=r[1];break}if(r[0]===6&&t.label<n[1]){t.label=n[1],n=r;break}if(n&&t.label<n[2]){t.label=n[2],t.ops.push(r);break}n[2]&&t.ops.pop(),t.trys.pop();continue}r=a.call(e,t)}catch(u){r=[6,u],o=0}finally{i=n=0}if(r[0]&5)throw r[1];return{value:r[0]?r[1]:void 0,done:!0}}};function buildIcon(e,a){return L.divIcon({className:"custom-div-icon",html:\` <svg class="marker" style="fill:\`.concat(a,\`" viewBox="0 0 233.3 349.9"> <path d="M116.6 0A116.8 115.9 0 0 0 0 115.7c0 25.8 16.5 67.7 50.6 128.2 24 42.8 47.7 78.5 48.7 80l17.3 26 17.4-26c1-1.5 24.7-37.2 48.7-80 34-60.5 50.6-102.4 50.6-128.2C233.3 52 181 0 116.6 0"/> </svg> <iconify-icon class="icon" icon="\`).concat(e,\`"></iconify-icon> \`),iconSize:[32,48],iconAnchor:[16,48],tooltipAnchor:[17,-36]})}function getMarkerOnClick(e){return function(a){window.location.href="".concat(e)}}function addMarker(e,a){function t(c,l,s){l.getZoom()>=s?c.addTo(l):c.remove()}var i={icon:buildIcon(e.icon,e.colour)},o=parseInt(e.minZoom),n=L.marker([parseInt(e.posY),parseInt(e.posX)],i).bindTooltip(e.name).on("click",getMarkerOnClick(e.link));t(n,a,o),a.on("zoomend",function(){return t(n,a,o)})}function isMarkerDataSet(e){return!(!e.name||!e.link||!e.posX||!e.posY||!e.icon||!e.colour||!e.minZoom)}function isMapDataSet(e){return!(!e.src||!e.minZoom||!e.maxZoom||!e.zoomStep)}function getMarkerData(e){for(var a=[],t=0,i=e;t<i.length;t++){var o=i[t];isMarkerDataSet(o.dataset)&&a.push(o.dataset),o.remove()}return a}function getMapData(e){for(var a=[],t=0,i=e;t<i.length;t++){var o=i[t];isMapDataSet(o.dataset)&&a.push(o.dataset)}return a}function getMeta(e){return __awaiter(this,void 0,Promise,function(){return __generator(this,function(a){return[2,new Promise(function(t,i){var o=new Image;o.onload=function(){return t(o)},o.onerror=function(n){return i(n)},o.src=e})]})})}function initialiseMap(e,a){return __awaiter(this,void 0,Promise,function(){var t,i,o,n;return __generator(this,function(c){switch(c.label){case 0:return t=e.dataset,isMapDataSet(t)?[4,getMeta(t.src)]:[2];case 1:return i=c.sent(),e.style.aspectRatio=(i.naturalWidth/i.naturalHeight).toString(),o=[[0,0],[i.naturalHeight/2,i.naturalWidth/2]],n=L.map(e,{crs:L.CRS.Simple,maxBounds:o,minZoom:parseFloat(t.minZoom),maxZoom:parseFloat(t.maxZoom),zoomSnap:.01,zoomDelta:parseFloat(t.zoomStep)}),L.imageOverlay(t.src,o).addTo(n),n.fitBounds(o),a.map(function(l){return addMarker(l,n)}),[2,n]}})})}function cleanupMap(e){e&&(e.clearAllEventListeners(),e.remove())}document.addEventListener("nav",function(){return __awaiter(void 0,void 0,void 0,function(){var e,a,t,i,o;return __generator(this,function(n){switch(n.label){case 0:e=document.querySelectorAll("div.leaflet-map"),a=function(c){var l,s,r;return __generator(this,function(u){switch(u.label){case 0:return l=c.querySelectorAll("div.leaflet-marker"),s=getMarkerData(l),[4,initialiseMap(c,s)];case 1:return r=u.sent(),window.addCleanup(function(){return cleanupMap(r)}),[2]}})},t=0,i=e,n.label=1;case 1:return t<i.length?(o=i[t],[5,a(o)]):[3,4];case 2:n.sent(),n.label=3;case 3:return t++,[3,1];case 4:return[2]}})})});`,
        },
      ],
    };
  },
});
