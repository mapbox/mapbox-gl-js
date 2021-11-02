
uniform mat4 u_matrix;
uniform float u_extrude_scale;
uniform float u_opacity;
uniform float u_intensity;

attribute vec2 a_pos;

#ifdef PROJECTION_GLOBE_VIEW
attribute vec3 a_pos_3;         // Projected position on the globe
attribute vec3 a_pos_normal_3;  // Surface normal at the position
attribute float a_scale;

// Uniforms required for transition between globe and mercator
uniform mat4 u_inv_rot_matrix;
uniform vec2 u_merc_center;
uniform vec3 u_tile_id;
uniform float u_zoom_transition;
uniform vec3 u_up_dir;
#endif

varying vec2 v_extrude;

#pragma mapbox: define highp float weight
#pragma mapbox: define mediump float radius

// Effective "0" in the kernel density texture to adjust the kernel size to;
// this empirically chosen number minimizes artifacts on overlapping kernels
// for typical heatmap cases (assuming clustered source)
const highp float ZERO = 1.0 / 255.0 / 16.0;

// Gaussian kernel coefficient: 1 / sqrt(2 * PI)
#define GAUSS_COEF 0.3989422804014327

void main(void) {
    #pragma mapbox: initialize highp float weight
    #pragma mapbox: initialize mediump float radius

    // unencode the extrusion vector that we snuck into the a_pos vector
    vec2 unscaled_extrude = vec2(mod(a_pos, 2.0) * 2.0 - 1.0);

    // This 'extrude' comes in ranging from [-1, -1], to [1, 1].  We'll use
    // it to produce the vertices of a square mesh framing the point feature
    // we're adding to the kernel density texture.  We'll also pass it as
    // a varying, so that the fragment shader can determine the distance of
    // each fragment from the point feature.
    // Before we do so, we need to scale it up sufficiently so that the
    // kernel falls effectively to zero at the edge of the mesh.
    // That is, we want to know S such that
    // weight * u_intensity * GAUSS_COEF * exp(-0.5 * 3.0^2 * S^2) == ZERO
    // Which solves to:
    // S = sqrt(-2.0 * log(ZERO / (weight * u_intensity * GAUSS_COEF))) / 3.0
    float S = sqrt(-2.0 * log(ZERO / weight / u_intensity / GAUSS_COEF)) / 3.0;

    // Pass the varying in units of radius
    v_extrude = S * unscaled_extrude;

    // Scale by radius and the zoom-based scale factor to produce actual
    // mesh position
    vec2 extrude = v_extrude * radius * u_extrude_scale;

    // multiply a_pos by 0.5, since we had it * 2 in order to sneak
    // in extrusion data
    vec2 tilePos = floor(a_pos * 0.5);

#ifdef PROJECTION_GLOBE_VIEW
    // Compute positions on both globe and mercator plane to support transition between the two modes
    // Apply extra scaling to extrusion to cover different pixel space ratios (which is dependant on the latitude)
    extrude *= a_scale;
    vec3 pos_normal_3 = a_pos_normal_3 / 16384.0;
    mat3 surface_vectors = globe_mercator_surface_vectors(pos_normal_3, u_up_dir, u_zoom_transition);
    vec3 surface_extrusion = extrude.x * surface_vectors[0] + extrude.y * surface_vectors[1];
    vec3 globe_elevation = elevationVector(tilePos) * elevation(tilePos);
    vec3 globe_pos = a_pos_3 + surface_extrusion + globe_elevation;
    vec3 mercator_elevation = u_up_dir * u_tile_up_scale * elevation(tilePos);
    vec3 merc_pos = mercator_tile_position(u_inv_rot_matrix, tilePos, u_tile_id, u_merc_center) + surface_extrusion + mercator_elevation;
    vec3 pos = mix_globe_mercator(globe_pos, merc_pos, u_zoom_transition);
#else
    vec3 pos = vec3(tilePos + extrude, elevation(tilePos));
#endif

    gl_Position = u_matrix * vec4(pos, 1);

#ifdef FOG
    v_fog_pos = fog_position(pos);
#endif
}
