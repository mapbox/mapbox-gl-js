[Mapbox GL style functions](https://www.mapbox.com/mapbox-gl-style-spec/#function) are used to specify a property value that varies according to zoom level. This library implements the semantics of interpolated and piecewise-constant functions as specified by the [Mapbox GL Style Specification](https://github.com/mapbox/mapbox-gl-style-spec).

### Usage

``` javascript
var glfun = require('mapbox-gl-function');

var interpolated = glfun['interpolated']({stops: [[1, 1], [5, 10]]});
interpolated(0);  // => 1
interpolated(1);  // => 1
interpolated(3);  // => 5.5
interpolated(5);  // => 10
interpolated(11); // => 10

var piecewiseConstant = glfun['piecewise-constant']({stops: [[1, "a"], [3, "b"], [4, "c"]]});
piecewiseConstant(0); // => "a"
piecewiseConstant(1); // => "a"
piecewiseConstant(2); // => "a"
piecewiseConstant(3); // => "b"
piecewiseConstant(4); // => "c"
```
