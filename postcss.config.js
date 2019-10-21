/* eslint-disable flowtype/require-valid-file-annotation */
/* eslint-disable import/no-commonjs */
module.exports = {
    plugins: [
        require('postcss-nested'),
        require('autoprefixer')({
            overrideBrowserslist: [ 'defaults', 'IE 11' ]
        }),
        require('cssnano')
    ]
};
