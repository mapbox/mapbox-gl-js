/* eslint-disable */
const path = require('path');

module.exports = {
  entry: './index.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.js'
  },
  module: {
    rules: [
    {
        test: /\bmapbox-gl-csp-worker.js\b/i,
        use: {
            loader: "worker-loader" ,
            options: {
                inline: 'no-fallback'
            }
        },
    },
      {
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