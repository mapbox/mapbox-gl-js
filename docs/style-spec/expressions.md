# Style Function Expressions

**Constants:**
- `[ "ln2" ]`
- `[ "pi" ]`
- `[ "e" ]`

**Literal:**
- JSON string / number / boolean literal

**Property lookup:**
- Feature property: `[ "data", key_expr ]`
- Map property:
  - `[ "zoom" ]` (Note: expressions that refer to the map zoom level are only evaluated at integer zoomslevels. When the map is at non-integer zoom levels, the expression's value will be approximated using linear or exponential interpolation.)
  - `[ "pitch" ]`
  - etc.

**Decision:**
- `["if", boolean_expr, expr_if_true, expr_if_false]` 

**Boolean:**
- `[ "has", key_expr ]`
- `[ "==", expr1, expr2]` (similar for `!=`)
- `[ ">", lhs_expr, rhs_expr ]` (similar for <, >=, <=)
- `[ "between", value_expr, lower_bound_expr, upper_bound_expr ]`
- `[ "in", value_expr, item1_expr, item2_expr, ... ]`
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

