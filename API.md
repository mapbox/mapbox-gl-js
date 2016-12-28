
### `declassStyle(style, classes)`

Returns a new style with the given 'paint classes' merged into each layer's
main `paint` definiton, and with all `paint.*` properties removed.


### Parameters

| parameter | type              | description                                    |
| --------- | ----------------- | ---------------------------------------------- |
| `style`   | Object            | A style JSON object.                           |
| `classes` | Array\.\<string\> | An array of paint classes to apply, in order.  |


### Example

```js
var declass = require('mapbox-gl-style-spec/lib/declass')
var baseStyle = { ... style with a 'paint.night' property in some layers ... }
var nightStyle = declass(baseStyle, ['night'])
// nightStyle now has each layer's `paint.night` properties merged in to the
// main `paint` property.
```


### `derefLayers(layers)`

Given an array of layers, some of which may contain `ref` properties
whose value is the `id` of another property, return a new array where
such layers have been augmented with the 'type', 'source', etc. properties
from the parent layer, and the `ref` property has been removed.

The input is not modified. The output may contain references to portions
of the input.


### Parameters

| parameter | type             | description |
| --------- | ---------------- | ----------- |
| `layers`  | Array\.\<Layer\> |             |



**Returns** `Array.<Layer>`, 


### `diffStyles([before], after)`

Diff two stylesheet

Creates semanticly aware diffs that can easily be applied at runtime.
Operations produced by the diff closely resemble the mapbox-gl-js API. Any
error creating the diff will fall back to the 'setStyle' operation.

Example diff:
[
    { command: 'setConstant', args: ['@water', '#0000FF'] },
    { command: 'setPaintProperty', args: ['background', 'background-color', 'black'] }
]


### Parameters

| parameter  | type | description                            |
| ---------- | ---- | -------------------------------------- |
| `[before]` |      | _optional:_ stylesheet to compare from |
| `after`    |      | stylesheet to compare to               |



**Returns** `rra`, list of changes


### `format(style, [space])`

Format a Mapbox GL Style.  Returns a stringified style with its keys
sorted in the same order as the reference style.

The optional `space` argument is passed to
[`JSON.stringify`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify)
to generate formatted output.

If `space` is unspecified, a default of `2` spaces will be used.


### Parameters

| parameter | type   | description                                            |
| --------- | ------ | ------------------------------------------------------ |
| `style`   | Object | a Mapbox GL Style                                      |
| `[space]` | number | _optional:_ space argument to pass to `JSON.stringify` |


### Example

```js
var fs = require('fs');
var format = require('mapbox-gl-style-spec').format;
var style = fs.readFileSync('./source.json', 'utf8');
fs.writeFileSync('./dest.json', format(style));
fs.writeFileSync('./dest.min.json', format(style, 0));
```


**Returns** `string`, stringified formatted JSON


### `groupByLayout(layers)`

Given an array of layers, return an array of arrays of layers where all
layers in each group have identical layout-affecting properties. These
are the properties that were formerly used by explicit `ref` mechanism
for layers: 'type', 'source', 'source-layer', 'minzoom', 'maxzoom',
'filter', and 'layout'.

The input is not modified. The output layers are references to the
input layers.


### Parameters

| parameter | type             | description |
| --------- | ---------------- | ----------- |
| `layers`  | Array\.\<Layer\> |             |



**Returns** `Array.<Array.<Layer>>`, 


### `migrate(style)`

Migrate a Mapbox GL Style to the latest version.


### Parameters

| parameter | type   | description       |
| --------- | ------ | ----------------- |
| `style`   | object | a Mapbox GL Style |


### Example

```js
var fs = require('fs');
var migrate = require('mapbox-gl-style-spec').migrate;
var style = fs.readFileSync('./style.json', 'utf8');
fs.writeFileSync('./style.json', JSON.stringify(migrate(style)));
```


**Returns** `Object`, a migrated style


### `validate(style, [styleSpec])`

Validate a Mapbox GL style against the style specification.


### Parameters

| parameter     | type                   | description                                                                                                                |
| ------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `style`       | Object\,String\,Buffer | The style to be validated. If a `String`     or `Buffer` is provided, the returned errors will contain line numbers.       |
| `[styleSpec]` | Object                 | _optional:_ The style specification to validate against.     If omitted, the spec version is inferred from the stylesheet. |


### Example

```js
  var validate = require('mapbox-gl-style-spec').validate;
  var style = fs.readFileSync('./style.json', 'utf8');
  var errors = validate(style);
```


**Returns** `Array.<ValidationError|ParsingError>`, 


### `validateStyleMin(style, [styleSpec])`

Validate a Mapbox GL style against the style specification. This entrypoint,
`mapbox-gl-style-spec/lib/validate_style.min`, is designed to produce as
small a browserify bundle as possible by omitting unnecessary functionality
and legacy style specifications.


### Parameters

| parameter     | type   | description                                                                                             |
| ------------- | ------ | ------------------------------------------------------------------------------------------------------- |
| `style`       | Object | The style to be validated.                                                                              |
| `[styleSpec]` | Object | _optional:_ The style specification to validate against.     If omitted, the latest style spec is used. |


### Example

```js
  var validate = require('mapbox-gl-style-spec/lib/validate_style.min');
  var errors = validate(style);
```


**Returns** `Array.<ValidationError>`, 


### `createFilter(filter)`

Given a filter expressed as nested arrays, return a new function
that evaluates whether a given feature (with a .properties or .tags property)
passes its test.


### Parameters

| parameter | type  | description      |
| --------- | ----- | ---------------- |
| `filter`  | Array | mapbox gl filter |



**Returns** `Function`, filter-evaluating function


