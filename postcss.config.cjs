module.exports = {
    plugins: [
        require('postcss-inline-svg'),
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
}
