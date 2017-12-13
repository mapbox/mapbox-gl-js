import React from 'react';
import {prefixUrl} from '@mapbox/batfish/modules/prefix-url';
import urls from './urls';
import md from './md';
import PageShell from './page_shell';
import LeftNav from './left_nav';
import TopNav from './top_nav';
import {highlightMarkup} from './prism_highlight';
import supported from '@mapbox/mapbox-gl-supported';
import {copy} from 'execcommand-copy';
import examples from '@mapbox/batfish/data/examples';
import entries from 'object.entries';

const tags = {
    "styles": "Styles",
    "layers": "Layers",
    "sources": "Sources",
    "user-interaction": "User interaction",
    "camera": "Camera",
    "controls-and-overlays": "Controls and overlays",
    "browser-support": "Browser support",
    "internationalization": "Internationalization support"
};

export default function (html) {
    return class extends React.Component {
        constructor(props) {
            super(props);
            this.state = {
                filter: '',
                copied: false,
                token: '<your access token here>'
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

${html.replace("<script>", `<script>\nmapboxgl.accessToken = '${this.state.token}';`)}
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
                <PageShell meta={frontMatter} onUser={(_, token) => this.setState({token})}>
                    <LeftNav>
                        <div className="space-bottom">
                            <input onChange={e => this.setState({filter: e.target.value})}
                                type='text' className='space-bottom' name='filter' placeholder='Filter examples' />
                        </div>
                        {entries(tags).map(([tag, title], i) =>
                            <div key={i} className='space-bottom1'>
                                {!filter && <h3 className='heading'>{title}</h3>}
                                {examples
                                    .filter(({tags, title}) =>
                                        tags.indexOf(tag) !== -1 && title.toLowerCase().indexOf(filter) !== -1)
                                    .map(({pathname, title}, i) =>
                                        <a key={i} href={prefixUrl(pathname)}
                                            className={`block small truncate ${title === frontMatter.title && 'active'}`}>{title}</a>
                                    )}
                            </div>
                        )}
                    </LeftNav>

                    <div className='limiter clearfix'>
                        <TopNav current='examples'/>

                        <div className='contain margin3 col9'>
                            <div className='round doc fill-white keyline-all'>
                                <style>{`
                                    .fill-white pre { background-color:transparent; }
                                `}</style>

                                <div className='prose'>
                                    <div className='pad2'><strong>{frontMatter.title}</strong><br/>{md(frontMatter.description)}</div>

                                    {!supported() &&
                                        <div id='unsupported' className='pad2 hidden dark'>
                                            <div className='note error round pad1'>
                                                <div className='strong space-bottom1 icon alert'>Mapbox GL unsupported</div>
                                                <div className='small strong'>Mapbox GL requires <a href='http://caniuse.com/webgl'>WebGL support</a>. Please check that you are using a supported browser and that WebGL is <a href='http://get.webgl.org/'>enabled</a>.</div>
                                            </div>
                                        </div>}
                                </div>

                                {supported() &&
                                    <iframe id='demo' className='row10 col12' allowFullScreen='true' mozallowfullscreen='true' webkitallowfullscreen='true'
                                        ref={(iframe) => { this.iframe = iframe; }}/>}

                                <div className='fill-white js-replace-token keyline-top'>
                                    <div id='code'>{highlightMarkup(this.displayHTML())}</div>
                                    <a className='button icon clipboard col12 round-bottom' href='#' onClick={(e) => this.copyExample(e)}>
                                        {this.state.copied ? 'Copied to clipboard!' : 'Copy example'}
                                    </a>
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
        }

        copyExample(e) {
            e.preventDefault();
            copy(this.displayHTML());
            analytics.track('Copied example with clipboard');
            this.setState({copied: true});
            setTimeout(() => this.setState({copied: false}), 1000);
        }
    };
}
