[Mapbox GL style functions](https://www.mapbox.com/mapbox-gl-style-spec/#function) are used to specify a property value that varies according to zoom level. This library implements the semantics of interpolated and piecewise-constant functions as specified by the [Mapbox GL Style Specification](https://github.com/mapbox/mapbox-gl-style-spec).

Note that other Mapbox tools currently use v1, not v2.

### Usage

``` javascript
var glfun = require('mapbox-gl-function');

var exponential = glfun({type: 'exponential', domain: [1, 5], range: [1, 10]});
exponential({ $zoom: 0 });  // => 1
exponential({ $zoom: 1 });  // => 1
exponential({ $zoom: 3 });  // => 5.5
exponential({ $zoom: 5 });  // => 10
exponential({ $zoom: 11 }); // => 10

var interval = glfun({type: 'interval', domain: [1, 3, 4], range: ['a', 'b', 'c']});
interval({ $zoom: 0 }); // => 'a'
interval({ $zoom: 1 }); // => 'a'
interval({ $zoom: 2 }); // => 'a'
interval({ $zoom: 3 }); // => 'b'
interval({ $zoom: 4 }); // => 'c'

var categorical = glfun({type: 'categorical', domain: ['A', 'B', 'C'], range: ['a', 'b', 'c']});
categorical({ $zoom: 'A' }); // => 'a'
categorical({ $zoom: 'B' }); // => 'b'
categorical({ $zoom: 'C' }); // => 'c'
```
