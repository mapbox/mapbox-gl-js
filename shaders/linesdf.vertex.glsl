// these are the shaders for rendering antialiased lines

// floor(127 / 2) == 63.0
// the maximum allowed miter limit is 2.0 at the moment. the extrude normal is
// stored in a byte (-128..127). we scale regular normals up to length 63, but
// there are also "special" normals that have a bigger length (of up to 126 in
// this case).
#define scale 63.0

attribute vec2 a_pos;
attribute vec2 a_extrude;
attribute float a_linesofar;

// posmatrix is for the vertex position, exmatrix is for rotating and projecting
// the extrusion vector.
uniform mat4 u_posmatrix;
uniform mat4 u_exmatrix;

uniform vec2 u_patternscale_a;
uniform vec2 u_patternscale_b;
uniform float u_tex_y_a;
uniform float u_tex_y_b;

uniform vec2 u_linewidth;
uniform vec4 u_color;

varying vec2 v_normal;
varying vec2 v_tex_a;
varying vec2 v_tex_b;

void main() {
    // We store the texture normals in the most insignificant bit
    // transform y so that 0 => -1 and 1 => 1
    // In the texture normal, x is 0 if the normal points straight up/down and 1 if it's a round cap
    // y is 1 if the normal points up, and -1 if it points down
    vec2 normal = mod(a_pos, 2.0);
    normal.y = sign(normal.y - 0.5);
    v_normal = normal;

    // Scale the extrusion vector down to a normal and then up by the line width
    // of this vertex.
    vec2 extrude = a_extrude / scale;
    vec2 dist = u_linewidth.s * extrude;

    // Remove the texture normal bit of the position before scaling it with the
    // model/view matrix. Add the extrusion vector *after* the model/view matrix
    // because we're extruding the line in pixel space, regardless of the current
    // tile's zoom level.
    gl_Position = u_posmatrix * vec4(floor(a_pos / 2.0), 0.0, 1.0) + u_exmatrix * vec4(dist, 0.0, 0.0); 

    // calculate the texture coordinates
    v_tex_a = vec2(a_linesofar * u_patternscale_a.x, normal.y * u_patternscale_a.y + u_tex_y_a);
    v_tex_b = vec2(a_linesofar * u_patternscale_b.x, normal.y * u_patternscale_b.y + u_tex_y_b);
}
