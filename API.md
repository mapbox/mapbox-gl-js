
### `migrate(style)`

Migrate a Mapbox GL Style to the latest version.


### Parameters

| parameter | type   | description       |
| --------- | ------ | ----------------- |
| `style`   | object | a Mapbox GL Style |


### Example

```js
var fs = require('fs');
var migrate = require('mapbox-gl-style-lint').migrate;
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
var validate = require('mapbox-gl-style-lint').validate;
var style = fs.readFileSync('./style.json', 'utf8');
var errors = validate(style);
```


**Returns** `Array.<Object>`, an array of error objects


### `validate.parsed(JSON)`

Validate a Mapbox GL Style given a JSON object. Returns an array
that can contain any number of objects representing errors. Each
object has members `line` (number) if parsed was called via
mapbox-gl-style-lint.validate and `message` (string).


### Parameters

| parameter | type   | description                      |
| --------- | ------ | -------------------------------- |
| `JSON`    | Object | a Mapbox GL Style as JSON object |


### Example

```js
var fs = require('fs');
var validate = require('mapbox-gl-style-lint').validate;
var style = JSON.parse(fs.readFileSync('./style.json', 'utf8'));
var errors = validate.parsed(style);
```


**Returns** `Array.<Object>`, an array of error objects


