import React from 'react';

if (typeof window !== 'undefined') {
    window.MapboxPageShellProduction = true;
}

class ApplicationWrapper extends React.Component {
    render() {
        return this.props.children;
    }
}

export default ApplicationWrapper;
