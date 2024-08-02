// Also declared in data/bucket/fill_extrusion_bucket.js
#define ELEVATION_SCALE 7.0
#define ELEVATION_OFFSET 450.0

#ifdef PROJECTION_GLOBE_VIEW
    uniform vec3 u_tile_tl_up;
    uniform vec3 u_tile_tr_up;
    uniform vec3 u_tile_br_up;
    uniform vec3 u_tile_bl_up;
    uniform float u_tile_up_scale;
    vec3 elevationVector(vec2 pos) {
        vec2 uv = pos / EXTENT;
        vec3 up = normalize(mix(
            mix(u_tile_tl_up, u_tile_tr_up, uv.xxx),
            mix(u_tile_bl_up, u_tile_br_up, uv.xxx),
            uv.yyy));
        return up * u_tile_up_scale;
    }
#else // PROJECTION_GLOBE_VIEW
    vec3 elevationVector(vec2 pos) { return vec3(0, 0, 1); }
#endif // PROJECTION_GLOBE_VIEW

#ifdef TERRAIN

    uniform highp sampler2D u_dem;
    uniform highp sampler2D u_dem_prev;

    uniform vec2 u_dem_tl;
    uniform vec2 u_dem_tl_prev;
    uniform float u_dem_scale;
    uniform float u_dem_scale_prev;
    uniform float u_dem_size; // Texture size without 1px border padding
    uniform float u_dem_lerp;
    uniform float u_exaggeration;
    uniform float u_meter_to_dem;
    uniform mat4 u_label_plane_matrix_inv;

    vec4 tileUvToDemSample(vec2 uv, float dem_size, float dem_scale, vec2 dem_tl) {
        vec2 pos = dem_size * (uv * dem_scale + dem_tl) + 1.0;
        vec2 f = fract(pos);
        return vec4((pos - f + 0.5) / (dem_size + 2.0), f);
    }

    float currentElevation(vec2 apos) {
        #ifdef TERRAIN_DEM_FLOAT_FORMAT
            vec2 pos = (u_dem_size * (apos / 8192.0 * u_dem_scale + u_dem_tl) + 1.5) / (u_dem_size + 2.0);
            return u_exaggeration * texture(u_dem, pos).r;
        #else // TERRAIN_DEM_FLOAT_FORMAT
            float dd = 1.0 / (u_dem_size + 2.0);
            vec4 r = tileUvToDemSample(apos / 8192.0, u_dem_size, u_dem_scale, u_dem_tl);
            vec2 pos = r.xy;
            vec2 f = r.zw;

            float tl = texture(u_dem, pos).r;
            float tr = texture(u_dem, pos + vec2(dd, 0)).r;
            float bl = texture(u_dem, pos + vec2(0, dd)).r;
            float br = texture(u_dem, pos + vec2(dd, dd)).r;

            return u_exaggeration * mix(mix(tl, tr, f.x), mix(bl, br, f.x), f.y);
        #endif // TERRAIN_DEM_FLOAT_FORMAT
    }

    float prevElevation(vec2 apos) {
        #ifdef TERRAIN_DEM_FLOAT_FORMAT
            vec2 pos = (u_dem_size * (apos / 8192.0 * u_dem_scale_prev + u_dem_tl_prev) + 1.5) / (u_dem_size + 2.0);
            return u_exaggeration * texture(u_dem_prev, pos).r;
        #else // TERRAIN_DEM_FLOAT_FORMAT
            float dd = 1.0 / (u_dem_size + 2.0);
            vec4 r = tileUvToDemSample(apos / 8192.0, u_dem_size, u_dem_scale_prev, u_dem_tl_prev);
            vec2 pos = r.xy;
            vec2 f = r.zw;

            float tl = texture(u_dem_prev, pos).r;
            float tr = texture(u_dem_prev, pos + vec2(dd, 0)).r;
            float bl = texture(u_dem_prev, pos + vec2(0, dd)).r;
            float br = texture(u_dem_prev, pos + vec2(dd, dd)).r;

            return u_exaggeration * mix(mix(tl, tr, f.x), mix(bl, br, f.x), f.y);
        #endif // TERRAIN_DEM_FLOAT_FORMAT
    }

    #ifdef TERRAIN_VERTEX_MORPHING
        float elevation(vec2 apos) {
            #ifdef ZERO_EXAGGERATION
                return 0.0;
            #endif // ZERO_EXAGGERATION
            float nextElevation = currentElevation(apos);
            float prevElevation = prevElevation(apos);
            return mix(prevElevation, nextElevation, u_dem_lerp);
        }
    #else // TERRAIN_VERTEX_MORPHING
        float elevation(vec2 apos) {
            #ifdef ZERO_EXAGGERATION
                return 0.0;
            #endif // ZERO_EXAGGERATION
            return currentElevation(apos);
        }
    #endif // TERRAIN_VERTEX_MORPHING

    // BEGIN: code for fill-extrusion height offseting
    // When making changes here please also update associated JS ports in src/style/style_layer/fill-extrusion-style-layer.js
    // This is so that rendering changes are reflected on CPU side for feature querying.

    vec4 fourSample(vec2 pos, vec2 off) {
        float tl = texture(u_dem, pos).r;
        float tr = texture(u_dem, pos + vec2(off.x, 0.0)).r;
        float bl = texture(u_dem, pos + vec2(0.0, off.y)).r;
        float br = texture(u_dem, pos + off).r;
        return vec4(tl, tr, bl, br);
    }

    float flatElevation(vec2 pack) {
        vec2 apos = floor(pack / 8.0);
        vec2 span = 10.0 * (pack - apos * 8.0);

        vec2 uvTex = (apos - vec2(1.0, 1.0)) / 8190.0;
        float size = u_dem_size + 2.0;
        float dd = 1.0 / size;

        vec2 pos = u_dem_size * (uvTex * u_dem_scale + u_dem_tl) + 1.0;
        vec2 f = fract(pos);
        pos = (pos - f + 0.5) * dd;

        // Get elevation of centroid.
        vec4 h = fourSample(pos, vec2(dd));
        float z = mix(mix(h.x, h.y, f.x), mix(h.z, h.w, f.x), f.y);

        vec2 w = floor(0.5 * (span * u_meter_to_dem - 1.0));
        vec2 d = dd * w;

        // Get building wide sample, to get better slope estimate.
        h = fourSample(pos - d, 2.0 * d + vec2(dd));

        vec4 diff = abs(h.xzxy - h.ywzw);
        vec2 slope = min(vec2(0.25), u_meter_to_dem * 0.5 * (diff.xz + diff.yw) / (2.0 * w + vec2(1.0)));
        vec2 fix = slope * span;
        float base = z + max(fix.x, fix.y);
        return u_exaggeration * base;
    }

    float elevationFromUint16(float word) {
        return u_exaggeration * (word / ELEVATION_SCALE - ELEVATION_OFFSET);
    }

    // END: code for fill-extrusion height offseting

