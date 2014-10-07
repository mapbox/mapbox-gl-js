## Filter

Filter expressions are used to target specific data in a layer.

This is based off [v5](https://github.com/mapbox/mapbox-gl-style-spec/blob/mb-pages/reference/v5.json) of the [Mapbox GL JS spec](https://www.mapbox.com/mapbox-gl-style-spec/#filter), and will very shortly be updated to reflect [v6](https://github.com/mapbox/mapbox-gl-style-spec/issues/178).

### Usage

``` javascript
var ff = require('feature-filter');

// will match a feature with class of street_limited,
// AND an admin_level less than or equal to 3,
// that's NOT a polygon.
var params = {
    "class": "street_limited",
    "admin_level": { ">=": 3 },
    "!": { "$type": "Polygon" }
}
// these params will match a feature that has a class of
// wetland OR wetland_noveg.
// { "class": ["wetland", "wetland_noveg"] }

// testFilter will be a function that returns a boolean
var testFilter = ff(params);

var feature = //layer feature that you're testing

// will return a boolean based on whether the feature matched the filter
return testFilter(feature)

```

#### Filter expressions
Expressions are interpreted as `AND` unless in an array or overriden by parent, in which they are interpreted as `OR`.

`&` AND operator.
`|` OR operator.
`^` XOR operator.
`!` NOR operator.
`$type` Geometry type that features must match. One of Point, LineString, Polygon.
`*` *filter_comparison* Arbitarily named feature member. A comparison object defining a filter expression.
      *filter_value* Arbitarily named feature member. A filter_value implies the equality (string/number/boolean) or set membership operator (array).

#### Filter comparisons
`==` Equality operator.
`!=` Inequality operator.
`>` Greater than operator.
`>=` Greater or equal than operator.
`<` Less than operator.
`<=` Less than or equal operator.
`in` Set member operator.
`!in` Not in set operator.