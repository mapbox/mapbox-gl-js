# Style Function Expressions

**Constants:**
- LN2
- PI
- e

**Literal:**
- JSON string / number / boolean literal

**Property lookup:**
- Feature property:  `{ "ref": "feature", "key": propertyName, "default": defaultValue}`
- Map property:  `{"ref": "map",  "key": "zoom"|"pitch"|… }`
  - Note: expressions that refer to the map zoom level are only evaluated at integer zoomslevels. When the map is at non-integer zoom levels, the expression's value will be approximated using linear or exponential interpolation.

**Decision:**
- `["if", boolean_expr, expr_if_true, expr_if_false]` 
  - Alternative: `[` `"``if``"``, [ filter_expr, expr_if_true ], [ filter_expr, expr_if_true], …, expr_otherwise]` (where the first matching filter wins)

**Boolean:**
- has, !has
- ==, !=
- >, <, >=, <=, between(?),
- in, !in
- all, any, none

**String:**
- `["concat", expr1, expr2, …]`
- `["transform", string_expr, "uppercase"|"lowecase"]`

**Numeric:**
- +, -, \*, /, %, ^ (e.g. `["+", expr1, expr2, expr3, …]`, `["-", expr1, expr2 ]`, etc.)
- log10, ln, log2
- sin, cos, tan, asin, acos, atan
- ceil, floor, round, abs
- min, max

**Color:**
- rgb, hsl, hcl, lab, hex, (others?)

