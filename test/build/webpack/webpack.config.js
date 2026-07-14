/* eslint-disable */
const path = require('path');

module.exports = {
  context: __dirname,
  entry: {
    csp: './csp.js',
    esm: '../scenarios/pmtiles-esm.js',
    umd: '../scenarios/pmtiles-umd.js'
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name]-bundle.js'
  },
  module: {
    rules: [
      {
        test: /\bmapbox-gl-csp-worker.js\b/i,
        use: {
          loader: 'worker-loader',
          options: {
            inline: 'no-fallback'
          }
        }
      },
      {
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env']
          }
        }
      }
    ]
  }
};
