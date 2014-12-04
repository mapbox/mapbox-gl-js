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

    a_pos = glGetAttribLocation(program, "a_pos");
    a_extrude = glGetAttribLocation(program, "a_extrude");
    a_linesofar = glGetAttribLocation(program, "a_linesofar");
}

void LinepatternShader::bind(char *offset) {
    glEnableVertexAttribArray(a_pos);
    glVertexAttribPointer(a_pos, 2, GL_SHORT, false, 8, offset + 0);

    glEnableVertexAttribArray(a_extrude);
    glVertexAttribPointer(a_extrude, 2, GL_BYTE, false, 8, offset + 4);

    glEnableVertexAttribArray(a_linesofar);
    glVertexAttribPointer(a_linesofar, 1, GL_SHORT, false, 8, offset + 6);
}
