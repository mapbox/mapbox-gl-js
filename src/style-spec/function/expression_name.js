// This would ideally be in expressions.js, but pulled into separate file
// to avoid circular imports, due to https://github.com/facebook/flow/issues/3249
export type ExpressionName =
    "!" |
    "!=" |
    "%" |
    "&&" |
    "*" |
    "+" |
    "-" |
    "/" |
    "<" |
    "<=" |
    "==" |
    ">" |
    ">=" |
    "^" |
    "abs" |
    "acos" |
    "array" |
    "asin" |
    "at" |
    "atan" |
    "boolean" |
    "case" |
    "ceil" |
    "coalesce" |
    "color" |
    "concat" |
    "cos" |
    "cubic-bezier" |
    "curve" |
    "downcase" |
    "e" |
    "floor" |
    "geometry_type" |
    "get" |
    "has" |
    "id" |
    "length" |
    "linear" |
    "ln" |
    "ln2" |
    "log10" |
    "log2" |
    "match" |
    "max" |
    "min" |
    "number" |
    "object" |
    "pi" |
    "properties" |
    "rgb" |
    "rgba" |
    "round" |
    "sin" |
    "string" |
    "tan" |
    "to_boolean" |
    "to_number" |
    "to_rgba" |
    "to_string" |
    "typeof" |
    "upcase" |
    "zoom" |
    "||"

module.exports = {};
