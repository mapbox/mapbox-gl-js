import React from 'react';
import CodeSnippet from '@mapbox/mr-ui/code-snippet';
import Prism from 'prismjs';
const highlightTheme = require('raw-loader!@mapbox/dr-ui/css/prism.css'); // eslint-disable-line import/no-commonjs


export default class extends React.Component {

    render() {
        return (
            <div className='mb18'>
                <CodeSnippet
                    code={this.props.children}
                    onCopy={() => { analytics.track('Copied example with clipboard'); }}
                    highlightedCode={Prism.highlight(this.props.children, Prism.languages[this.props.lang])}
                    highlightThemeCss={highlightTheme}
                />
            </div>
        );
    }
}
