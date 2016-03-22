
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


