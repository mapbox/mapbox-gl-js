**NOTE: Consider the contents of this doc as a proposed replacement for the "Function" section of the style spec docs.  Drafting it here rather than in the HTML doc so that it's easier to read/comment on.**

# Functions

The value for any layout or paint property may be specified as a function. Functions allow you to make the appearance of a map feature change with the current zoom level and/or the feature's properties.

## Property functions

<p><strong>Property functions</strong> allow the appearance of a map feature to change with its properties. Property functions can be used to visually differentate types of features within the same layer or create data visualizations. Note that support for property functions is not available across all properties and platforms at this time.</p>

`expression`
_Required [expression value](#Expressions)_
A property expression defines how one or more feature property values are combined using logical, mathematical, string, or color operations to produce the appropriate style value.  See [Expressions](#Expressions) for details.

```js
{
  "circle-color": {
    "expression": [
      'rgb',
      // red is higher when feature.properties.temperature is higher
      ["number_data", "temperature"],
      0,
      // blue is higher when feature.properties.temperature is lower
      ["-", 100, ["number_data", "temperature"]]
    ]
  }
}
```


## Zoom functions

**Zoom functions** allow the appearance of a map feature to change with map’s zoom level. Zoom functions can be used to create the illusion of depth and control data density.

`stops`
_Required array_
Zoom functions are defined in terms of input values and output values. A set of one input value and one output value is known as a "stop."  Each stop is thus an array with two elements: the first is a zoom level; the second is either a style value or a property function.  Note that support for property functions is not yet complete.

`base`
_Optional number. Default is 1._
The exponential base of the interpolation curve. It controls the rate at which the function output increases. Higher values make the output increase more towards the high end of the range. With values close to 1 the output increases linearly.

`type`
_Optional enum. One of exponential, interval._
 - `exponential` functions generate an output by interpolating between stops just less than and just greater than the function input. The domain must be numeric. This is the default for properties marked with , the "exponential" symbol.
 - `interval` functions return the output value of the stop just less than the function input. The domain must be numeric. This is the default for properties marked with , the "interval" symbol.


### Example: a zoom-only function.

```js
{
  "circle-radius": {
    "stops": [

      // zoom is 5 -> circle radius will be 1px
      [5, 1],

      // zoom is 10 -> circle radius will be 2px
      [10, 2]

    ]
  }
}
```

### Example: a zoom-and-property function

Using property functions as the output value for one or more zoom stops allows 
the appearance of a map feature to change with both the zoom level _and_ the
feature's properties.

```js
{
  "circle-radius": {
    "stops": [
      // zoom is 0 and "rating" is 0 -> circle radius will be 0px
      // zoom is 0 and "rating" is 5 -> circle radius will be 5px
      [0, { "expression": [ "number_data", "rating" ] }]

      // zoom is 20 and "rating" is 0 -> circle radius will be 4 * 0 = 0px
      // zoom is 20 and "rating" is 5 -> circle radius will be 4 * 5 = 20px
      [20, { "expression": [ "*", 4, ["number_data", "rating"] ] }]
    ]
  }
}
```


## Property Expressions

Property expressions are represented using a Lisp-like structured syntax tree.

**Constants:**
- `[ "ln2" ]`
- `[ "pi" ]`
- `[ "e" ]`

**Literals:**
- JSON string / number / boolean literal

**Property lookup:**
- Feature property:
  - `[ "number_data", key_expr ]` reads `feature.properties[key_expr]`, coercing it to a number if necessary.
  - `[ "string_data", key_expr ]` reads `feature.properties[key_expr]`, coercing it to a string if necessary.
  - `[ "boolean_data", key_expr ]` reads `feature.properties[key_expr]`, coercing it to a boolean if necessary, with `0`, `''`, `null`, and missing properties mapping to `false`, and all other values mapping to `true`.
  - `[ "has", key_expr ]` returns `true` if the property is present, false otherwise.
  - `[ "typeof", key_expr ]` yields the data type of `feature.properties[key_expr]`: one of `'string'`, `'number'`, `'boolean'`, `'object'`, `'array'`, or, in the case that the property is not present, `'none'`.
- `[ "geometry_type" ]` returns the value of `feature.geometry.type`.
- `[ "string_id" ]`, `[ "number_id" ]` returns the value of `feature.id`.

**Decision:**
- `["if", boolean_expr, expr_if_true, expr_if_false]` 
- `["switch", [[bool_expr1, result_expr1], [bool_expr2, result_expr2], ...], default_result_expr]`
- `["match", input_expr, [[test_expr1, result_expr1], [test_expr2, result_expr2]], default_result_expr]`
- `["interval", numeric_expr, [lbound_expr1, result_expr1], [lbound_expr2, result_expr2], ...]`

**Comparison and boolean operations:**
- `[ "==", expr1, expr2]` (similar for `!=`)
- `[ ">", lhs_expr, rhs_expr ]` (similar for <, >=, <=)
- `[ "&&", boolean_expr1, boolean_expr2, ... ]` (similar for `||`)
- `[ "!", boolean_expr]`

**String:**
- `["concat", expr1, expr2, …]`
- `["upcase", string_expr]`, `["downcase", string_expr]`

**Numeric:**
- +, -, \*, /, %, ^ (e.g. `["+", expr1, expr2, expr3, …]`, `["-", expr1, expr2 ]`, etc.)
- log10, ln, log2
- sin, cos, tan, asin, acos, atan
- ceil, floor, round, abs
- min, max
- `['linear', x, [ x1, y1 ], [ x2, y2 ] ]` - returns the output of the linear function determined by `(x1, y1)`, `(x2, y2)`, evaluated at `x`

**Color:**
- rgb, hsl, hcl, lab, hex, (others?)
- `["color", color_name_expr]`

