#ifdef RASTER_ARRAY
uniform sampler2D u_image0;
uniform sampler2D u_image1;

const vec4 NODATA = vec4(1);

// Decode raster array data and interpolate linearly using nearest neighbor samples
// Returns: vec2(value, nodata_alpha)
vec4 _raTexLinearCoord(vec2 texCoord, vec2 texResolution, out vec2 fxy) {
    texCoord = texCoord * texResolution - 0.5;
    fxy = fract(texCoord);
    texCoord -= fxy;
    return (texCoord.xxyy + vec2(1.5, 0.5).xyxy) / texResolution.xxyy;
}

vec2 _raTexLinearMix(vec2 fxy, vec4 colorMix, float colorOffset, vec4 t00, vec4 t10, vec4 t01, vec4 t11) {
    // Interpolate as a vec2: 1) the mixed value, and 2) a binary 0/1 mask.
    vec2 c00 = t00 == NODATA ? vec2(0) : vec2(colorOffset + dot(t00, colorMix), 1);
    vec2 c10 = t10 == NODATA ? vec2(0) : vec2(colorOffset + dot(t10, colorMix), 1);
    vec2 c01 = t01 == NODATA ? vec2(0) : vec2(colorOffset + dot(t01, colorMix), 1);
    vec2 c11 = t11 == NODATA ? vec2(0) : vec2(colorOffset + dot(t11, colorMix), 1);
    return mix(mix(c01, c11, fxy.x), mix(c00, c10, fxy.x), fxy.y);
}

// Decode raster array data and interpolate linearly using nearest neighbor samples
// Returns: vec2(value, nodata_alpha)
vec2 raTexture2D_image0_linear(vec2 texCoord, vec2 texResolution, vec4 colorMix, float colorOffset) {
    vec2 fxy;
    vec4 c = _raTexLinearCoord(texCoord, texResolution, fxy);
    return _raTexLinearMix(fxy, colorMix, colorOffset,
         texture(u_image0, c.yz),
         texture(u_image0, c.xz),
         texture(u_image0, c.yw),
         texture(u_image0, c.xw)
    );
}
vec2 raTexture2D_image1_linear(vec2 texCoord, vec2 texResolution, vec4 colorMix, float colorOffset) {
    vec2 fxy;
    vec4 c = _raTexLinearCoord(texCoord, texResolution, fxy);
    return _raTexLinearMix(fxy, colorMix, colorOffset,
         texture(u_image1, c.yz),
         texture(u_image1, c.xz),
         texture(u_image1, c.yw),
         texture(u_image1, c.xw)
    );
}

// Decode raster array data and return nearest neighbor sample
// Returns: vec2(value, nodata_alpha)
vec2 raTexture2D_image0_nearest(vec2 texCoord, vec2 texResolution, vec4 colorMix, float colorOffset) {
    vec4 t = texture(u_image0, texCoord);
    return t == NODATA ? vec2(0) : vec2(colorOffset + dot(t, colorMix), 1);
}
vec2 raTexture2D_image1_nearest(vec2 texCoord, vec2 texResolution, vec4 colorMix, float colorOffset) {
    vec4 t = texture(u_image1, texCoord);
    return t == NODATA ? vec2(0) : vec2(colorOffset + dot(t, colorMix), 1);
}

#endif
