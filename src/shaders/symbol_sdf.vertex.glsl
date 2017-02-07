const float PI = 3.141592653589793;

attribute vec2 a_pos;
attribute vec2 a_offset;
attribute vec2 a_texture_pos;
attribute vec4 a_data;


// matrix is for the vertex position.
uniform mat4 u_matrix;

uniform mediump float u_zoom;
uniform bool u_rotate_with_map;
uniform bool u_pitch_with_map;
uniform mediump float u_pitch;
uniform mediump float u_bearing;
uniform mediump float u_aspect_ratio;
uniform vec2 u_extrude_scale;

uniform vec2 u_texsize;

varying vec2 v_tex;
varying vec2 v_fade_tex;
varying float v_gamma_scale;

void main() {
    vec2 a_tex = a_texture_pos.xy;
    mediump float a_labelminzoom = a_data[0];
    mediump vec2 a_zoom = a_data.pq;
    mediump float a_minzoom = a_zoom[0];
    mediump float a_maxzoom = a_zoom[1];

    // u_zoom is the current zoom level adjusted for the change in font size
    mediump float z = 2.0 - step(a_minzoom, u_zoom) - (1.0 - step(a_maxzoom, u_zoom));

    // pitch-alignment: map
    // rotation-alignment: map | viewport
    if (u_pitch_with_map) {
        lowp float angle = u_rotate_with_map ? (a_data[1] / 256.0 * 2.0 * PI) : u_bearing;
        lowp float asin = sin(angle);
        lowp float acos = cos(angle);
        mat2 RotationMatrix = mat2(acos, asin, -1.0 * asin, acos);
        vec2 offset = RotationMatrix * a_offset;
        vec2 extrude = u_extrude_scale * (offset / 64.0);
        gl_Position = u_matrix * vec4(a_pos + extrude, 0, 1);
        gl_Position.z += z * gl_Position.w;
    // pitch-alignment: viewport
    // rotation-alignment: map
    } else if (u_rotate_with_map) {
        // foreshortening factor to apply on pitched maps
        // as a label goes from horizontal <=> vertical in angle
        // it goes from 0% foreshortening to up to around 70% foreshortening
        lowp float pitchfactor = 1.0 - cos(u_pitch * sin(u_pitch * 0.75));

        lowp float lineangle = a_data[1] / 256.0 * 2.0 * PI;

        // use the lineangle to position points a,b along the line
        // project the points and calculate the label angle in projected space
        // this calculation allows labels to be rendered unskewed on pitched maps
        vec4 a = u_matrix * vec4(a_pos, 0, 1);
        vec4 b = u_matrix * vec4(a_pos + vec2(cos(lineangle),sin(lineangle)), 0, 1);
        lowp float angle = atan((b[1]/b[3] - a[1]/a[3])/u_aspect_ratio, b[0]/b[3] - a[0]/a[3]);
        lowp float asin = sin(angle);
        lowp float acos = cos(angle);
        mat2 RotationMatrix = mat2(acos, -1.0 * asin, asin, acos);

        vec2 offset = RotationMatrix * (vec2((1.0-pitchfactor)+(pitchfactor*cos(angle*2.0)), 1.0) * a_offset);
        vec2 extrude = u_extrude_scale * (offset / 64.0);
        gl_Position = u_matrix * vec4(a_pos, 0, 1) + vec4(extrude, 0, 0);
        gl_Position.z += z * gl_Position.w;
    // pitch-alignment: viewport
    // rotation-alignment: viewport
    } else {
        vec2 extrude = u_extrude_scale * (a_offset / 64.0);
        gl_Position = u_matrix * vec4(a_pos, 0, 1) + vec4(extrude, 0, 0);
    }

    v_gamma_scale = gl_Position.w;

    v_tex = a_tex / u_texsize;
    v_fade_tex = vec2(a_labelminzoom / 255.0, 0.0);
}
