**NOTE: Consider the contents of this doc as a proposed replacement for the "Function" section of the style spec docs.  Drafting it here rather than in the HTML doc so that it's easier to read/comment on.**

# Style Functions

The value for any layout or paint property may be specified as a function. Functions allow you to make the appearance of a map feature change with the current zoom level and/or the feature's properties.

`expression`
_Required [expression value](#Expressions)_
An expression defines how one or more feature property values and/or the current zoom level are combined using logical, mathematical, string, or color operations to produce the appropriate style value.  See [Expressions](#Expressions) for syntax details.

## Property functions

<p>A <strong>property function</strong> is any function defined using an expression that includes a reference to `["properties"]`. Property functions allow the appearance of a map feature to change with its properties. They can be used to visually differentate types of features within the same layer or create data visualizations. Note that support for property functions is not available across all properties and platforms at this time.</p>

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


## Zoom-dependent functions

A <strong>zoom function</strong> is any function defined using an expression that includes a reference to `["zoom"]`.  Such functions allow the appearance of a map feature change with map’s zoom level. Zoom functions can be used to create the illusion of depth and control data density.  

A zoom function must be of the following form (see [Curves](#Curves) below):

```js
{
  "expression": [ "curve", interpolation, ["zoom"], ... ]
}
```

(`["zoom"]` may not appear anywhere else in the expression.)


### Example: a zoom-only function.

```js
{
  "circle-radius": {
    "expression": [
      "curve", "linear", ["zoom"],
      // zoom is 5 (or less) -> circle radius will be 1px
      // zoom is 10 (or greater) -> circle radius will be 2px
      5, 1, 10, 2
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
    "expression": [
      "curve", "linear", ["zoom"],

      // zoom is 0 and "rating" is 0 -> circle radius will be 0px
      // zoom is 0 and "rating" is 5 -> circle radius will be 5px
      0, [ "number_data", "rating" ],
      // zoom is 20 and "rating" is 0 -> circle radius will be 4 * 0 = 0px
      // zoom is 20 and "rating" is 5 -> circle radius will be 4 * 5 = 20px
      10, [ "*", 4, ["number_data", "rating"] ]
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
- string `"foo"`
- number `42`
- boolean `true` or `false`
- null `null`
- object `["object", obj]` where `obj` is a JSON object literal
- array `["array", arr]` where `arr` is a JSON array literal

**Lookup:**
- `["get", container, key ]`
  - `container`: `array` or `object`
  - `key`: `string` if `container` is an object, `number` if it's an array.
- `[ "has", container, key ]` returns `true` if the property is present, false otherwise.
- `[ "typeof", container, key ]` yields the data type of `container[key]`: one of `'string'`, `'number'`, `'boolean'`, `'object'`, `'array'`, or, in the case that the property is not present, `'none'`.

**Feature data:**
- `["properties"]` the feature's `properties` object
- `["geometry_type"]` the string value of `feature.geometry.type`
- `[ "id" ]` returns the value of `feature.id`.

**Decision:**
- `["case", cond1, result1, cond2, result2, ..., ["else"], result_m]`
- `["if", boolean_expr, expr_if_true, expr_if_false]` - synonym for `["case", boolean_expr, expr_if_true, ["else"], expr_if_false]`
- `["match", x, a_1, y_1, a_2, y_2, ..., ["else"], y_else]`

**Comparison and boolean operations:**
- `[ "==", expr1, expr2]` (similar for `!=`)
- `[ ">", lhs_expr, rhs_expr ]` (similar for <, >=, <=)
- `[ "&&", boolean_expr1, boolean_expr2, ... ]` (similar for `||`)
- `[ "!", boolean_expr]`

**Curves:**
`["curve", interpolation, x, n_1, y_1, ..., n_m, y_m]` defines a function with n_1, y_1, ..., n_m, y_m as input/output pairs, and `interpolation` dictating how inputs between `n_(i)` and `n_(i+1)` are computed.
- The `n_i`'s must be strictly ascending (`n_1 < n_2 < n_3 < ...`)
- The `y_i`'s must all be of the same type. (Specific `interpolation` types may impose further restrictions.)
- _interpolation_ is one of:
  * `["step"]` - equivalent to existing "interval" function behavior.
  * `["exponential", _base_]` - equivalent to existing "exponential" function behavior. `y_i`'s must be numeric or color expressions
  * `["linear"]` - equivalent to `["exponential", 1]`
  * `["cubic-bezier", x1, y1, x2, y2]` - define your own interpolation. `y_i`'s must be numeric.

**Math:**
- +, -, \*, /, %, ^ (e.g. `["+", expr1, expr2, expr3, …]`, `["-", expr1, expr2 ]`, etc.)
- log10, ln, log2
- sin, cos, tan, asin, acos, atan
- ceil, floor, round, abs
- min, max

**String:**
- `["concat", expr1, expr2, …]`
- `["upcase", string_expr]`, `["downcase", string_expr]`

**Color:**
- rgb, hsl, hcl, lab, hex, (others?)
- `["color", color_name_expr]`

