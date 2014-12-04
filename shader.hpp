#ifndef MBGL_RENDERER_SHADER
#define MBGL_RENDERER_SHADER

#include <cstdint>
#include <array>
#include <mbgl/util/noncopyable.hpp>

namespace mbgl {

class Shader : private util::noncopyable {
public:
    Shader(const char *name, const char *vertex, const char *fragment);
    ~Shader();
    const char *name;
    bool valid;
    uint32_t program;

    inline uint32_t getID() const {
        return program;
    }

private:
    bool compileShader(uint32_t *shader, uint32_t type, const char *source);
};

}

#endif
