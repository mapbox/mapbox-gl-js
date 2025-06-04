// eslint-disable-next-line import/no-commonjs
module.exports = {
    plugins: [
        // eslint-disable-next-line import/no-commonjs, @typescript-eslint/no-require-imports
        require('postcss-inline-svg'),
        // eslint-disable-next-line import/no-commonjs, @typescript-eslint/no-require-imports
        require('cssnano')({
            preset: ['default', {
                svgo: {
                    plugins: [{
                        name: 'removeViewBox',
                        active: false
                    }, {
                        name: 'removeDimensions',
                        active: false
                    }],
                },
            }],
        }),
    ]
};
