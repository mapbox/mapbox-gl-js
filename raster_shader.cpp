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
}

void RasterShader::bind(char *offset) {
    MBGL_CHECK_ERROR(glEnableVertexAttribArray(a_pos));
    MBGL_CHECK_ERROR(glVertexAttribPointer(a_pos, 2, GL_SHORT, false, 0, offset));
}
