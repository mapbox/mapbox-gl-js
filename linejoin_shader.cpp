#include <mbgl/shader/linejoin_shader.hpp>
#include <mbgl/shader/shaders.hpp>
#include <mbgl/platform/gl.hpp>

#include <cstdio>

using namespace mbgl;

LinejoinShader::LinejoinShader()
    : Shader(
        "linejoin",
        shaders[LINEJOIN_SHADER].vertex,
        shaders[LINEJOIN_SHADER].fragment
    ) {
    if (!valid) {
        fprintf(stderr, "invalid line shader\n");
        return;
    }

    a_pos = CHECK_ERROR(glGetAttribLocation(program, "a_pos"));
}

void LinejoinShader::bind(char *offset) {
    CHECK_ERROR(glEnableVertexAttribArray(a_pos));
    // Note: We're referring to the vertices in a line array, which are 8 bytes long!
    CHECK_ERROR(glVertexAttribPointer(a_pos, 2, GL_SHORT, false, 8, offset));
}
