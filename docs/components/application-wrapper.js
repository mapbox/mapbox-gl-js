import React from 'react';

// Disable Raven if this isn't a production build, so we don't send development
// errors to Sentry.
if (process.env.DEPLOY_ENV !== 'production' && typeof window !== 'undefined') {
    window.MapboxPageShell.disableRaven();
}

if (typeof window !== 'undefined') {
    window.MapboxPageShellProduction = true;
}

class ApplicationWrapper extends React.Component {
    render() {
        return this.props.children;
    }
}

export default ApplicationWrapper;
