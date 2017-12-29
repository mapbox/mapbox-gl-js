[<img width="400" alt="Mapbox" src="docs/pages/assets/logo.png">](https://www.mapbox.com/)

## Fork Versions:

Fork Version | Mapbox version
------------ | -------------
0.0.1        | 0.42.2


## Fork Modifications:
 * **Get Pins in Cluster**: Expose getLeaves in superCluster via an interface, so that we can get the pins in a cluster and spiderfy them.
 * **Aggregate Cluster By**: Allow clusters to aggregated using a field. If a field is specified, each cluster will have a sum value which will be the sum of field values (pin[field]) of all pins in the cluster. Super cluster has built in support for it. But mapbox interface has not exposed it.
 * **Geojson tiles**: Provide geojson endpoints for VectorTileSource. Every fetched geojson will converted to vector tiles and handed back to the original workflow.
 * **Tile url customization**: The tile url that we provide to VectorTileSource, by default will have x/y/zoom subsituted in the url for each call. In addition to that, this fork has added support for replacing soql constructs
   *  \{\{'point' column condition\}\} => intersects(point, 'POLYGON((90.00 20.00, .....))')
   * {snap_zoom} => options.snapZoom[tile zoom] || defaultSnapZoom for current zoom
   * {snapPrecision} => options.snapZoom[tile zoom] || defaultSnapZoom for current zoom
   * {simplifyPrecision} => options.snapZoom[tile zoom] || defaultSnapZoom for current zoom

##### Tile url customization
###### Options:
** snapZoom **: hash with zoom as keys and snapZoom values as values. default: current_zoom - 6
** snapPrecision **: hash with zoom as keys and snapPrecision values as values. default: 0.0001 / (2 * current_zoom)
** simplifyPrecision **: hash with zoom as keys and simplifyPrecision values as values. default: 0.0001 / (2 * current_zoom)

###### Example tile url:
```
https://opendata.test-socrata.com/resource/aaaa-bbbb.geojson?
  $query=select simplify_preserve_topology(snap_to_grid(the_geom,{snap_precision}),{simplify_precision})
  where  type='restaurant'
  group by simplify_preserve_topology(snap_to_grid(the_geom, {snap_precision}),{simplify_precision})
  limit 200000
```
###### Example options:
```javascript
  var options = {
  snapZoom: {
    1: 3,
    2: 3,
    3: 3,
    4: 6,
    5: 6,
    6: 6,
    7: 9,
    8: 9,
    9: 9,
    10: 10,
    11: 11,
    12: 12,
    13: 13,
    14: 14,
    15: 15,
    16: 16,
  },
  snapPrecision: {
    1: 0.001,
    2: 0.001,
    3: 0.001,
    4: 0.001,
    5: 0.001,
    6: 0.001,
    7: 0.001,
    8: 0.001,
    9: 0.001,
    10: 0.0006,
    11: 0.0006,
    12: 0.0001,
    13: 0.0001,
    14: 0.000002,
    15: 0.0000001,
    16: 0.000003125,
  },
  simplifyPrecision: {
    1: 0.001,
    2: 0.001,
    3: 0.001,
    4: 0.001,
    5: 0.001,
    6: 0.001,
    7: 0.001,
    8: 0.001,
    9: 0.001,
    10: 0.0006,
    11: 0.0006,
    12: 0.0001,
    13: 0.0001,
    14: 0.000002,
    15: 0.0000001,
    16: 0.000003125,
  }
}
```
**Mapbox GL JS** is a JavaScript library for interactive, customizable vector maps on the web. It takes map styles that conform to the
[Mapbox Style Specification](https://github.com/mapbox/mapbox-gl-js/style-spec/), applies them to vector tiles that
conform to the [Mapbox Vector Tile Specification](https://github.com/mapbox/vector-tile-spec), and renders them using
WebGL.

Mapbox GL JS is part of the [cross-platform Mapbox GL ecosystem](https://www.mapbox.com/maps/), which also includes
compatible native SDKs for applications on [Android](https://www.mapbox.com/android-sdk/),
[iOS](https://www.mapbox.com/ios-sdk/), [macOS](http://mapbox.github.io/mapbox-gl-native/macos),
[Qt](https://github.com/mapbox/mapbox-gl-native/tree/master/platform/qt), and [React Native](https://github.com/mapbox/react-native-mapbox-gl/). Mapbox provides building blocks to add location features like maps, search, and navigation into any experience you
create. To get started with GL JS or any of our other building blocks,
[sign up for a Mapbox account](https://www.mapbox.com/signup/).

In addition to GL JS, this repository contains code, issues, and test fixtures that are common to both GL JS and the
native SDKs. For code and issues specific to the native SDKs, see the
[mapbox/mapbox-gl-native](https://github.com/mapbox/mapbox-gl-native/) repository.

- [Getting started with Mapbox GL JS](https://www.mapbox.com/mapbox-gl-js/api/)
- [API documentation](https://www.mapbox.com/mapbox-gl-js/api/)
- [Examples](https://www.mapbox.com/mapbox-gl-js/examples/)
- [Style documentation](https://www.mapbox.com/mapbox-gl-js/style-spec/)
- [Open source styles](https://github.com/mapbox/mapbox-gl-styles)
- [Roadmap](https://www.mapbox.com/mapbox-gl-js/roadmap/)
- [Contributor documentation](https://github.com/mapbox/mapbox-gl-js/blob/master/CONTRIBUTING.md)

[<img width="981" alt="Mapbox GL gallery" src="docs/pages/assets/gallery.png">](https://www.mapbox.com/gallery/)

## License

Mapbox GL JS is licensed under the [3-Clause BSD license](https://github.com/mapbox/mapbox-gl-js/blob/master/LICENSE.txt).
The licenses of its dependencies are tracked via [FOSSA](https://app.fossa.io/projects/git%2Bhttps%3A%2F%2Fgithub.com%2Fmapbox%2Fmapbox-gl-js):

[![FOSSA Status](https://app.fossa.io/api/projects/git%2Bhttps%3A%2F%2Fgithub.com%2Fmapbox%2Fmapbox-gl-js.svg?type=large)](https://app.fossa.io/projects/git%2Bhttps%3A%2F%2Fgithub.com%2Fmapbox%2Fmapbox-gl-js?ref=badge_large)
