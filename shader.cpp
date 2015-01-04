#include <mbgl/shader/shader.hpp>
#include <mbgl/platform/gl.hpp>
#include <mbgl/util/stopwatch.hpp>
#include <mbgl/platform/log.hpp>
#include <mbgl/platform/platform.hpp>

#include <cstring>
#include <cassert>
#include <iostream>
#include <fstream>
#include <cstdio>

using namespace mbgl;

Shader::Shader(const char *name_, const GLchar *vertSource, const GLchar *fragSource)
    : name(name_),
      valid(false),
      program(0) {
    util::stopwatch stopwatch("shader compilation", Event::Shader);

    program = MBGL_CHECK_ERROR(glCreateProgram());

    if (!mbgl::platform::defaultShaderCache().empty()) {
        binaryFileName = mbgl::platform::defaultShaderCache() + name + ".bin";
    }

    // Load binary shader if it exists
    bool skipCompile = false;
    if (!binaryFileName.empty() && (gl::ProgramBinary != nullptr)) {
        std::ifstream binaryFile(binaryFileName, std::ios::in | std::ios::binary);

        GLsizei binaryLength;
        GLenum binaryFormat;
        binaryFile.read(reinterpret_cast<char *>(&binaryLength), sizeof(binaryLength));
        binaryFile.read(reinterpret_cast<char *>(&binaryFormat), sizeof(binaryFormat));


        GLint numBinaryFormats;
        MBGL_CHECK_ERROR(glGetIntegerv(GL_NUM_PROGRAM_BINARY_FORMATS, &numBinaryFormats));

        std::unique_ptr<GLenum[]> validBinaryFormats = mbgl::util::make_unique<GLenum[]>(numBinaryFormats);
        MBGL_CHECK_ERROR(glGetIntegerv(GL_PROGRAM_BINARY_FORMATS, reinterpret_cast<GLint *>(validBinaryFormats.get())));

        bool validBinaryFormat = false;
        for (GLint i = 0; i < numBinaryFormats; i++) {
            if (validBinaryFormats[i] == binaryFormat) {
                validBinaryFormat = true;
            }
        }
        if (!validBinaryFormat) {
            Log::Error(Event::OpenGL, "Trying load program binary with an invalid binaryFormat!");
        }

        if (binaryLength == 0) {
            Log::Error(Event::OpenGL, "Trying load program binary with a zero length binary!");
        }

        if (validBinaryFormat && (binaryLength != 0)) {

            std::unique_ptr<char[]> binary = mbgl::util::make_unique<char[]>(binaryLength);
            binaryFile.read(binary.get(), binaryLength);
            binaryFile.close();

            Log::Error(Event::OpenGL, "glProgramBinary(%u, %u, %u, %u)", program, binaryFormat, binary.get(), binaryLength);
            MBGL_CHECK_ERROR(gl::ProgramBinary(program, binaryFormat, binary.get(), binaryLength));

            // Check if the binary was valid
            GLint status;
            MBGL_CHECK_ERROR(glGetProgramiv(program, GL_LINK_STATUS, &status));
            if (status == GL_TRUE) {
                skipCompile = true;
            }
        } else {
            binaryFile.close();

            // Delete the bad file
            std::remove(binaryFileName.c_str());
        }
    }

    GLuint vertShader = 0;
    GLuint fragShader = 0;
    if (!skipCompile) {
        if (!compileShader(&vertShader, GL_VERTEX_SHADER, vertSource)) {
            Log::Error(Event::Shader, "Vertex shader %s failed to compile: %s", name, vertSource);
            MBGL_CHECK_ERROR(glDeleteProgram(program));
            program = 0;
            return;
        }

        if (!compileShader(&fragShader, GL_FRAGMENT_SHADER, fragSource)) {
            Log::Error(Event::Shader, "Fragment shader %s failed to compile: %s", name, fragSource);
            MBGL_CHECK_ERROR(glDeleteShader(vertShader));
            vertShader = 0;
            MBGL_CHECK_ERROR(glDeleteProgram(program));
            program = 0;
            return;
        }

        // Attach shaders
        MBGL_CHECK_ERROR(glAttachShader(program, vertShader));
        MBGL_CHECK_ERROR(glAttachShader(program, fragShader));

        {
            if (!binaryFileName.empty() && (gl::ProgramParameteri != nullptr)) {
                MBGL_CHECK_ERROR(gl::ProgramParameteri(program, GL_PROGRAM_BINARY_RETRIEVABLE_HINT, GL_TRUE));
            }

            // Link program
            GLint status;
            MBGL_CHECK_ERROR(glLinkProgram(program));

            MBGL_CHECK_ERROR(glGetProgramiv(program, GL_LINK_STATUS, &status));
            if (status == 0) {
                GLint logLength;
                MBGL_CHECK_ERROR(glGetProgramiv(program, GL_INFO_LOG_LENGTH, &logLength));
                if (logLength > 0) {
                    std::unique_ptr<GLchar[]> log = mbgl::util::make_unique<GLchar[]>(logLength);
                    MBGL_CHECK_ERROR(glGetProgramInfoLog(program, logLength, &logLength, log.get()));
                    Log::Error(Event::Shader, "Program failed to link: %s", log.get());
                }

                MBGL_CHECK_ERROR(glDeleteShader(vertShader));
                vertShader = 0;
                MBGL_CHECK_ERROR(glDeleteShader(fragShader));
                fragShader = 0;
                MBGL_CHECK_ERROR(glDeleteProgram(program));
                program = 0;
                return;
            }
        }
    }

    {
        // Validate program
        GLint status;
        MBGL_CHECK_ERROR(glValidateProgram(program));

        MBGL_CHECK_ERROR(glGetProgramiv(program, GL_VALIDATE_STATUS, &status));
        if (status == 0) {
            GLint logLength;
            MBGL_CHECK_ERROR(glGetProgramiv(program, GL_INFO_LOG_LENGTH, &logLength));
            if (logLength > 0) {
                std::unique_ptr<GLchar[]> log = mbgl::util::make_unique<GLchar[]>(logLength);
                MBGL_CHECK_ERROR(glGetProgramInfoLog(program, logLength, &logLength, log.get()));
                Log::Error(Event::Shader, "Program failed to validate: %s", log.get());
            }

            MBGL_CHECK_ERROR(glDeleteShader(vertShader));
            vertShader = 0;
            MBGL_CHECK_ERROR(glDeleteShader(fragShader));
            fragShader = 0;
            MBGL_CHECK_ERROR(glDeleteProgram(program));
            program = 0;
        }
    }

    if (!skipCompile) {
        // Remove the compiled shaders; they are now part of the program.
        MBGL_CHECK_ERROR(glDetachShader(program, vertShader));
        MBGL_CHECK_ERROR(glDeleteShader(vertShader));
        MBGL_CHECK_ERROR(glDetachShader(program, fragShader));
        MBGL_CHECK_ERROR(glDeleteShader(fragShader));
    }

    valid = true;
}


