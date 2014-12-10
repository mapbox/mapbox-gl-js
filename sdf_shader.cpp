#include <mbgl/shader/sdf_shader.hpp>
#include <mbgl/shader/shaders.hpp>
#include <mbgl/platform/gl.hpp>

#include <cstdio>

using namespace mbgl;

SDFShader::SDFShader()
    : Shader(
        "sdf",
        shaders[SDF_SHADER].vertex,
        shaders[SDF_SHADER].fragment
    ) {
    if (!valid) {
        fprintf(stderr, "invalid sdf shader\n");
        return;
    }

    a_pos = MBGL_CHECK_ERROR(glGetAttribLocation(program, "a_pos"));
    a_offset = MBGL_CHECK_ERROR(glGetAttribLocation(program, "a_offset"));
    a_tex = MBGL_CHECK_ERROR(glGetAttribLocation(program, "a_tex"));
    a_angle = MBGL_CHECK_ERROR(glGetAttribLocation(program, "a_angle"));
    a_minzoom = MBGL_CHECK_ERROR(glGetAttribLocation(program, "a_minzoom"));
    a_maxzoom = MBGL_CHECK_ERROR(glGetAttribLocation(program, "a_maxzoom"));
    a_rangeend = MBGL_CHECK_ERROR(glGetAttribLocation(program, "a_rangeend"));
    a_rangestart = MBGL_CHECK_ERROR(glGetAttribLocation(program, "a_rangestart"));
    a_labelminzoom = MBGL_CHECK_ERROR(glGetAttribLocation(program, "a_labelminzoom"));
}

void SDFGlyphShader::bind(char *offset) {
    const int stride = 16;

    MBGL_CHECK_ERROR(glEnableVertexAttribArray(a_pos));
    MBGL_CHECK_ERROR(glVertexAttribPointer(a_pos, 2, GL_SHORT, false, stride, offset + 0));

    MBGL_CHECK_ERROR(glEnableVertexAttribArray(a_offset));
    MBGL_CHECK_ERROR(glVertexAttribPointer(a_offset, 2, GL_SHORT, false, stride, offset + 4));

    MBGL_CHECK_ERROR(glEnableVertexAttribArray(a_labelminzoom));
    MBGL_CHECK_ERROR(glVertexAttribPointer(a_labelminzoom, 1, GL_UNSIGNED_BYTE, false, stride, offset + 8));

    MBGL_CHECK_ERROR(glEnableVertexAttribArray(a_minzoom));
    MBGL_CHECK_ERROR(glVertexAttribPointer(a_minzoom, 1, GL_UNSIGNED_BYTE, false, stride, offset + 9));

    MBGL_CHECK_ERROR(glEnableVertexAttribArray(a_maxzoom));
    MBGL_CHECK_ERROR(glVertexAttribPointer(a_maxzoom, 1, GL_UNSIGNED_BYTE, false, stride, offset + 10));

    MBGL_CHECK_ERROR(glEnableVertexAttribArray(a_angle));
    MBGL_CHECK_ERROR(glVertexAttribPointer(a_angle, 1, GL_UNSIGNED_BYTE, false, stride, offset + 11));

    MBGL_CHECK_ERROR(glEnableVertexAttribArray(a_rangeend));
    MBGL_CHECK_ERROR(glVertexAttribPointer(a_rangeend, 1, GL_UNSIGNED_BYTE, false, stride, offset + 12));

    MBGL_CHECK_ERROR(glEnableVertexAttribArray(a_rangestart));
    MBGL_CHECK_ERROR(glVertexAttribPointer(a_rangestart, 1, GL_UNSIGNED_BYTE, false, stride, offset + 13));

    MBGL_CHECK_ERROR(glEnableVertexAttribArray(a_tex));
    MBGL_CHECK_ERROR(glVertexAttribPointer(a_tex, 2, GL_UNSIGNED_BYTE, false, stride, offset + 14));
}

void SDFIconShader::bind(char *offset) {
    const int stride = 20;

    MBGL_CHECK_ERROR(glEnableVertexAttribArray(a_pos));
    MBGL_CHECK_ERROR(glVertexAttribPointer(a_pos, 2, GL_SHORT, false, stride, offset + 0));

    MBGL_CHECK_ERROR(glEnableVertexAttribArray(a_offset));
    MBGL_CHECK_ERROR(glVertexAttribPointer(a_offset, 2, GL_SHORT, false, stride, offset + 4));

    MBGL_CHECK_ERROR(glEnableVertexAttribArray(a_labelminzoom));
    MBGL_CHECK_ERROR(glVertexAttribPointer(a_labelminzoom, 1, GL_UNSIGNED_BYTE, false, stride, offset + 8));

    MBGL_CHECK_ERROR(glEnableVertexAttribArray(a_minzoom));
    MBGL_CHECK_ERROR(glVertexAttribPointer(a_minzoom, 1, GL_UNSIGNED_BYTE, false, stride, offset + 9));

    MBGL_CHECK_ERROR(glEnableVertexAttribArray(a_maxzoom));
    MBGL_CHECK_ERROR(glVertexAttribPointer(a_maxzoom, 1, GL_UNSIGNED_BYTE, false, stride, offset + 10));

    MBGL_CHECK_ERROR(glEnableVertexAttribArray(a_angle));
    MBGL_CHECK_ERROR(glVertexAttribPointer(a_angle, 1, GL_UNSIGNED_BYTE, false, stride, offset + 11));

    MBGL_CHECK_ERROR(glEnableVertexAttribArray(a_rangeend));
    MBGL_CHECK_ERROR(glVertexAttribPointer(a_rangeend, 1, GL_UNSIGNED_BYTE, false, stride, offset + 12));

    MBGL_CHECK_ERROR(glEnableVertexAttribArray(a_rangestart));
    MBGL_CHECK_ERROR(glVertexAttribPointer(a_rangestart, 1, GL_UNSIGNED_BYTE, false, stride, offset + 13));

    MBGL_CHECK_ERROR(glEnableVertexAttribArray(a_tex));
    MBGL_CHECK_ERROR(glVertexAttribPointer(a_tex, 2, GL_SHORT, false, stride, offset + 16));
}
