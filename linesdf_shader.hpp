#ifndef MBGL_SHADER_SHADER_LINESDF
#define MBGL_SHADER_SHADER_LINESDF

#include <mbgl/shader/shader.hpp>
#include <mbgl/shader/uniform.hpp>

namespace mbgl {

class LineSDFShader : public Shader {
public:
    LineSDFShader();

    void bind(char *offset);

    UniformMatrix<4>               u_matrix    = {"u_matrix",    *this};
    UniformMatrix<4>               u_exmatrix  = {"u_exmatrix",  *this};
    Uniform<std::array<float, 4>>  u_color     = {"u_color",     *this};
    Uniform<std::array<float, 2>>  u_linewidth = {"u_linewidth", *this};
    Uniform<float>                 u_ratio     = {"u_ratio",     *this};
    Uniform<float>                 u_blur      = {"u_blur",      *this};
    Uniform<std::array<float, 2>>  u_patternscale_a = { "u_patternscale_a", *this };
    Uniform<float>                 u_tex_y_a   = {"u_tex_y_a",     *this};
    Uniform<std::array<float, 2>>  u_patternscale_b = { "u_patternscale_b", *this };
    Uniform<float>                 u_tex_y_b   = {"u_tex_y_b",     *this};
    Uniform<int32_t>               u_image     = {"u_image",     *this};
    Uniform<float>                 u_sdfgamma  = {"u_sdfgamma",  *this};
    Uniform<float>                 u_mix       = {"u_mix",       *this};

private:
    int32_t a_pos = -1;
    int32_t a_data = -1;
};


}

#endif
