#include <mbgl/shader/shader.hpp>
#include <mbgl/platform/gl.hpp>
#include <mbgl/util/stopwatch.hpp>
#include <mbgl/platform/log.hpp>
#include <mbgl/platform/platform.hpp>

#include <cstring>
#include <cstdlib>
#include <cassert>

using namespace mbgl;

Shader::Shader(const char *name_, const GLchar *vertSource, const GLchar *fragSource)
    : name(name_),
      valid(false),
      program(0) {
    util::stopwatch stopwatch("shader compilation", Event::Shader);

    program = glCreateProgram();

    if (!mbgl::platform::defaultShaderCache().empty()) {
        binaryFileName = mbgl::platform::defaultShaderCache() + name + ".bin";
    }

    // Load binary shader if it exists
    bool skipCompile = false;
    if (!binaryFileName.empty() && (gl::ProgramBinary != nullptr)) {
        FILE *binaryFile = fopen(binaryFileName.c_str(), "rb");
        if (binaryFile != nullptr) {
            GLsizei binaryLength;
            GLenum binaryFormat;
            bool lengthOk = fread(&binaryLength, sizeof(binaryLength), 1, binaryFile) == 1;
            bool formatOk = fread(&binaryFormat, sizeof(binaryFormat), 1, binaryFile) == 1;

            if (lengthOk && formatOk && binaryLength > 0) {
                std::unique_ptr<char[]> binary = mbgl::util::make_unique<char[]>(binaryLength);

                if (binary != nullptr) {
                    bool binaryOk = fread(binary.get(), binaryLength, 1, binaryFile) == 1;

                    if (binaryOk) {
                        gl::ProgramBinary(program, binaryFormat, binary.get(), binaryLength);

                        // Check if the binary was valid
                        GLint status;
                        glGetProgramiv(program, GL_LINK_STATUS, &status);
                        if (status == GL_TRUE) {
                            skipCompile = true;
                        }
                    }
                }
            }

            fclose(binaryFile);
            binaryFile = nullptr;
        }
    }

    GLuint vertShader = 0;
    GLuint fragShader = 0;
    if (!skipCompile) {
        if (!compileShader(&vertShader, GL_VERTEX_SHADER, vertSource)) {
            Log::Error(Event::Shader, "Vertex shader %s failed to compile: %s", name, vertSource);
            glDeleteProgram(program);
            program = 0;
            return;
        }

        if (!compileShader(&fragShader, GL_FRAGMENT_SHADER, fragSource)) {
            Log::Error(Event::Shader, "Fragment shader %s failed to compile: %s", name, fragSource);
            glDeleteShader(vertShader);
            vertShader = 0;
            glDeleteProgram(program);
            program = 0;
            return;
        }

        // Attach shaders
        glAttachShader(program, vertShader);
        glAttachShader(program, fragShader);

        {
            if (!binaryFileName.empty() && (gl::ProgramParameteri != nullptr)) {
                gl::ProgramParameteri(program, GL_PROGRAM_BINARY_RETRIEVABLE_HINT, GL_TRUE);
            }

            // Link program
            GLint status;
            glLinkProgram(program);

            glGetProgramiv(program, GL_LINK_STATUS, &status);
            if (status == 0) {
                GLint logLength;
                glGetProgramiv(program, GL_INFO_LOG_LENGTH, &logLength);
                if (logLength > 0) {
                    std::unique_ptr<GLchar[]> log = mbgl::util::make_unique<GLchar[]>(logLength);
                    glGetProgramInfoLog(program, logLength, &logLength, log.get());
                    Log::Error(Event::Shader, "Program failed to link: %s", log.get());
                }

                glDeleteShader(vertShader);
                vertShader = 0;
                glDeleteShader(fragShader);
                fragShader = 0;
                glDeleteProgram(program);
                program = 0;
                return;
            }
        }
    }

    {
        // Validate program
        GLint status;
        glValidateProgram(program);

        glGetProgramiv(program, GL_VALIDATE_STATUS, &status);
        if (status == 0) {
            GLint logLength;
            glGetProgramiv(program, GL_INFO_LOG_LENGTH, &logLength);
            if (logLength > 0) {
                std::unique_ptr<GLchar[]> log = mbgl::util::make_unique<GLchar[]>(logLength);
                glGetProgramInfoLog(program, logLength, &logLength, log.get());
                Log::Error(Event::Shader, "Program failed to validate: %s", log.get());
            }

            glDeleteShader(vertShader);
            vertShader = 0;
            glDeleteShader(fragShader);
            fragShader = 0;
            glDeleteProgram(program);
            program = 0;
        }
    }

    if (!skipCompile) {
        // Remove the compiled shaders; they are now part of the program.
        glDetachShader(program, vertShader);
        glDeleteShader(vertShader);
        glDetachShader(program, fragShader);
        glDeleteShader(fragShader);
    }

    valid = true;
}


bool Shader::compileShader(GLuint *shader, GLenum type, const GLchar *source) {
    GLint status;

    *shader = glCreateShader(type);
    const GLchar *strings[] = { source };
    const GLsizei lengths[] = { (GLsizei)strlen(source) };
    glShaderSource(*shader, 1, strings, lengths);

    glCompileShader(*shader);

    glGetShaderiv(*shader, GL_COMPILE_STATUS, &status);
    if (status == 0) {
        GLint logLength;
        glGetShaderiv(*shader, GL_INFO_LOG_LENGTH, &logLength);
        if (logLength > 0) {
            std::unique_ptr<GLchar[]> log = mbgl::util::make_unique<GLchar[]>(logLength);
            glGetShaderInfoLog(*shader, logLength, &logLength, log.get());
            Log::Error(Event::Shader, "Shader failed to compile: %s", log.get());
        }

        glDeleteShader(*shader);
        *shader = 0;
        return false;
    }

    glGetShaderiv(*shader, GL_COMPILE_STATUS, &status);
    if (status == GL_FALSE) {
    Log::Error(Event::Shader, "Shader %s failed to compile.", name, type);
        glDeleteShader(*shader);
        *shader = 0;
        return false;
    }

    return true;
}

Shader::~Shader() {
    if (!binaryFileName.empty() && (gl::GetProgramBinary != nullptr)) {
        // Retrieve the program binary
        GLsizei binaryLength;
        GLenum binaryFormat;
        glGetProgramiv(program, GL_PROGRAM_BINARY_LENGTH, &binaryLength);
        if (binaryLength > 0) {
            std::unique_ptr<char[]> binary = mbgl::util::make_unique<char[]>(binaryLength);
            if (binary != nullptr) {
                gl::GetProgramBinary(program, binaryLength, NULL, &binaryFormat, binary.get());

                // Write the binary to a file
                FILE *binaryFile = fopen(binaryFileName.c_str(), "wb");
                if (binaryFile != nullptr) {
                    fwrite(&binaryLength, sizeof(binaryLength), 1, binaryFile);
                    fwrite(&binaryFormat, sizeof(binaryFormat), 1, binaryFile);
                    fwrite(binary.get(), binaryLength, 1, binaryFile);
                    fclose(binaryFile);
                    binaryFile = nullptr;
                }
            }
        }
    }

    if (program) {
        glDeleteProgram(program);
        program = 0;
        valid = false;
    }
}