bool Shader::compileShader(GLuint *shader, GLenum type, const GLchar *source) {
    GLint status;

    *shader = MBGL_CHECK_ERROR(glCreateShader(type));
    const GLchar *strings[] = { source };
    const GLsizei lengths[] = { static_cast<GLsizei>(std::strlen(source)) };
    MBGL_CHECK_ERROR(glShaderSource(*shader, 1, strings, lengths));

    MBGL_CHECK_ERROR(glCompileShader(*shader));

    MBGL_CHECK_ERROR(glGetShaderiv(*shader, GL_COMPILE_STATUS, &status));
    if (status == 0) {
        GLint logLength;
        MBGL_CHECK_ERROR(glGetShaderiv(*shader, GL_INFO_LOG_LENGTH, &logLength));
        if (logLength > 0) {
            std::unique_ptr<GLchar[]> log = mbgl::util::make_unique<GLchar[]>(logLength);
            MBGL_CHECK_ERROR(glGetShaderInfoLog(*shader, logLength, &logLength, log.get()));
            Log::Error(Event::Shader, "Shader failed to compile: %s", log.get());
        }

        MBGL_CHECK_ERROR(glDeleteShader(*shader));
        *shader = 0;
        return false;
    }

    MBGL_CHECK_ERROR(glGetShaderiv(*shader, GL_COMPILE_STATUS, &status));
    if (status == GL_FALSE) {
    Log::Error(Event::Shader, "Shader %s failed to compile.", name, type);
        MBGL_CHECK_ERROR(glDeleteShader(*shader));
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
        MBGL_CHECK_ERROR(glGetProgramiv(program, GL_PROGRAM_BINARY_LENGTH, &binaryLength));
        if (binaryLength > 0) {
            std::unique_ptr<char[]> binary = mbgl::util::make_unique<char[]>(binaryLength);
            MBGL_CHECK_ERROR(gl::GetProgramBinary(program, binaryLength, nullptr, &binaryFormat, binary.get()));

            Log::Error(Event::OpenGL, "glGetProgramBinary(%u, %u, nullptr, %u, %u)", program, binaryLength, binaryFormat, binary.get());

            // Write the binary to a file
            std::ofstream binaryFile(binaryFileName, std::ios::out | std::ios::trunc | std::ios::binary);
            binaryFile.write(reinterpret_cast<char *>(&binaryLength), sizeof(binaryLength));
            binaryFile.write(reinterpret_cast<char *>(&binaryFormat), sizeof(binaryFormat));
            binaryFile.write(binary.get(), binaryLength);
            binaryFile.close();
        }
    }

    if (program) {
        MBGL_CHECK_ERROR(glDeleteProgram(program));
        program = 0;
        valid = false;
    }
}
