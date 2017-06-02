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
      ["get", ["properties"], "temperature", "Number"],
      0,
      // blue is higher when feature.properties.temperature is lower
      ["-", 100, ["get", ["properties"], "temperature", "Number"]]
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
      0, [ "get", ["properties"], "rating", "Number" ],
      // zoom is 20 and "rating" is 0 -> circle radius will be 4 * 0 = 0px
      // zoom is 20 and "rating" is 5 -> circle radius will be 4 * 5 = 20px
      10, [ "*", 4, [ "get", ["properties"], "rating", "Number" ] ]
    ]
  }
}
```

## Property Expressions

Property expressions are represented using a Lisp-like structured syntax tree.

###Types

Every expression evaluates to a value of one of the following types.

- `Null`
  - Literal: `null`
- `String`
  - Literal: `"my string value"`
- `Number`
  - Literal: `1729`
- `Boolean`
  - Literal: `true` or `false`
- `Color`
- `Object`
- `Array<T, N>`: an array of N values of type T
  - Literal: `["array", v0, v1, ...]`
- `Vector<T>`: a dynamically sized array of values of type T
  - Literal: `["vector", v0, v1, v2, ... vN]`
  - TODO: without type inference, 0-length arrays and vectors can't be typed
- `Value`: A "variant" type representing the set of possible values retrievable from a feature's `properties` object (`Null | String | Number | Boolean | Object | Vector<Value>`)
- `Error`: a subtype of all other types. Used wherever an expression is unable to return the appropriate supertype. Carries diagnostic information such as an explanatory message and the expression location where the Error value was generated.

###Constants:
- `[ "ln2" ] -> Number`
- `[ "pi" ] -> Number`
- `[ "e" ] -> Number`

### Type conversion:
- `["string", e: Value] -> String`
- `["number", e:Value] -> Number`
  - Uses platform-default string-to-number conversion. (TBD: parse locale-specificformatted number strings)
- `["boolean", e:Value] -> Boolean`
  - `0`, `''`, and `null` are converted to `false`, all other values to `true`

###Lookup:
- `["get", obj: Object, key: String ] -> Value`
- `["has", obj: Object, key: String ] -> Boolean`
- `["at", arr: Array<T>|Vector<T>, index: Number] -> T`
- `["typeof", expr: Value] -> String`
- `["length", e: Vector<T>|String] -> Number`

###Feature data:
- `["properties"] -> Object` the feature's `properties` object
- `["geometry_type"] -> String` the string value of `feature.geometry.type`
- `[ "id" ] -> Value` returns the value of `feature.id`.

###Decision:
- `["case", cond1: Boolean, result1: T, cond2: Boolean, result2: T, ..., cond_m, result_m: T, result_otherwise: T] -> T`
- `["match", x: T, a_1: T, y_1: U, a_2: T, y_2: U, ..., a_m: T, y_m: U, y_else: U]` - `a_1`, `a_2`, ... must be _literal_ values of type `T`.
- `["is_error", expr: T]` - `true` if `expr` is an `Error` value, `false` otherwise

###Comparison and boolean operations:
- `[ "==", expr1: T, expr2: T] -> Boolean`, where T is any primitive type. (similar for `!=`)
- `[ ">", lhs_expr: T, rhs_expr: T ] -> Boolean`, where T is any primitive type. (similar for <, >=, <=)
- `[ "&&", e1: Boolean, e2: Boolean, ... ] -> Boolean` (similar for `||`)
- `[ "!", e: Boolean] -> Boolean`

###Curves:

`["curve", interpolation, x: Number, n_1: Number, y_1: T, ..., n_m: Number, y_m: T] -> T` defines a function with `(n_1, y_1)`, ..., `(n_m, y_m)` as input/output pairs, and `interpolation` dictating how inputs between `n_i` and `n_(i+1)` are computed.
- The `n_i`'s must be numeric literals in strictly ascending order (`n_1 < n_2 < n_3 < ...`)
- Specific `interpolation` types may imply certain restrictions on the output type `T`.
- `interpolation` is one of:
  * `["step"]` - equivalent to existing "interval" function behavior.
  * `["exponential", base]` - `base` is a number > 0; equivalent to existing "exponential" function behavior. `T` must be `Number` or `Color`
  * `["linear"]` - equivalent to `["exponential", 1]`
  * `["cubic-bezier", x1, y1, x2, y2]` - define your own interpolation. `T` must be `Number`

###Math:
All of the following take `Number` inputs and produce a `Number`.
- +, -, \*, /, %, ^ (e.g. `["+", expr1, expr2, expr3, …]`, `["-", expr1, expr2 ]`, etc.)
- log10, ln, log2
- sin, cos, tan, asin, acos, atan
- ceil, floor, round, abs
- min, max

###String:
- `["concat", expr1: T, expr2: U, …] -> String`
- `["upcase", e: String] -> String`, `["downcase", e: String] -> String`

###Color:
- `['rgb', r: Number, g: Number, b: Number] -> Color`
- `['rgba', r: Number, g: Number, b: Number, a: Number] -> Color`
- `["color", c: String] -> Color`
  - `c` may be a CSS color name (`green`) or hex-encoded color string (`#4455FF`)

