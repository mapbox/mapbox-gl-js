import React from 'react';
import {copy} from 'execcommand-copy';
import CopyButton from '@mapbox/mr-ui/copy-button';


export default class extends React.Component {

    render() {
        return (
            <div className='mb18 relative'>
                <a style={{position: 'absolute', right: '10px', top: '10px'}}
                    href='#' onClick={e => this.copy(e)}><CopyButton block={true} /></a>
                <div ref={(ref) => { this.ref = ref; }}>{this.props.children}</div>
            </div>
        );
    }

    copy(e) {
        e.preventDefault();
        copy(this.ref.innerText);
        analytics.track('Copied example with clipboard');
        setTimeout(() => this.setState({copied: false}), 1000);
    }
}
