#include <mbgl/shader/linepattern_shader.hpp>
#include <mbgl/shader/shaders.hpp>
#include <mbgl/platform/gl.hpp>
#include <iostream>

#include <cstdio>

using namespace mbgl;

LinepatternShader::LinepatternShader()
    : Shader(
        "linepattern",
         shaders[LINEPATTERN_SHADER].vertex,
         shaders[LINEPATTERN_SHADER].fragment
    ) {
    if (!valid) {
        fprintf(stderr, "invalid line pattern shader\n");
        return;
    }

    a_pos = MBGL_CHECK_ERROR(glGetAttribLocation(program, "a_pos"));
    a_extrude = MBGL_CHECK_ERROR(glGetAttribLocation(program, "a_extrude"));
    a_linesofar = MBGL_CHECK_ERROR(glGetAttribLocation(program, "a_linesofar"));
}

void LinepatternShader::bind(char *offset) {
    MBGL_CHECK_ERROR(glEnableVertexAttribArray(a_pos));
    MBGL_CHECK_ERROR(glVertexAttribPointer(a_pos, 2, GL_SHORT, false, 8, offset + 0));

    MBGL_CHECK_ERROR(glEnableVertexAttribArray(a_extrude));
    MBGL_CHECK_ERROR(glVertexAttribPointer(a_extrude, 2, GL_BYTE, false, 8, offset + 4));

    MBGL_CHECK_ERROR(glEnableVertexAttribArray(a_linesofar));
    MBGL_CHECK_ERROR(glVertexAttribPointer(a_linesofar, 1, GL_SHORT, false, 8, offset + 6));
}
