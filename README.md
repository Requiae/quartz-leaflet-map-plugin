# Quarts Leaflet Map Plugin

Adds a custom leaflet map implementation for [Quartz](https://github.com/jackyzha0/quartz) built websites.

## How to add it to your quartz

- Add file `leafletMapPlugin.ts` to your `quartz\plugins\transformers\`
- Append line `export { LeafletMap } from "./leafletMapPlugin"` to your `quartz\plugins\transformers\index.ts`
- Place line `Plugin.LeafletMap(),` to your `quartz.config.ts` in the end of `plugins: { transformers:` section
