// floor(127 / 2) == 63.0
// the maximum allowed miter limit is 2.0 at the moment. the extrude normal is
// stored in a byte (-128..127). we scale regular normals up to length 63, but
// there are also "special" normals that have a bigger length (of up to 126 in
// this case).
// #define scale 63.0
#define scale 0.015873016

attribute vec2 a_pos;
attribute vec4 a_data;

// matrix is for the vertex position, exmatrix is for rotating and projecting
// the extrusion vector.
uniform mat4 u_matrix;
uniform mat4 u_exmatrix;

// shared
uniform float u_ratio;
uniform vec2 u_linewidth;
uniform vec4 u_color;
uniform float u_point;

varying vec2 v_normal;
varying float v_linesofar;

void main() {
    vec2 a_extrude = a_data.xy;
    float a_linesofar = a_data.z * 128.0 + a_data.w;

    // We store the texture normals in the most insignificant bit
    // transform y so that 0 => -1 and 1 => 1
    // In the texture normal, x is 0 if the normal points straight up/down and 1 if it's a round cap
    // y is 1 if the normal points up, and -1 if it points down
    vec2 normal = mod(a_pos, 2.0);
    normal.y = sign(normal.y - 0.5);
    v_normal = normal;

    // Scale the extrusion vector down to a normal and then up by the line width
    // of this vertex.
    vec2 extrude = a_extrude * scale;
    vec2 dist = u_linewidth.s * extrude * (1.0 - u_point);

    // If the x coordinate is the maximum integer, we move the z coordinates out
    // of the view plane so that the triangle gets clipped. This makes it easier
    // for us to create degenerate triangle strips.
    float z = step(32767.0, a_pos.x);

    // When drawing points, skip every other vertex
    z += u_point * step(1.0, v_normal.y);

    // Remove the texture normal bit of the position before scaling it with the
    // model/view matrix. Add the extrusion vector *after* the model/view matrix
    // because we're extruding the line in pixel space, regardless of the current
    // tile's zoom level.
    gl_Position = u_matrix * vec4(floor(a_pos / 2.0), 0.0, 1.0) + u_exmatrix * vec4(dist, z, 0.0);
    v_linesofar = a_linesofar;// * u_ratio;


    gl_PointSize = 2.0 * u_linewidth.s - 1.0;
}
