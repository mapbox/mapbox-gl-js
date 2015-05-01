#ifndef MBGL_SHADER_UNIFORM
#define MBGL_SHADER_UNIFORM

#include <mbgl/shader/shader.hpp>
#include <mbgl/platform/gl.hpp>

namespace mbgl {

template <typename T>
class Uniform {
public:
    Uniform(const GLchar* name, const Shader& shader) : current() {
         location = MBGL_CHECK_ERROR(glGetUniformLocation(shader.program, name));
    }

    void operator=(const T& t) {
        if (current != t) {
            current = t;
            bind(t);
        }
    }

private:
    void bind(const T&);

    T current;
    GLint location;
};

template <size_t C, size_t R = C>
class UniformMatrix {
public:
    typedef std::array<float, C*R> T;

    UniformMatrix(const GLchar* name, const Shader& shader) : current() {
        location = MBGL_CHECK_ERROR(glGetUniformLocation(shader.program, name));
    }

    void operator=(const T& t) {
        if (current != t) {
            current = t;
            bind(t);
        }
    }

private:
    void bind(const T&);

    T current;
    GLint location;
};

}

#endif
