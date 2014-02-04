module.exports = function(grunt) {
    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        browserify: {
            llmr: {
                files: {
                    'dist/llmr.js': ['js/llmr.js']
                },
                options: {
                    debug: true,
                    standalone: 'llmr'
                }
            },
            editor: {
                files: {
                    'editor/dist/editor.js': ['editor/js/editor.js']
                },
                entry: 'editor/js/editor.js',
                options: {
                    debug: true,
                    standalone: 'editor'
                }
            }
        },
        jshint: {
            llmr: {
                files: {
                    src: ['js/**/*.js', '!js/lib/*.js']
                },
                options: {
                    jshintrc: true
                }
            }
        },
        watch: {
            llmr: {
              files: ['js/**/*.js'],
              tasks: ['jshint:llmr', 'browserify:llmr']
            },
            editor: {
              files: ['editor/js/*.js'],
              tasks: ['browserify:editor']
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

    grunt.registerTask('shaders', require('./bin/build-shaders.js'));

    grunt.registerTask('default', ['shaders', 'browserify']);
};
