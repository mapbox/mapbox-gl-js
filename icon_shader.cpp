#include <mbgl/shader/icon_shader.hpp>
#include <mbgl/shader/shaders.hpp>
#include <mbgl/platform/gl.hpp>

#include <cstdio>

using namespace mbgl;

IconShader::IconShader()
    : Shader(
         "icon",
         shaders[ICON_SHADER].vertex,
         shaders[ICON_SHADER].fragment
         ) {
    if (!valid) {
        fprintf(stderr, "invalid icon shader\n");
        return;
    }

    a_pos = CHECK_ERROR(glGetAttribLocation(program, "a_pos"));
    a_offset = CHECK_ERROR(glGetAttribLocation(program, "a_offset"));
    a_tex = CHECK_ERROR(glGetAttribLocation(program, "a_tex"));
    a_angle = CHECK_ERROR(glGetAttribLocation(program, "a_angle"));
    a_minzoom = CHECK_ERROR(glGetAttribLocation(program, "a_minzoom"));
    a_maxzoom = CHECK_ERROR(glGetAttribLocation(program, "a_maxzoom"));
    a_rangeend = CHECK_ERROR(glGetAttribLocation(program, "a_rangeend"));
    a_rangestart = CHECK_ERROR(glGetAttribLocation(program, "a_rangestart"));
    a_labelminzoom = CHECK_ERROR(glGetAttribLocation(program, "a_labelminzoom"));
}

void IconShader::bind(char *offset) {
    const int stride = 20;

    CHECK_ERROR(glEnableVertexAttribArray(a_pos));
    CHECK_ERROR(glVertexAttribPointer(a_pos, 2, GL_SHORT, false, stride, offset + 0));

    CHECK_ERROR(glEnableVertexAttribArray(a_offset));
    CHECK_ERROR(glVertexAttribPointer(a_offset, 2, GL_SHORT, false, stride, offset + 4));

    CHECK_ERROR(glEnableVertexAttribArray(a_labelminzoom));
    CHECK_ERROR(glVertexAttribPointer(a_labelminzoom, 1, GL_UNSIGNED_BYTE, false, stride, offset + 8));

    CHECK_ERROR(glEnableVertexAttribArray(a_minzoom));
    CHECK_ERROR(glVertexAttribPointer(a_minzoom, 1, GL_UNSIGNED_BYTE, false, stride, offset + 9));

    CHECK_ERROR(glEnableVertexAttribArray(a_maxzoom));
    CHECK_ERROR(glVertexAttribPointer(a_maxzoom, 1, GL_UNSIGNED_BYTE, false, stride, offset + 10));

    CHECK_ERROR(glEnableVertexAttribArray(a_angle));
    CHECK_ERROR(glVertexAttribPointer(a_angle, 1, GL_UNSIGNED_BYTE, false, stride, offset + 11));

    CHECK_ERROR(glEnableVertexAttribArray(a_rangeend));
    CHECK_ERROR(glVertexAttribPointer(a_rangeend, 1, GL_UNSIGNED_BYTE, false, stride, offset + 12));

    CHECK_ERROR(glEnableVertexAttribArray(a_rangestart));
    CHECK_ERROR(glVertexAttribPointer(a_rangestart, 1, GL_UNSIGNED_BYTE, false, stride, offset + 13));

    CHECK_ERROR(glEnableVertexAttribArray(a_tex));
    CHECK_ERROR(glVertexAttribPointer(a_tex, 2, GL_SHORT, false, stride, offset + 16));
}
