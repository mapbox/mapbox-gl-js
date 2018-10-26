const webpack = require('webpack');

module.exports = () => {
    const config = {
        siteBasePath: '/mapbox-gl-js',
        siteOrigin: 'https://www.mapbox.com',
        pagesDirectory: `${__dirname}/docs/pages`,
        stylesheets: [
            `${__dirname}/docs/components/site.css`,
            `${__dirname}/docs/components/prism_highlight.css`,
            `${__dirname}/vendor/dotcom-page-shell/page-shell-styles.css`
        ],
        applicationWrapperPath: `${__dirname}/docs/components/application-wrapper.js`,
        webpackLoaders: [
            // Use raw loader to get the HTML string contents of examples
            {
                test: /\.html$/,
                use: 'raw-loader'
            }
        ],
        ignoreWithinPagesDirectory: ['example/*.html'],
        webpackPlugins: [
            // Make environment variables available within JS that Webpack compiles.
            new webpack.DefinePlugin({
                // DEPLOY_ENV is used in config to pick between local/production.
                'process.env.DEPLOY_ENV': `"${process.env.DEPLOY_ENV}"`
            })
        ],
        inlineJs: [
            {
                filename: `${__dirname}/vendor/dotcom-page-shell/page-shell-script.js`
            }
        ],
        dataSelectors: {
            examples: ({pages}) => {
                return pages
                    .filter(({path, frontMatter}) => /\/example\//.test(path) && frontMatter.tags)
                    .map(({frontMatter}) => frontMatter);
            }
        },
        devBrowserslist: false
    };

    // Local builds treat the `dist` directory as static assets, allowing you to test examples against the
    // local branch build. Non-local builds ignore the `dist` directory, and examples load assets from the CDN.
    config.unprocessedPageFiles = ['**/dist/**/*.*'];
    if (process.env.DEPLOY_ENV !== 'local') {
        config.ignoreWithinPagesDirectory.push('**/dist/**/*.*');
    }

    return config;
};
