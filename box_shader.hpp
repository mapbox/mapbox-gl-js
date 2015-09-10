#ifndef MBGL_SHADER_SHADER_BOX
#define MBGL_SHADER_SHADER_BOX

#include <mbgl/shader/shader.hpp>
#include <mbgl/shader/uniform.hpp>
#include <mbgl/platform/gl.hpp>

namespace mbgl {

class CollisionBoxShader : public Shader {
public:
    CollisionBoxShader();

    void bind(GLbyte *offset) final;

    UniformMatrix<4>              u_matrix      = {"u_matrix",      *this};
    Uniform<float>                u_scale      = {"u_scale",      *this};
    Uniform<float>                u_zoom        = {"u_zoom",        *this};
    Uniform<float>                u_maxzoom        = {"u_maxzoom",        *this};

protected:
    int32_t a_extrude = -1;
    int32_t a_data = -1;
};

}

#endif
