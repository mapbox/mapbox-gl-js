import React from 'react';
import Helmet from 'react-helmet';
import ReactPageShell from '../../vendor/dotcom-page-shell/react-page-shell.js';

class PageShell extends React.Component {
    componentDidMount() {
        // initialize analytics
        if (window && window.initializeMapboxAnalytics) {
            window.initializeMapboxAnalytics();
        }
    }

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
