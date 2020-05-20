import React from 'react';

if (typeof window !== 'undefined') {
  import(/* webpackChunkName: "assembly-js" */ '@mapbox/mbx-assembly/dist/assembly.js');
}

class ApplicationWrapper extends React.Component {
    render() {
        return this.props.children;
    }
}

export default ApplicationWrapper;
