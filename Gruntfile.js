module.exports = function(grunt) {
    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        browserify: {
            files: {
                'dist/llmr.js': ['js/llmr.js']
            },
            options: {
                debug: true,
                standalone: 'llmr'
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
        watch: {
            llmr: {
              files: ['js/**/*.js'],
              tasks: ['jshint', 'browserify']
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

    grunt.registerTask('default', ['shaders', 'jshint', 'browserify']);
};
