#define NUM_VISIBILITY_RINGS 2
#define INV_SQRT2 0.70710678
#define ELEVATION_BIAS 0.0001

#define NUM_SAMPLES_PER_RING 16

uniform mat4 u_matrix;
uniform vec2 u_extrude_scale;
uniform lowp float u_device_pixel_ratio;
uniform highp float u_camera_to_center_distance;

attribute vec2 a_pos;

varying vec3 v_data;
varying float v_visibility;

#pragma mapbox: define highp vec4 color
#pragma mapbox: define mediump float radius
#pragma mapbox: define lowp float blur
#pragma mapbox: define lowp float opacity
#pragma mapbox: define highp vec4 stroke_color
#pragma mapbox: define mediump float stroke_width
#pragma mapbox: define lowp float stroke_opacity

vec2 calc_offset(vec2 extrusion, float radius, float stroke_width,  float view_scale) {
    return extrusion * (radius + stroke_width) * u_extrude_scale * view_scale;
}

float cantilevered_elevation(vec2 pos, float radius, float stroke_width, float view_scale) {
    vec2 c1 = pos + calc_offset(vec2(-1,-1), radius, stroke_width, view_scale);
    vec2 c2 = pos + calc_offset(vec2(1,-1), radius, stroke_width, view_scale);
    vec2 c3 = pos + calc_offset(vec2(1,1), radius, stroke_width, view_scale);
    vec2 c4 = pos + calc_offset(vec2(-1,1), radius, stroke_width, view_scale);
    float h1 = elevation(c1) + ELEVATION_BIAS;
    float h2 = elevation(c2) + ELEVATION_BIAS;
    float h3 = elevation(c3) + ELEVATION_BIAS;
    float h4 = elevation(c4) + ELEVATION_BIAS;
    return max(h4, max(h3, max(h1,h2)));
}

float circle_elevation(vec2 pos) {
#if defined(TERRAIN)
    return elevation(pos) + ELEVATION_BIAS;
#else
    return 0.0;
#endif
}

vec4 project_vertex(vec2 extrusion, vec4 world_center, vec4 projected_center, float radius, float stroke_width,  float view_scale) {
    vec2 sample_offset = calc_offset(extrusion, radius, stroke_width, view_scale);
#ifdef PITCH_WITH_MAP
    return u_matrix * ( world_center + vec4(sample_offset, 0, 0) );
#else
    return projected_center + vec4(sample_offset, 0, 0);
#endif
}

float get_sample_step() {
#ifdef PITCH_WITH_MAP
    return 2.0 * PI / float(NUM_SAMPLES_PER_RING);
#else
    // We want to only sample the top half of the circle when it is viewport-aligned.
    // This is to prevent the circle from intersecting with the ground plane below it at high pitch.
    return PI / float(NUM_SAMPLES_PER_RING);
#endif
}

void main(void) {
    #pragma mapbox: initialize highp vec4 color
    #pragma mapbox: initialize mediump float radius
    #pragma mapbox: initialize lowp float blur
    #pragma mapbox: initialize lowp float opacity
    #pragma mapbox: initialize highp vec4 stroke_color
    #pragma mapbox: initialize mediump float stroke_width
    #pragma mapbox: initialize lowp float stroke_opacity

    // unencode the extrusion vector that we snuck into the a_pos vector
    vec2 extrude = vec2(mod(a_pos, 2.0) * 2.0 - 1.0);

    // multiply a_pos by 0.5, since we had it * 2 in order to sneak
    // in extrusion data
    vec2 circle_center = floor(a_pos * 0.5);
    // extract height offset for terrain, this returns 0 if terrain is not active
    float height = circle_elevation(circle_center);
    vec4 world_center = vec4(circle_center, height, 1);
    vec4 projected_center = u_matrix * world_center;

    float view_scale = 0.0;
    #ifdef PITCH_WITH_MAP
        #ifdef SCALE_WITH_MAP
            view_scale = 1.0;
        #else
            // Pitching the circle with the map effectively scales it with the map
            // To counteract the effect for pitch-scale: viewport, we rescale the
            // whole circle based on the pitch scaling effect at its central point
            view_scale = projected_center.w / u_camera_to_center_distance;
        #endif
    #else
        #ifdef SCALE_WITH_MAP
            view_scale = u_camera_to_center_distance;
        #else
            view_scale = projected_center.w;
        #endif
    #endif
    gl_Position = project_vertex(extrude, world_center, projected_center, radius, stroke_width, view_scale);

    float visibility = 0.0;
    #ifdef TERRAIN
        float step = get_sample_step();
        #ifdef PITCH_WITH_MAP
            // to prevent the circle from self-intersecting with the terrain underneath on a sloped hill,
            // we calculate the elevation at each corner and pick the highest one when computing visibility.
            float cantilevered_height = cantilevered_elevation(circle_center, radius, stroke_width, view_scale);
            vec4 occlusion_world_center = vec4(circle_center, cantilevered_height, 1);
            vec4 occlusion_projected_center = u_matrix * occlusion_world_center;
        #else
            vec4 occlusion_world_center = world_center;
            vec4 occlusion_projected_center = projected_center;
        #endif
        for(int ring = 0; ring < NUM_VISIBILITY_RINGS; ring++) {
            float scale = (float(ring) + 1.0)/float(NUM_VISIBILITY_RINGS);
            for(int i = 0; i < NUM_SAMPLES_PER_RING; i++) {
                vec2 extrusion = vec2(cos(step * float(i)), -sin(step * float(i))) * scale;
                vec4 frag_pos = project_vertex(extrusion, occlusion_world_center, occlusion_projected_center, radius, stroke_width, view_scale);
                visibility += float(!isOccluded(frag_pos));
            }
        }
        visibility /= float(NUM_VISIBILITY_RINGS) * float(NUM_SAMPLES_PER_RING);
    #else
        visibility = 1.0;
    #endif
    v_visibility = visibility;

    // This is a minimum blur distance that serves as a faux-antialiasing for
    // the circle. since blur is a ratio of the circle's size and the intent is
    // to keep the blur at roughly 1px, the two are inversely related.
    lowp float antialiasblur = 1.0 / u_device_pixel_ratio / (radius + stroke_width);

    v_data = vec3(extrude.x, extrude.y, antialiasblur);

#ifdef FOG
    v_fog_pos = fog_position(world_center.xyz);
#endif
}
