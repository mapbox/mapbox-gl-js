const webpack = require('webpack');
const path = require('path');

/**
 * Mapbox GL JS example webpack configuration. This demonstrates the options
 * you'll need to add to your existing webpack configuration in order to successfully
 * use Mapbox GL JS.
 *
 * This configuration refers to specific paths, especially in its configuration
 * of the brfs transform. You'll likely need to change these paths so that
 * they point at the correct file in Mapbox GL JS.
 *
 * Additional dependencies:
 *
 *     npm install --save transform-loader
 *     npm install --save json-loader
 *     npm install --save webworkify-webpack
 *
 * Why these dependencies?
 *
 * json-loader
 * By default, browserify and node allow you to use the `require` method
 * with JSON files. Webpack doesn't have this built-in, so we include
 * the json loader.
 *
 * transform-loader
 * Mapbox GL JS uses the brfs browserify transform to allow it to use
 * the fs.readFileSync method in order to load its shaders for WebGL. Adding
 * the transform loader lets webpack use brfs as well.
 *
 * webworkify-webpack
 * Mapbox GL JS uses the webworkify module by default, and that module
 * does things very specific to browserify's module loading system. In this
 * configuration, we alias webworkify to webworkify-webpack to add webpack
 * support.
 */
module.exports = {
    entry: './test.js',
    output: {
        path: './',
        filename: 'test.bundle.js',
    },
    resolve: {
        alias: {
            'webworkify': 'webworkify-webpack'
        }
    },
    module: {
        loaders: [{
            test: /\.json$/,
            loader: 'json-loader'
        }, {
            test: /\.js$/,
            include: path.resolve('node_modules/mapbox-gl-shaders/index.js'),
            loader: 'transform/cacheable?brfs'
        }],
        postLoaders: [{
            include: /node_modules\/mapbox-gl-shaders/,
            loader: 'transform',
            query: 'brfs'
        }]
    },

    // You may use any "devtool" except "eval" and "eval-source-map" due to
    // a "webworkify-webpack" caveat. 
    // See https://github.com/borisirota/webworkify-webpack#caveats
    devtool: 'cheap-source-map'
}
