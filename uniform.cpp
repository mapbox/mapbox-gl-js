#include <mbgl/shader/uniform.hpp>

namespace mbgl {

template <>
void Uniform<float>::bind(const float& t) {
    MBGL_CHECK_ERROR(glUniform1f(location, t));
}

template <>
void Uniform<int32_t>::bind(const int32_t& t) {
    MBGL_CHECK_ERROR(glUniform1i(location, t));
}

template <>
void Uniform<std::array<float, 2>>::bind(const std::array<float, 2>& t) {
    MBGL_CHECK_ERROR(glUniform2fv(location, 1, t.data()));
}

template <>
void Uniform<std::array<float, 3>>::bind(const std::array<float, 3>& t) {
    MBGL_CHECK_ERROR(glUniform3fv(location, 1, t.data()));
}

template <>
void Uniform<std::array<float, 4>>::bind(const std::array<float, 4>& t) {
    MBGL_CHECK_ERROR(glUniform4fv(location, 1, t.data()));
}

template <>
void UniformMatrix<2>::bind(const std::array<float, 4>& t) {
    MBGL_CHECK_ERROR(glUniformMatrix2fv(location, 1, GL_FALSE, t.data()));
}

template <>
void UniformMatrix<3>::bind(const std::array<float, 9>& t) {
    MBGL_CHECK_ERROR(glUniformMatrix3fv(location, 1, GL_FALSE, t.data()));
}

template <>
void UniformMatrix<4>::bind(const std::array<float, 16>& t) {
    MBGL_CHECK_ERROR(glUniformMatrix4fv(location, 1, GL_FALSE, t.data()));
}

// Add more as needed.

}
