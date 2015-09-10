#ifndef MBGL_RENDERER_SHADER_RASTER
#define MBGL_RENDERER_SHADER_RASTER

#include <mbgl/shader/shader.hpp>
#include <mbgl/shader/uniform.hpp>

namespace mbgl {

class RasterShader : public Shader {
public:
    RasterShader();

    void bind(char *offset);

    UniformMatrix<4>              u_matrix            = {"u_matrix",            *this};
    Uniform<int32_t>              u_image             = {"u_image",             *this};
    Uniform<float>                u_opacity           = {"u_opacity",           *this};
    Uniform<float>                u_buffer            = {"u_buffer",            *this};
    Uniform<float>                u_brightness_low    = {"u_brightness_low",    *this};
    Uniform<float>                u_brightness_high   = {"u_brightness_high",   *this};
    Uniform<float>                u_saturation_factor = {"u_saturation_factor", *this};
    Uniform<float>                u_contrast_factor   = {"u_contrast_factor",   *this};
    Uniform<std::array<float, 3>> u_spin_weights      = {"u_spin_weights",      *this};
};

}

#endif
