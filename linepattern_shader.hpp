#ifndef MBGL_SHADER_SHADER_LINEPATTERN
#define MBGL_SHADER_SHADER_LINEPATTERN

#include <mbgl/shader/shader.hpp>
#include <mbgl/shader/uniform.hpp>

namespace mbgl {

class LinepatternShader : public Shader {
public:
    LinepatternShader();

    void bind(char *offset);

    UniformMatrix<4>              u_matrix       = {"u_matrix",       *this};
    UniformMatrix<4>              u_exmatrix     = {"u_exmatrix",     *this};
    Uniform<std::array<float, 2>> u_linewidth    = {"u_linewidth",    *this};
    Uniform<std::array<float, 2>> u_pattern_size = {"u_pattern_size", *this};
    Uniform<std::array<float, 2>> u_pattern_tl   = {"u_pattern_tl",   *this};
    Uniform<std::array<float, 2>> u_pattern_br   = {"u_pattern_br",   *this};
    Uniform<float>                u_ratio        = {"u_ratio",        *this};
    Uniform<float>                u_point        = {"u_point",        *this};
    Uniform<float>                u_blur         = {"u_blur",         *this};
    Uniform<float>                u_fade         = {"u_fade",         *this};

private:
    int32_t a_pos = -1;
    int32_t a_data = -1;
};
}

#endif
