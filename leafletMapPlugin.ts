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
  const calloutMetadata = ((node.properties?.dataCalloutMetadata ?? "") as string)
    .replaceAll(/(\\n)| /g, "")
    .split("-");

  var minZoom: number = 0;
  var maxZoom: number = 2;

  for (const data of calloutMetadata) {
    const unpacked = data.split(":");
    if (unpacked[0].toLowerCase() === "minzoom") {
      minZoom = parseInt(unpacked[1]);
    }
    if (unpacked[0].toLowerCase() === "maxzoom") {
      maxZoom = parseInt(unpacked[1]);
    }
  }

  // Parse data stored in callout content
  var name = "";
  visit(node, { type: "text" }, (target: any, _index, _parent) => {
    if (!target.value || target.value.replaceAll(/(\n)| /g, "") === "") {
      return;
    }

    // Only use the first actual string found, this should be the title
    if (name === "") {
      name = target.value;
    }
  });

  var src = "";
  visit(node, { tagName: "img" }, (target: any, _index, _parent) => {
    src = target.properties.src;
  });

  return { minZoom, maxZoom, name, src };
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
          visit(tree, { tagName: "blockquote" }, (node: any, index, parent) => {
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
          content: `#leaflet-map{width:100%;margin:0;z-index:0;background-color:#5078b41a;.leaflet-image-layer{margin:0!important}}.custom-div-icon .icon{position:absolute;width:32px;height:19px;font-size:19px;top:8px;left:0;z-index:inherit;margin:0 auto;display:flex;align-items:center;justify-content:center;color:#ebebec}.custom-div-icon .marker{position:absolute;width:32px;height:48px;margin:0 auto;z-index:inherit}`,
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
          script: `var __awaiter=this&&this.__awaiter||function(e,c,t,o){function i(n){return n instanceof t?n:new t(function(a){a(n)})}return new(t||(t=Promise))(function(n,a){function l(u){try{r(o.next(u))}catch(f){a(f)}}function s(u){try{r(o.throw(u))}catch(f){a(f)}}function r(u){u.done?n(u.value):i(u.value).then(l,s)}r((o=o.apply(e,c||[])).next())})},__generator=this&&this.__generator||function(e,c){var t={label:0,sent:function(){if(n[0]&1)throw n[1];return n[1]},trys:[],ops:[]},o,i,n,a=Object.create((typeof Iterator=="function"?Iterator:Object).prototype);return a.next=l(0),a.throw=l(1),a.return=l(2),typeof Symbol=="function"&&(a[Symbol.iterator]=function(){return this}),a;function l(r){return function(u){return s([r,u])}}function s(r){if(o)throw new TypeError("Generator is already executing.");for(;a&&(a=0,r[0]&&(t=0)),t;)try{if(o=1,i&&(n=r[0]&2?i.return:r[0]?i.throw||((n=i.return)&&n.call(i),0):i.next)&&!(n=n.call(i,r[1])).done)return n;switch(i=0,n&&(r=[r[0]&2,n.value]),r[0]){case 0:case 1:n=r;break;case 4:return t.label++,{value:r[1],done:!1};case 5:t.label++,i=r[1],r=[0];continue;case 7:r=t.ops.pop(),t.trys.pop();continue;default:if(n=t.trys,!(n=n.length>0&&n[n.length-1])&&(r[0]===6||r[0]===2)){t=0;continue}if(r[0]===3&&(!n||r[1]>n[0]&&r[1]<n[3])){t.label=r[1];break}if(r[0]===6&&t.label<n[1]){t.label=n[1],n=r;break}if(n&&t.label<n[2]){t.label=n[2],t.ops.push(r);break}n[2]&&t.ops.pop(),t.trys.pop();continue}r=c.call(e,t)}catch(u){r=[6,u],i=0}finally{o=n=0}if(r[0]&5)throw r[1];return{value:r[0]?r[1]:void 0,done:!0}}};function buildIcon(e,c){return L.divIcon({className:"custom-div-icon",html:\` <svg class="marker" style="fill:\`.concat(c,\`" viewBox="0 0 233.3 349.9"> <path d="M116.6 0A116.8 115.9 0 0 0 0 115.7c0 25.8 16.5 67.7 50.6 128.2 24 42.8 47.7 78.5 48.7 80l17.3 26 17.4-26c1-1.5 24.7-37.2 48.7-80 34-60.5 50.6-102.4 50.6-128.2C233.3 52 181 0 116.6 0"/> </svg> <iconify-icon class="icon" icon="\`).concat(e,\`"></iconify-icon> \`),iconSize:[32,48],iconAnchor:[16,48],tooltipAnchor:[17,-36]})}function getMarkerOnClick(e){return function(c){window.location.href="".concat(e)}}function addMarker(e,c){function t(a,l,s){l.getZoom()>=s?a.addTo(l):a.remove()}var o={icon:buildIcon(e.icon,e.colour)},i=parseInt(e.minZoom),n=L.marker([parseInt(e.posY),parseInt(e.posX)],o).bindTooltip(e.name).on("click",getMarkerOnClick(e.link));t(n,c,i),c.on("zoomend",function(){return t(n,c,i)})}function isMarkerDataSet(e){return!(!e.name||!e.link||!e.posX||!e.posY||!e.icon||!e.colour||!e.minZoom)}function isMapDataSet(e){return!(!e.src||!e.minZoom||!e.maxZoom)}function getMarkerData(e){for(var c=[],t=0,o=e;t<o.length;t++){var i=o[t];isMarkerDataSet(i.dataset)&&c.push(i.dataset),i.remove()}return c}function getMapData(e){for(var c=[],t=0,o=e;t<o.length;t++){var i=o[t];isMapDataSet(i.dataset)&&c.push(i.dataset)}return c}function getMeta(e){return __awaiter(this,void 0,Promise,function(){return __generator(this,function(c){return[2,new Promise(function(t,o){var i=new Image;i.onload=function(){return t(i)},i.onerror=function(n){return o(n)},i.src=e})]})})}function initialiseMap(e,c){return __awaiter(this,void 0,Promise,function(){var t,o,i,n;return __generator(this,function(a){switch(a.label){case 0:return t=e.dataset,isMapDataSet(t)?[4,getMeta(t.src)]:[2];case 1:return o=a.sent(),e.style.aspectRatio=(o.naturalWidth/o.naturalHeight).toString(),i=[[0,0],[o.naturalHeight/2,o.naturalWidth/2]],n=L.map(e,{crs:L.CRS.Simple,maxBounds:i,minZoom:parseInt(t.minZoom),maxZoom:parseInt(t.maxZoom)}),L.imageOverlay(t.src,i).addTo(n),n.fitBounds(i),c.map(function(l){return addMarker(l,n)}),[2,n]}})})}function cleanupMap(e){e&&(e.clearAllEventListeners(),e.remove())}document.addEventListener("nav",function(){return __awaiter(void 0,void 0,void 0,function(){var e,c,t,o,i;return __generator(this,function(n){switch(n.label){case 0:e=document.querySelectorAll("div.leaflet-map"),c=function(a){var l,s,r;return __generator(this,function(u){switch(u.label){case 0:return l=a.querySelectorAll("div.leaflet-marker"),s=getMarkerData(l),[4,initialiseMap(a,s)];case 1:return r=u.sent(),window.addCleanup(function(){return cleanupMap(r)}),[2]}})},t=0,o=e,n.label=1;case 1:return t<o.length?(i=o[t],[5,c(i)]):[3,4];case 2:n.sent(),n.label=3;case 3:return t++,[3,1];case 4:return[2]}})})});`,
        },
      ],
    };
  },
});
