uniform mat4 u_matrix;
uniform float u_skirt_height;

uniform sampler2D u_dem;
uniform vec4 u_dem_unpack;
uniform vec2 u_dem_tl;
uniform float u_dem_scale;
uniform float u_dem_size;

attribute vec2 a_pos;
attribute vec2 a_texture_pos;

varying vec2 v_pos0;

const float skirtOffset = 24575.0;

float processDem(vec2 uvTex) {
    float size = u_dem_size + 2.0;
    float dd = 1.0 / size;

    vec2 pos = u_dem_size * (uvTex * u_dem_scale + u_dem_tl) + 1.0;
    vec2 f = fract(pos);
    pos = (pos - f + 0.5) * dd;

    vec4 dem = vec4(texture2D(u_dem, pos).xyz * 255.0, -1.0);
    float tl = dot(dem, u_dem_unpack);

    vec4 demtr = vec4(texture2D(u_dem, pos + vec2(dd, 0.0)).xyz * 255.0, -1.0);
    float tr = dot(demtr, u_dem_unpack);
    vec4 dembl = vec4(texture2D(u_dem, pos + vec2(0.0, dd)).xyz * 255.0, -1.0);
    float bl = dot(dembl, u_dem_unpack);
    vec4 dembr = vec4(texture2D(u_dem, pos + vec2(dd, dd)).xyz * 255.0, -1.0);
    float br = dot(dembr, u_dem_unpack);

    return mix(mix(tl, tr, f.x), mix(bl, br, f.x), f.y);
}

void main() {
    v_pos0 = a_texture_pos / 8192.0;
    float skirt = float(a_pos.x >= skirtOffset);
    float elevation = processDem(v_pos0) - skirt * u_skirt_height;
    vec2 decodedPos = a_pos - vec2(skirt * skirtOffset, 0.0);
    gl_Position = u_matrix * vec4(decodedPos, elevation, 1.0);
}
