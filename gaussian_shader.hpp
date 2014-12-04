#ifndef MBGL_RENDERER_SHADER_GAUSSIAN
#define MBGL_RENDERER_SHADER_GAUSSIAN

#include <mbgl/shader/shader.hpp>
#include <mbgl/shader/uniform.hpp>

namespace mbgl {

class GaussianShader : public Shader {
public:
    GaussianShader();

    void bind(char *offset);

    UniformMatrix<4>              u_matrix = {"u_matrix", *this};
    Uniform<std::array<float, 2>> u_offset = {"u_offset", *this};
    Uniform<int32_t>              u_image  = {"u_image",  *this};

private:
    int32_t a_pos = -1;
};

}

#endif
