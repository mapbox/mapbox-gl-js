[Mapbox GL style functions](https://www.mapbox.com/mapbox-gl-style-spec/#function) are used to specify a property value that varies according to zoom level. This library implements the semantics of interpolated and piecewise-constant functions as specified by the [Mapbox GL Style Specification](https://github.com/mapbox/mapbox-gl-style-spec).

### Usage

``` javascript
var glfun = require('mapbox-gl-function');

var identity = glfun.interpolated({type: 'identity'});
identity(0); // => '0'
identity('A'); // => 'A'
identity(['A']); // => ['A']

var exponential = glfun.interpolated({type: 'exponential', stops: [[1, 1], [5, 10]]});
exponential(0);  // => 1
exponential(1);  // => 1
exponential(3);  // => 5.5
exponential(5);  // => 10
exponential(11); // => 10

var interval = glfun.interpolated({type: 'interval', stops: [[1, 'a'], [3, 'b'], [4, 'c']]});
interval(0); // => 'a'
interval(1); // => 'a'
interval(2); // => 'a'
interval(3); // => 'b'
interval(4); // => 'c'

var categorical = glfun.interpolated({type: 'categorical', stops: [['A', 'a'], ['B', 'b'], ['C', 'c']]});
categorical('A'); // => 'a'
categorical('B'); // => 'b'
categorical('C'); // => 'c'
```
