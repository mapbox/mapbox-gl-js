module.exports = function(grunt) {
    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        browserify: {
            dev: {
                src: ['./js/llmr.js'],
                dest: 'dist/llmr-dev.js',
                options: {
                    debug: true
                }
            },
            prod: {
                src: ['./js/llmr.js'],
                dest: 'dist/llmr.js',
                options: {
                    ignore: [
                        './js/render/drawdebug.js',
                        './js/render/drawvertices.js'
                    ]
                }
            }
        },
        jshint: {
            files: {
                src: ['js/**/*.js', '!js/lib/*.js']
            },
            options: {
                jshintrc: true
            }
        },
        uglify: {
            prod: {
                files: {
                    'dist/llmr.js': ['dist/llmr.js']
                },
                options: {
                    compress: {
                        drop_console: true
                    }
                }
            }
        },
        watch: {
            llmr: {
              files: ['js/**/*.js'],
              tasks: ['jshint', 'browserify:dev']
            },
            shaders: {
                files: ['shaders/*.glsl'],
                tasks: ['shaders']
            }
        }
    });

    grunt.loadNpmTasks('grunt-browserify');
    grunt.loadNpmTasks('grunt-contrib-watch');
    grunt.loadNpmTasks('grunt-contrib-jshint');
    grunt.loadNpmTasks('grunt-contrib-uglify');

    grunt.registerTask('shaders', require('./bin/build-shaders.js'));

    grunt.registerTask('default', ['shaders', 'jshint', 'browserify', 'uglify']);
};
