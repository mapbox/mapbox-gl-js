// IMPORTANT:
// This prelude is injected in both vertex and fragment shader be wary
// of precision qualifiers as vertex and fragment precision may differ

#define EPSILON 0.0000001
#define PI 3.141592653589793
#define EXTENT 8192.0
#define HALF_PI PI / 2.0
#define QUARTER_PI PI / 4.0
#define RAD_TO_DEG 180.0 / PI
#define DEG_TO_RAD PI / 180.0
#define GLOBE_RADIUS EXTENT / PI / 2.0