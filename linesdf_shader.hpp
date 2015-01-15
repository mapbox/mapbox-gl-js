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
    Uniform<std::array<float, 2>>  u_patternscale = { "u_patternscale", *this };
    Uniform<float>                 u_tex_y     = {"u_tex_y",     *this};
    Uniform<int32_t>               u_image     = {"u_image",     *this};
    Uniform<float>                 u_sdfgamma  = {"u_sdfgamma",  *this};

private:
    int32_t a_pos = -1;
    int32_t a_data = -1;
};


}

#endif
