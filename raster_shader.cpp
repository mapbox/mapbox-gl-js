#include <mbgl/shader/raster_shader.hpp>
#include <mbgl/shader/shaders.hpp>
#include <mbgl/platform/gl.hpp>

#include <cstdio>

using namespace mbgl;

RasterShader::RasterShader()
    : Shader(
         "raster",
         shaders[RASTER_SHADER].vertex,
         shaders[RASTER_SHADER].fragment
         ) {
    if (!valid) {
#if defined(DEBUG)
        fprintf(stderr, "invalid raster shader\n");
#endif
        return;
    }

    a_pos = CHECK_ERROR(glGetAttribLocation(program, "a_pos"));
}

void RasterShader::bind(char *offset) {
    CHECK_ERROR(glEnableVertexAttribArray(a_pos));
    CHECK_ERROR(glVertexAttribPointer(a_pos, 2, GL_SHORT, false, 0, offset));
}
