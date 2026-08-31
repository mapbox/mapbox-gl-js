import cssnano from 'cssnano';
import inlineSvg from 'postcss-inline-svg';

export default {
    plugins: [
        inlineSvg,
        cssnano({
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
