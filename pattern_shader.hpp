#ifndef MBGL_SHADER_SHADER_PATTERN
#define MBGL_SHADER_SHADER_PATTERN

#include <mbgl/shader/shader.hpp>
#include <mbgl/shader/uniform.hpp>

namespace mbgl {

class PatternShader : public Shader {
public:
    PatternShader();

    void bind(char *offset);

    UniformMatrix<4>              u_matrix        = {"u_matrix",        *this};
    Uniform<std::array<float, 2>> u_pattern_tl    = {"u_pattern_tl",    *this};
    Uniform<std::array<float, 2>> u_pattern_br    = {"u_pattern_br",    *this};
    Uniform<float>                u_opacity       = {"u_opacity",       *this};
    Uniform<float>                u_mix           = {"u_mix",           *this};
    Uniform<int32_t>              u_image         = {"u_image",         *this};
    UniformMatrix<3>              u_patternmatrix = {"u_patternmatrix", *this};

private:
    int32_t a_pos = -1;
};

}

#endif
