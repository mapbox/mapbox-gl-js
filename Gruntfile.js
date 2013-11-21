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
            worker: {
                files: {
                    'dist/llmr-worker.js': ['js/worker.js']
                },
                entry: 'js/worker.js',
                options: {
                    debug: true
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
        watch: {
            scripts: {
              files: ['js/*.js', 'editor/js/*.js'],
              tasks: ['browserify']
            },
            shaders: {
                files: ['shaders/*.glsl'],
                tasks: ['shaders']
            }
        }
    });

    grunt.loadNpmTasks('grunt-browserify');
    grunt.loadNpmTasks('grunt-contrib-watch');

    grunt.registerTask('shaders', require('./packaging/build-shaders.js'));

    grunt.registerTask('default', ['shaders', 'browserify']);
};
