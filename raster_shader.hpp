#ifndef MBGL_RENDERER_SHADER_RASTER
#define MBGL_RENDERER_SHADER_RASTER

#include <mbgl/shader/shader.hpp>
#include <mbgl/shader/uniform.hpp>

namespace mbgl {

class RasterShader : public Shader {
public:
    RasterShader();

    void bind(GLbyte *offset) final;

    UniformMatrix<4>                u_matrix            = {"u_matrix",            *this};
    Uniform<GLint>                  u_image             = {"u_image",             *this};
    Uniform<GLfloat>                u_opacity           = {"u_opacity",           *this};
    Uniform<GLfloat>                u_buffer            = {"u_buffer",            *this};
    Uniform<GLfloat>                u_brightness_low    = {"u_brightness_low",    *this};
    Uniform<GLfloat>                u_brightness_high   = {"u_brightness_high",   *this};
    Uniform<GLfloat>                u_saturation_factor = {"u_saturation_factor", *this};
    Uniform<GLfloat>                u_contrast_factor   = {"u_contrast_factor",   *this};
    Uniform<std::array<GLfloat, 3>> u_spin_weights      = {"u_spin_weights",      *this};
};

}

#endif
