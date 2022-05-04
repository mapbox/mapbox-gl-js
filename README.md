[<img width="400" alt="Mapbox" src="https://raw.githubusercontent.com/mapbox/mapbox-gl-js-docs/publisher-production/docs/pages/assets/logo.png">](https://www.mapbox.com/)

## Fork Versions:

| Fork Version | Mapbox version | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------ | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0.0.1        | 0.42.2         |
| 0.0.2        | 0.42.2         |
| 0.0.3        | 0.42.2         | Converting aggregateBy properties from string to number. Otherwise, not able to use exponential/interval stops.                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 0.0.4        | 0.42.2         | Support for multple aggregate by. Useful for aggregating by count and resizeBy column. Points (along with clusters which already have) will have abbreviated value for all aggregateBys.                                                                                                                                                                                                                                                                                                                                                                |
| 0.0.5        | 0.42.2         | Added support for groupBy, for vecotTile(geojson). In each cluster it will have splitups of aggregate based on the groupBy values in the features contributing to the cluster.                                                                                                                                                                                                                                                                                                                                                                          |
| 0.0.6        | 0.42.2         | Added support for finding features contributing to a cluster, so that we can spiderfy.                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 0.0.10       | 0.48.0         | Merged version 0.48.0 (latest version while working on this merge). Along with extra features/bug fixes, they implemented support for getChildren/getLeaves in geojson source. We got of our implementation of the same from geojsonSource/geojsonWorkerSource but mimiced mapbox's implementation in vectorTileSource/VectorTileWorkerSource. (We worked on unifinished branches/changes in between, so some version numbers have been skipped.) In this version, the getLeaves method parameters have changed for geojsonSource and vectorTileSource. |
| 0.0.11       | 0.54.1         | Merged version 0.51.1 (latest version while working on this merge). We got rid of custom aggregation/groupBy that we had for clustering and reused `clusterProperties` introduced in the recent versions. (`clusterProperties` will work for vector sources `geojsonTile` is `true` and `cluster` is `true`). Change `getClusterLeaves` to `getLeaves` in vector source, to match the function name in the geojson source implemented by mapbox team.                                                                                                   |
| 0.0.12       | 1.10.1         | Merged version 1.10.1                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 0.0.13       | 1.10.1         | Update minimist to v1.2.6                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |

## Fork Modifications:

- **Get Pins in Cluster**: ~~Expose getLeaves in superCluster via an interface, so that we can get the pins in a cluster and spiderfy them. Same has been added for vectortile source with geojson endpoints and clustering.~~ (It has been implemented by mapbox and has been merged in fork version 0.0.10. But in vector tile source, we have implemented a simillar version of mapbox's getLeaves but for vector tile sources.)
- **Aggregate Cluster By**: ~~Allow clusters to aggregated using a field. If a field is specified, each cluster will have a sum value which will be the sum of field values (pin[field]) of all pins in the cluster. Super cluster has built in support for it. But mapbox interface has not exposed it.~~ (It has been implemented by mapbox and has been merged in fork version 0.0.10. We have imported the same `clusterProperties` but for vector tile sources.)
- **Geojson tiles**: Provide geojson endpoints for VectorTileSource. Data fetched for each tile in geojson will be converted to vector tiles and handed back to the original workflow. In addition to the convertion it clusters points if enabled. (When clustering is enabled, it exposes `getLeaves` for Vector Tile sources simillar to the method in Geojson sources.)

## Fork Examples:

- fork_examples/geojsonTileClusters.html
- fork_examples/geojsonTilePolygons.html

## Known Fork shortcomings:

- ~~Geojson tiles, always set the cache expiry time to 'undefined' and cache control to 'max-age=90000',
  ignoring the cache headers in the tile's response.~~
- ~~AggregateBy multiple values/group have been implemented only in VectorTileSource(with geojson data urls)
  but in not GeojsonSource.~~

## Requirements to get rid of fork and use mainstream mapbox:

- Support for clustering points like supercluster by SOQL. `select cluster(location) group by snap_to_grid(location, 0.01)` (Very Much required to use mainstream mapbox)
- SOQL supports mapbox vector pbf format support. (If this can't be done, still the fork's role would be very much minized to just convert geojson response to mapbox vector tiles on client side. Or we can even create a new source/worker without fork like this here: `https://github.com/developmentseed/mapbox-gl-topojson`).
- Support for slicing shapes for the given tile. (so to reduce redundant data retrieval. Not required to get rid of fork. Better required for an ideal case.)

**Mapbox GL JS** is a JavaScript library for interactive, customizable vector maps on the web. It takes map styles that conform to the
[Mapbox Style Specification](https://docs.mapbox.com/mapbox-gl-js/style-spec/), applies them to vector tiles that
conform to the [Mapbox Vector Tile Specification](https://github.com/mapbox/vector-tile-spec), and renders them using
WebGL.

Mapbox GL JS is part of the [cross-platform Mapbox GL ecosystem](https://www.mapbox.com/maps/), which also includes
compatible native SDKs for applications on [Android](https://docs.mapbox.com/android/maps/overview/),
[iOS](https://docs.mapbox.com/ios/maps/overview/), [macOS](http://mapbox.github.io/mapbox-gl-native/macos),
[Qt](https://github.com/mapbox/mapbox-gl-native/tree/master/platform/qt), and [React Native](https://github.com/mapbox/react-native-mapbox-gl/). Mapbox provides building blocks to add location features like maps, search, and navigation into any experience you
create. To get started with GL JS or any of our other building blocks,
[sign up for a Mapbox account](https://www.mapbox.com/signup/).

In addition to GL JS, this repository contains code, issues, and test fixtures that are common to both GL JS and the
native SDKs. For code and issues specific to the native SDKs, see the
[mapbox/mapbox-gl-native](https://github.com/mapbox/mapbox-gl-native/) repository.

- [Getting started with Mapbox GL JS](https://docs.mapbox.com/mapbox-gl-js/overview/)
- [Tutorials](https://docs.mapbox.com/help/tutorials/#web-apps)
- [API documentation](https://docs.mapbox.com/mapbox-gl-js/api/)
- [Examples](https://docs.mapbox.com/mapbox-gl-js/examples/)
- [Style documentation](https://docs.mapbox.com/mapbox-gl-js/style-spec/)
- [Open source styles](https://github.com/mapbox/mapbox-gl-styles)
- [Contributor documentation](https://github.com/mapbox/mapbox-gl-js/blob/master/CONTRIBUTING.md)

[<img width="981" alt="Mapbox GL gallery" src="https://raw.githubusercontent.com/mapbox/mapbox-gl-js-docs/publisher-production/docs/pages/assets/gallery.png">](https://www.mapbox.com/gallery/)

## License

Mapbox GL JS is licensed under the [3-Clause BSD license](https://github.com/mapbox/mapbox-gl-js/blob/master/LICENSE.txt).
The licenses of its dependencies are tracked via [FOSSA](https://app.fossa.io/projects/git%2Bhttps%3A%2F%2Fgithub.com%2Fmapbox%2Fmapbox-gl-js):

[![FOSSA Status](https://app.fossa.io/api/projects/git%2Bhttps%3A%2F%2Fgithub.com%2Fmapbox%2Fmapbox-gl-js.svg?type=large)](https://app.fossa.io/projects/git%2Bhttps%3A%2F%2Fgithub.com%2Fmapbox%2Fmapbox-gl-js?ref=badge_large)