#else // TERRAIN

    float elevation(vec2 pos) { return 0.0; }

#endif

#ifdef DEPTH_OCCLUSION

    uniform highp sampler2D u_depth;
    uniform highp vec2 u_depth_size_inv;
    uniform highp vec2 u_depth_range_unpack;
    uniform highp float u_occluder_half_size;
    uniform highp float u_occlusion_depth_offset;

    #ifdef DEPTH_D24
        float unpack_depth(float depth) {
            return depth * u_depth_range_unpack.x + u_depth_range_unpack.y;
        }

        vec4 unpack_depth4(vec4 depth) {
            return depth * u_depth_range_unpack.x + vec4(u_depth_range_unpack.y);
        }
    #else // DEPTH_D24
        // Unpack depth from RGBA. A piece of code copied in various libraries and WebGL
        // shadow mapping examples.
        // https://aras-p.info/blog/2009/07/30/encoding-floats-to-rgba-the-final/
        highp float unpack_depth_rgba(vec4 rgba_depth)
        {
            const highp vec4 bit_shift = vec4(1.0 / (255.0 * 255.0 * 255.0), 1.0 / (255.0 * 255.0), 1.0 / 255.0, 1.0);
            return dot(rgba_depth, bit_shift) * 2.0 - 1.0;
        }
    #endif // DEPTH_D24


    bool isOccluded(vec4 frag) {
        vec3 coord = frag.xyz / frag.w;

        #ifdef DEPTH_D24
            float depth = unpack_depth(texture(u_depth, (coord.xy + 1.0) * 0.5).r);
        #else // DEPTH_D24
            float depth = unpack_depth_rgba(texture(u_depth, (coord.xy + 1.0) * 0.5));
        #endif // DEPTH_D24

        return coord.z + u_occlusion_depth_offset > depth;
    }

    highp vec4 getCornerDepths(vec2 coord) {
        highp vec3 df = vec3(u_occluder_half_size * u_depth_size_inv, 0.0);
        highp vec2 uv = 0.5 * coord.xy + 0.5;

        #ifdef DEPTH_D24
            highp vec4 depth = vec4(
                texture(u_depth, uv - df.xz).r,
                texture(u_depth, uv + df.xz).r,
                texture(u_depth, uv - df.zy).r,
                texture(u_depth, uv + df.zy).r
            );
            depth = unpack_depth4(depth);
        #else // DEPTH_D24
            highp vec4 depth = vec4(
                unpack_depth_rgba(texture(u_depth, uv - df.xz)),
                unpack_depth_rgba(texture(u_depth, uv + df.xz)),
                unpack_depth_rgba(texture(u_depth, uv - df.zy)),
                unpack_depth_rgba(texture(u_depth, uv + df.zy))
            );
        #endif // DEPTH_D24

        return depth;
    }

    // Used by symbols layer
    highp float occlusionFadeMultiSample(vec4 frag) {
        highp vec3 coord = frag.xyz / frag.w;
        highp vec2 uv = 0.5 * coord.xy + 0.5;

        int NX = 3;
        int NY = 4;

        // Half size offset
        highp vec2 df = u_occluder_half_size * u_depth_size_inv;
        highp vec2 oneStep = 2.0 * u_occluder_half_size * u_depth_size_inv / vec2(NX - 1, NY - 1);

        highp float res = 0.0;

        for (int y = 0; y < NY; ++y) {
            for (int x = 0; x < NX; ++x) {
                #ifdef DEPTH_D24
                    highp float depth = unpack_depth(texture(u_depth, uv - df + vec2(float(x) * oneStep.x, float(y) * oneStep.y)).r);
                #else // DEPTH_24
                    highp float depth = unpack_depth_rgba(texture(u_depth, uv - df + vec2(float(x) * oneStep.x, float(y) * oneStep.y)));
                #endif // DEPTH_24

                res += 1.0 - clamp(300.0 * (coord.z + u_occlusion_depth_offset - depth), 0.0, 1.0);
            }
        }

        res = clamp(2.0 * res / float(NX * NY) - 0.5, 0.0, 1.0);

        return res;
    }

    // Used by circles layer
    highp float occlusionFade(vec4 frag) {
        highp vec3 coord = frag.xyz / frag.w;

        highp vec4 depth = getCornerDepths(coord.xy);

        return dot(vec4(0.25), vec4(1.0) - clamp(300.0 * (vec4(coord.z + u_occlusion_depth_offset) - depth), 0.0, 1.0));
    }

#else // DEPTH_OCCLUSION

    bool isOccluded(vec4 frag) { return false; }
    highp float occlusionFade(vec4 frag) { return 1.0; }
    highp float occlusionFadeMultiSample(vec4 frag) { return 1.0; }

#endif // DEPTH_OCCLUSION

