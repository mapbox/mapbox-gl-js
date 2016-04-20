#ifndef MBGL_SHADER_SHADER_OUTLINEPATTERN
#define MBGL_SHADER_SHADER_OUTLINEPATTERN

#include <mbgl/shader/shader.hpp>
#include <mbgl/shader/uniform.hpp>

namespace mbgl {

class OutlinePatternShader : public Shader {
public:
    OutlinePatternShader(gl::GLObjectStore&);

    void bind(GLbyte *offset) final;

    UniformMatrix<4>                u_matrix          = {"u_matrix",          *this};
    Uniform<std::array<GLfloat, 2>> u_pattern_tl_a    = {"u_pattern_tl_a",    *this};
    Uniform<std::array<GLfloat, 2>> u_pattern_br_a    = {"u_pattern_br_a",    *this};
    Uniform<std::array<GLfloat, 2>> u_pattern_tl_b    = {"u_pattern_tl_b",    *this};
    Uniform<std::array<GLfloat, 2>> u_pattern_br_b    = {"u_pattern_br_b",    *this};
    Uniform<GLfloat>                u_opacity         = {"u_opacity",         *this};
    Uniform<GLfloat>                u_mix             = {"u_mix",             *this};
    Uniform<GLint>                  u_image           = {"u_image",           *this};
    Uniform<std::array<GLfloat, 2>> u_patternscale_a  = {"u_patternscale_a",  *this};
    Uniform<std::array<GLfloat, 2>> u_patternscale_b  = {"u_patternscale_b",  *this};
    Uniform<std::array<GLfloat, 2>> u_offset_a        = {"u_offset_a",        *this};
    Uniform<std::array<GLfloat, 2>> u_offset_b        = {"u_offset_b",        *this};
    Uniform<std::array<GLfloat, 2>> u_world           = {"u_world",           *this};
};

} // namespace mbgl

#endif