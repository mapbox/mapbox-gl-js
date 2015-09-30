
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


### `validate(str)`

Validate a Mapbox GL Style given as a string of JSON. Returns an array
that can contain any number of objects representing errors. Each
object has members `line` (number) and `message` (string).

This expects the style to be given as a string, rather than an object,
so that it can return accurate line numbers for errors.
if you happen to have a JSON object already, use validate.parsed() instead.


### Parameters

| parameter | type   | description                   |
| --------- | ------ | ----------------------------- |
| `str`     | string | a Mapbox GL Style as a string |


### Example

```js
var fs = require('fs');
var validate = require('mapbox-gl-style-spec').validate;
var style = fs.readFileSync('./style.json', 'utf8');
var errors = validate(style);
```


**Returns** `Array.<Object>`, an array of errors


### `validate.parsed(style)`

Validate a Mapbox GL Style as a JSON object against the given
style `reference`. Returns results in the same format as
`validate`.


### Parameters

| parameter | type   | description       |
| --------- | ------ | ----------------- |
| `style`   | Object | a Mapbox GL Style |


### Example

```js
var fs = require('fs');
var validate = require('mapbox-gl-style-spec').validate;
var spec = require('mapbox-gl-style-spec');
var style = require('./style.json');
var errors = validate.parsed(style, spec.v7);
```


**Returns** `Array.<Object>`, an array of errors


### `validate.latest(style)`

Validate a Mapbox GL Style given a JSON object against the latest
version of the style spec. Returns results in the same format as
`validate`.


### Parameters

| parameter | type   | description       |
| --------- | ------ | ----------------- |
| `style`   | Object | a Mapbox GL Style |


### Example

```js
var fs = require('fs');
var validate = require('mapbox-gl-style-spec').validate;
var style = require('./style.json');
var errors = validate.latest(style);
```


**Returns** `Array.<Object>`, an array of errors


