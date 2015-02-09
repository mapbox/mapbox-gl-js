
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
so that it can return accurate line numbers for errors. If you happen to
have an object, you'll need to use JSON.stringify() to convert it to a string
first.


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

