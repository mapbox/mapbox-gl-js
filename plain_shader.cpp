#include <mbgl/shader/plain_shader.hpp>
#include <mbgl/shader/shaders.hpp>
#include <mbgl/platform/gl.hpp>

#include <cstdio>

using namespace mbgl;

PlainShader::PlainShader()
    : Shader(
        "plain",
        shaders[PLAIN_SHADER].vertex,
        shaders[PLAIN_SHADER].fragment
    ) {
    if (!valid) {
        fprintf(stderr, "invalid plain shader\n");
        return;
    }

    a_pos = glGetAttribLocation(program, "a_pos");
}

void PlainShader::bind(char *offset) {
    glEnableVertexAttribArray(a_pos);
    glVertexAttribPointer(a_pos, 2, GL_SHORT, false, 0, offset);
}
