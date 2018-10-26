import React from 'react';
import Helmet from 'react-helmet';
import ReactPageShell from '../../vendor/dotcom-page-shell/react-page-shell.js';

// initialize analytics
if (typeof window !== 'undefined' && window.initializeMapboxAnalytics) {
    const isProduction = /\.?mapbox\.com/.test(window.location.hostname);

    let sentryInit = {};
    if (isProduction) {
        sentryInit = { sentryDsn: 'https://581913e6cd0845d785f5b551a4986b61@sentry.io/11290' };
    } else {
        sentryInit = false;
    }
    window.initializeMapboxAnalytics({
        sentry: sentryInit
    });
}

class PageShell extends React.Component {

    render() {
        return (
            <ReactPageShell darkHeaderText={true} includeFooter={false} {...this.props}>
                <Helmet>
                    <link href='https://www.mapbox.com/base/latest/base.css?v1.0' rel='stylesheet'/>
                    <link href='https://www.mapbox.com/css/docs.css' rel='stylesheet'/>
                </Helmet>
                <div className="shell-header-buffer" />
                <div className='static-header-page'>
                    {this.props.children}
                </div>
            </ReactPageShell>
        );
    }
}

export default PageShell;
