#ifdef FOG

uniform vec2 u_fog_range;
uniform vec3 u_fog_color;
uniform float u_fog_opacity;
uniform float u_fog_sky_blend;

vec3 fogColor() { return u_fog_color; }

#else

vec3 fogColor() { return vec3(0.0); }

#endif