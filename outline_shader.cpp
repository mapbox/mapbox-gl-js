#include <mbgl/shader/outline_shader.hpp>
#include <mbgl/shader/shaders.hpp>
#include <mbgl/platform/gl.hpp>

#include <cstdio>

using namespace mbgl;

OutlineShader::OutlineShader()
    : Shader(
        "outline",
        shaders[OUTLINE_SHADER].vertex,
        shaders[OUTLINE_SHADER].fragment
    ) {
    if (!valid) {
        fprintf(stderr, "invalid outline shader\n");
        return;
    }

    a_pos = glGetAttribLocation(program, "a_pos");
}

void OutlineShader::bind(char *offset) {
    glEnableVertexAttribArray(a_pos);
    glVertexAttribPointer(a_pos, 2, GL_SHORT, false, 0, offset);
}
