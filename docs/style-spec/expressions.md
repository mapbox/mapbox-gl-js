# Style Function Expressions

**Constants:**
- `[ "ln2" ]`
- `[ "pi" ]`
- `[ "e" ]`

**Literal:**
- JSON string / number / boolean literal

**Property lookup:**
- Feature property:
  - `[ "number_data", key_expr ]` reads `feature.properties[key_expr]`, coercing it to a number if necessary.
  - `[ "string_data", key_expr ]` reads `feature.properties[key_expr]`, coercing it to a string if necessary.
  - `[ "boolean_data", key_expr ]` reads `feature.properties[key_expr]`, coercing it to a boolean if necessary, with `0`, `''`, `null`, and missing properties mapping to `false`, and all other values mapping to `true`.
  - `[ "has", key_expr ]` returns `true` if the property is present, false otherwise.
  - `[ "typeof", key_expr ]` yields the data type of `feature.properties[key_expr]`: one of `'string'`, `'number'`, `'boolean'`, `'object'`, `'array'`, or, in the case that the property is not present, `'none'`.
- `[ "geometry_type" ]` returns the value of `feature.geometry.type`.

**Map property:**
  - `[ "zoom" ]` (Note: expressions that refer to the map zoom level are only evaluated at integer zoomslevels. When the map is at non-integer zoom levels, the expression's value will be approximated using linear or exponential interpolation.)

**Decision:**
- `["if", boolean_expr, expr_if_true, expr_if_false]` 

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

**Color:**
- rgb, hsl, hcl, lab, hex, (others?)

