import React from 'react';
import {copy} from 'execcommand-copy';

export default class extends React.Component {
    constructor(props) {
        super(props);
        this.state = {copied: false};
    }

    render() {
        return (
            <div className='space-bottom1 contain'>
                <a className='icon clipboard' style={{position: 'absolute', right: '10px', bottom: '10px'}}
                    href='#' onClick={(e) => this.copy(e)}>{this.state.copied && 'Copied to clipboard!'}</a>
                <div ref={(ref) => { this.ref = ref; }}>{this.props.children}</div>
            </div>
        );
    }

    copy(e) {
        e.preventDefault();
        copy(this.ref.innerText);
        analytics.track('Copied example with clipboard');
        this.setState({copied: true});
        setTimeout(() => this.setState({copied: false}), 1000);
    }
}
