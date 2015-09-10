#ifndef MBGL_SHADER_SDF_SHADER
#define MBGL_SHADER_SDF_SHADER

#include <mbgl/shader/shader.hpp>
#include <mbgl/shader/uniform.hpp>

namespace mbgl {

class SDFShader : public Shader {
public:
    SDFShader();

    UniformMatrix<4>              u_matrix      = {"u_matrix",      *this};
    UniformMatrix<4>              u_exmatrix    = {"u_exmatrix",    *this};
    Uniform<std::array<float, 4>> u_color       = {"u_color",       *this};
    Uniform<std::array<float, 2>> u_texsize     = {"u_texsize",     *this};
    Uniform<float>                u_buffer      = {"u_buffer",      *this};
    Uniform<float>                u_gamma       = {"u_gamma",       *this};
    Uniform<float>                u_zoom        = {"u_zoom",        *this};
    Uniform<float>                u_fadedist    = {"u_fadedist",    *this};
    Uniform<float>                u_minfadezoom = {"u_minfadezoom", *this};
    Uniform<float>                u_maxfadezoom = {"u_maxfadezoom", *this};
    Uniform<float>                u_fadezoom    = {"u_fadezoom",    *this};
    Uniform<int32_t>              u_skewed      = {"u_skewed",      *this};
    Uniform<float>                u_extra       = {"u_extra",       *this};

protected:
    int32_t a_offset = -1;
    int32_t a_data1 = -1;
    int32_t a_data2 = -1;
};

class SDFGlyphShader : public SDFShader {
public:
    void bind(GLbyte *offset) final;
};

class SDFIconShader : public SDFShader {
public:
    void bind(GLbyte *offset) final;
};

}

#endif
