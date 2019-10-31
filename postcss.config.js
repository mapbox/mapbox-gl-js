module.exports = {
    plugins: [
        require('postcss-inline-svg'),
        require('cssnano')({
            preset: ['default', {
                svgo: {
                    plugins: [{
                        removeViewBox: false
                    }, {
                        removeDimensions: false
                    }],
                },
            }],
        }),
    ]
}
