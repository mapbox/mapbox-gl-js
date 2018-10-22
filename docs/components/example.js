import React from 'react';
import {prefixUrl} from '@mapbox/batfish/modules/prefix-url';
import urls from './urls';
import md from './md';
import PageShell from './page_shell';
import LeftNav from './left_nav';
import TopNav from './top_nav';
// import {highlightMarkup} from './prism_highlight';
import Prism from 'prismjs';
import supported from '@mapbox/mapbox-gl-supported';
import {copy} from 'execcommand-copy';
import examples from '@mapbox/batfish/data/examples'; // eslint-disable-line import/no-unresolved
import entries from 'object.entries';
import Icon from '@mapbox/mr-ui/icon';
import CodeSnippet from '@mapbox/mr-ui/code-snippet';

const highlightTheme = require('raw-loader!./prism_highlight.css');

const tags = {
    "styles": "Styles",
    "layers": "Layers",
    "sources": "Sources",
    "user-interaction": "User interaction",
    "camera": "Camera",
    "controls-and-overlays": "Controls and overlays",
    "geocoder": "Geocoder",
    "browser-support": "Browser support",
    "internationalization": "Internationalization support"
};

export default function (html) {
    return class extends React.Component {
        constructor(props) {
            super(props);
            this.state = {
                filter: '',
                token: undefined
            };
        }

        // Display HTML with production URLs and the logged-in user's access token (if available).
        // Render HTML with possibly-local URLs and a Mapbox access token (don't bill the user for looking at examples).

        displayHTML() {
            return `<!DOCTYPE html>
<html>
<head>
    <meta charset='utf-8' />
    <title>${this.props.frontMatter.title}</title>
    <meta name='viewport' content='initial-scale=1,maximum-scale=1,user-scalable=no' />
    <script src='${urls.js()}'></script>
    <link href='${urls.css()}' rel='stylesheet' />
    <style>
        body { margin:0; padding:0; }
        #map { position:absolute; top:0; bottom:0; width:100%; }
    </style>
</head>
<body>

${html.replace("<script>", `<script>\nmapboxgl.accessToken = '${this.state.token || '<your access token here>'}';`)}
</body>
</html>`;
        }

        renderHTML() {
            return `<!DOCTYPE html>
<html>
<head>
    <meta charset=utf-8 />
    <title>${this.props.frontMatter.title}</title>
    <meta name='viewport' content='initial-scale=1,maximum-scale=1,user-scalable=no' />
    <script src='${urls.js({local: true})}'></script>
    <link href='${urls.css({local: true})}' rel='stylesheet' />
    <style>
        body { margin:0; padding:0; }
        #map { position:absolute; top:0; bottom:0; width:100%; }
    </style>
    <script>mapboxgl.accessToken = '${MapboxPageShell.getMapboxAccessToken()}'</script>
</head>
<body>
${html}
</body>
</html>`;
        }

        render() {
            const {frontMatter} = this.props;
            const filter = this.state.filter.toLowerCase().trim();
            return (
                <PageShell meta={frontMatter}>
                    <div className='contain'>
                        <div className='round doc bg-white'>
                            <div className='prose'>
                                <h1 className='pt12'><strong>{frontMatter.title}</strong></h1>
                                <div className='mb36'>{md(frontMatter.description)}</div>

                                {!supported() &&
                                    <div id='unsupported' className='px12 py12 hidden dark'>
                                        <div className='note error round pad1'>
                                            <div className='txt-bold mb6'><Icon name="alert" inline={true} />Mapbox GL unsupported</div>
                                            <div className='txt-s txt-bold'>Mapbox GL requires <a href='http://caniuse.com/webgl'>WebGL support</a>. Please check that you are using a supported browser and that WebGL is <a href='http://get.webgl.org/'>enabled</a>.</div>
                                        </div>
                                    </div>}
                            </div>

                            {supported() &&
                                <iframe id='demo' style={{ height: 400 }} className='w-full' allowFullScreen='true' mozallowfullscreen='true' webkitallowfullscreen='true'
                                    ref={(iframe) => { this.iframe = iframe; }}/>}

                            <div className='bg-white'>
                                <div id='code'>
                                    <CodeSnippet
                                        code={this.displayHTML()}
                                        highlightedCode={Prism.highlight(this.displayHTML(), Prism.languages['markup'])}
                                        highlightThemeCss={highlightTheme}
                                        onCopy={() => { analytics.track('Copied example with clipboard') }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </PageShell>
            );
        }

        componentDidMount() {
            if (!this.iframe) return;
            const doc = this.iframe.contentWindow.document;
            doc.open();
            doc.write(this.renderHTML());
            doc.close();

            MapboxPageShell.afterUserCheck(() => {
                this.setState({token: MapboxPageShell.getUserPublicAccessToken()});
            });
        }

    };
}
