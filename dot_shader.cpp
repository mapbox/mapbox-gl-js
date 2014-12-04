#include <mbgl/shader/dot_shader.hpp>
#include <mbgl/shader/shaders.hpp>
#include <mbgl/platform/gl.hpp>

#include <cstdio>

using namespace mbgl;

DotShader::DotShader()
: Shader(
         "dot",
         shaders[DOT_SHADER].vertex,
         shaders[DOT_SHADER].fragment
         ) {
    if (!valid) {
        fprintf(stderr, "invalid dot shader\n");
        return;
    }

    a_pos = glGetAttribLocation(program, "a_pos");
}

void DotShader::bind(char *offset) {
    glEnableVertexAttribArray(a_pos);
    glVertexAttribPointer(a_pos, 2, GL_SHORT, false, 8, offset);
}
