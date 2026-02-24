# Quarts Leaflet Map Plugin

This the the [Quartz](https://github.com/jackyzha0/quartz) counterpart of the [Obsidian Leaflet Bases](https://github.com/Requiae/obsidian-leaflet-bases-plugin) plugin.
This plugin adds a custom leaflet map implementation for websites build using Quartz

## How to add it to your quartz

### Quartz v4

> Quartz v4 does not have a bases implementation. As such it is highly recommended (read 'basically required') to use the `mapName` feature if your vault has multiple maps.

Ensure you have a release tagged for Quartz v4

- Add file `leafletMapPlugin.ts` to your `quartz\plugins\transformers\`
- Append line `export { LeafletMap } from "./leafletMapPlugin"` to your `quartz\plugins\transformers\index.ts`
- Place line `Plugin.LeafletMap(),` to your `quartz.config.ts` in the end of `plugins: { transformers:` section

## How to use

### How to add a map to a note

Adding a map to a note is done by adding the following block of code to where you want the map to appear.

````markdown
```base
views:
  - type: leaflet-map
    name: Map
    mapName: test
    image: assets/Locke.png
    height: 400
    minZoom: -1.5
    maxZoom: 2
    defaultZoom: -1.5
    zoomDelta: 0.25
    scale: "0.2"
    unit: km
```
````

| Setting     | What it does                                                                                              |
| ----------- | --------------------------------------------------------------------------------------------------------- |
| type        | The type of base, don't change this (from Obsidian bases)                                                 |
| name        | What the view is called (from Obsidian bases)                                                             |
| image       | The image the map should show. It also accepts wiki links. Can be any image supported by Quartz           |
| mapName     | Optional identifier for the map. Useful if you want to reuse a note across several maps                   |
| defaultZoom | The zoom value the map opens with. Defaults to `minZoom`                                                  |
| minZoom     | How far you can zoom out. Defaults to 0. This value is allowed to be a decimal number and can be negative |
| maxZoom     | How far you can zoom in. Defaults to 2. This value is allowed to be a decimal number and can be negative  |
| zoomDelta   | How granular zooming is. This value is allowed to be a decimal number.                                    |
| scale       | How much to scale the result of the measure tool. This value is allowed to be a decimal number            |
| unit        | The unit the measure tool uses (think km, mi, hours)                                                      |

> Technically only `type`, `name`, and `image` are required for the map view to work. However you'll likely end up using most of the other settings.

> In v4 only `image` is required for the map view to work.

- `mapName` can be replaced by how you'd like to call your map. You should remember this value as we'll need it to add markers to you map later on. The map name does not need to be unique, but be sure the images are either identical or compatible for marker placement.
- `minZoom`, `maxZoom` are optional boundaries on how much you'll be able to zoom the map. Depending on your map image you might need to fiddle with these, or remove them altogether since they are optional.

### How to add a marker to a map

Adding a marker to a map is done by adding the following block of code to the frontmatter of the note you'd want the marker to link to. The example adds two markers.

```yaml
---
marker:
    - coordinates: 100, 300
      icon: lucide-tree-pine
      colour: "#039c4b"
      minZoom: 1
    - coordinates: 5, 5
      mapName: mapName
      colour: "#bdf123"
---
```

| Setting      |             | What it does                                                                                |
| ------------ | ----------- | ------------------------------------------------------------------------------------------- |
| Map name     | mapName     | If you want this marker to only show for a certain map, set this to the mapname of that map |
| Coordinates  | coordinates | Where the marker is placed on the map. Format is "latitude, longitude"                      |
| Icon         | icon        | Which icon to use for the marker. Can be any [lucide icon](https://lucide.dev/icons/).      |
| Colour       | colour      | Which colour the marker will be                                                             |
| Minimal zoom | minZoom     | How far zoomed in the map should be before the marker becomes visible                       |

> Technically only 'coordinates' is required for the marker to be valid. However you'll likely end up using most of the other settings.

## Troubleshooting

### If you use the Obsidian and your markers don't show up

Obsidian doesn't support nested YAML via the Note Properties plugin ([source](https://help.obsidian.md/properties#Not+supported)). However the [Obsidian Leaflet Bases](https://github.com/Requiae/obsidian-leaflet-bases-plugin) plugin adds tools to simply making and editing markers.

### If you use Quartz Syncer and your markers don't show up

Chances are that your Syncer settings do include all frontmatter/note properties. Try enabling the setting in Quartz Syncer to include all frontmatter/note properties.

## Credits

- [Quartz](https://github.com/jackyzha0/quartz) for which this plugin is for.
- [Lucide](https://lucide.dev/) for the API this plugin uses to load its icons.
- [Leaflet](https://github.com/Leaflet/Leaflet) which makes the whole plugin even possible.

## Make a new release

```shell
git tag -a 1.0.1 -m "1.0.1"
git push origin 1.0.1
```
