import React from 'react';
import {prefixUrl} from '@mapbox/batfish/modules/prefix-url';
import urls from './urls';
import {version} from '../../package.json';
import {highlightJavascript, highlightMarkup, highlightShell} from './prism_highlight';
import Copyable from './copyable';

class QuickstartCDN extends React.Component {
    render() {
        return (
            <div id='quickstart-cdn'>
                <p>Include the JavaScript and CSS files in the <code>&lt;head&gt;</code> of your HTML file.</p>
                <Copyable>
                    {highlightMarkup(`
                        <script src='${urls.js()}'></script>
                        <link href='${urls.css()}' rel='stylesheet' />
                    `)}
                </Copyable>

                <p>Include the following code in the <code>&lt;body&gt;</code> of your HTML file.</p>
                <Copyable>
                    {highlightMarkup(`
                        <div id='map' style='width: 400px; height: 300px;'></div>
                        <script>
                        mapboxgl.accessToken = '${this.props.token}';
                        var map = new mapboxgl.Map({
                            container: 'map',
                            style: 'mapbox://styles/mapbox/streets-v9'
                        });
                        </script>
                    `)}
                </Copyable>
            </div>
        );
    }
}

class QuickstartBundler extends React.Component {
    render() {
        return (
            <div id='quickstart-bundler'>
                <p>Install the npm package.</p>
                {highlightShell(`npm install --save mapbox-gl`)}

                <p>Include the CSS file in the <code>&lt;head&gt;</code> of your HTML file.</p>
                <Copyable>
                    {highlightMarkup(`<link href='${urls.css()}' rel='stylesheet' />`)}
                </Copyable>

                <p>Include the following code in the <code>&lt;body&gt;</code> of your HTML file.</p>
                <Copyable>
                    {highlightJavascript(`
                        import mapboxgl from 'mapbox-gl';
                        // or "const mapboxgl = require('mapbox-gl');"

                        mapboxgl.accessToken = '${this.props.token}';
                        const map = new mapboxgl.Map({
                            container: '<your HTML element id>',
                            style: 'mapbox://styles/mapbox/streets-v9'
                        });
                    `)}
                </Copyable>
            </div>
        );
    }
}

export default class extends React.Component {
    constructor() {
        super();
        this.state = {tab: 'cdn'};
    }

    render() {
        return (
            <section className='pad4 contain'>
                <h1 className=''>Mapbox GL JS</h1>
                <div className='pad1y quiet small'>Current version:
                    <span className='round fill-light pad0'><a href='https://github.com/mapbox/mapbox-gl-js/releases'>mapbox-gl.js v{version}</a></span>
                </div>
                <div className='prose space-bottom2'>
                    <p className='space-bottom2 pad1y'>Mapbox GL JS is a JavaScript library that uses WebGL to render interactive maps
                        from <a href='https://www.mapbox.com/help/define-vector-tiles'>vector tiles</a> and <a
                            href={prefixUrl('/style-spec')}>Mapbox styles</a>.
                        It is part of the Mapbox GL ecosystem, which includes <a
                            href='https://www.mapbox.com/mobile/'>Mapbox Mobile</a>, a compatible renderer written in C++ with bindings
                        for desktop and mobile platforms. To see what new features our team is working on, take a look at our <a href={prefixUrl('/roadmap')}>roadmap</a>.</p>

                    <div className='col12 fill-light round pad2 clearfix space-top2'>
                        <div className='space-bottom2 space-left1 space-top1 contain'>
                            <div className='icon inline dark pad0 round fill-green space-bottom1 github space-right1'/>
                            <div className='pin-left pad0x space-left4'>
                                <a className='block line-height15' href='https://github.com/mapbox/mapbox-gl-js'>Project on Github</a>
                                <span className='quiet small'>View source code and contribute</span>
                            </div>
                        </div>
                        <div className='space-bottom2 space-left1 contain'>
                            <div className='icon inline dark pad0 round fill-blue space-bottom1 document space-right1'/>
                            <div className='pin-left pad0x space-left4'>
                                <a className='block line-height15' href='https://www.mapbox.com/help/mapbox-gl-js-fundamentals/'>GL JS
                                    Fundamentals</a>
                                <span className='quiet small'>Essential functions and common patterns</span>
                            </div>
                        </div>
                        <div className='contain space-left1'>
                            <div className='icon inline dark pad0 round fill-red space-bottom1 globe space-right1'/>
                            <div className='pin-left pad0x space-left4'>
                                <a className='block line-height15' href='https://www.mapbox.com/gallery/'>Gallery</a>
                                <span className='quiet small'>Project showcase</span>
                            </div>
                        </div>
                    </div>

                    <h2 className='strong'>Quickstart</h2>
                    <div className='space-bottom1'>To get started, you need to obtain an <a
                        href='https://www.mapbox.com/help/create-api-access-token/'>access token</a> and a <a
                        href='https://www.mapbox.com/help/define-style-url/'>style URL</a>. You can choose from one of our <a
                        href='https://www.mapbox.com/api-documentation/#styles'>professionally designed styles</a> or create
                        your own using <a href="https://www.mapbox.com/studio">Mapbox Studio</a>.
                    </div>

                    <div className='rounded-toggle space-bottom2 inline'>
                        <a onClick={() => this.setState({tab: 'cdn'})}
                            className={this.state.tab === 'cdn' ? 'active' : ''}>Mapbox CDN</a>
                        <a onClick={() => this.setState({tab: 'bundler'})}
                            className={this.state.tab !== 'cdn' ? 'active' : ''}>module bundler</a>
                    </div>

                    {this.state.tab === 'cdn' && <QuickstartCDN token={this.props.token}/>}
                    {this.state.tab !== 'cdn' && <QuickstartBundler token={this.props.token}/>}

                    <div>
                        <h2 className='strong' id='csp-directives'>CSP Directives</h2>

                        <p>As a mitigation for Cross-Site Scripting and other types of web security vulnerabilities, you may use
                            a <a href='https://developer.mozilla.org/en-US/docs/Web/Security/CSP'>Content Security Policy (CSP)</a> to
                            specify security policies for your website. If you do, Mapbox GL JS requires the following CSP
                            directives:</p>
                        <pre><code>{`worker-src blob: ;\nchild-src blob: ;\nimg-src data: blob: ;`}</code></pre>

                        <p>Requesting styles from Mapbox or other services will require additional
                            directives. For Mapbox, you can use this <code>connect-src</code> directive:</p>
                        <pre><code>{`connect-src https://*.tiles.mapbox.com https://api.mapbox.com`}</code></pre>
                    </div>
                </div>
            </section>
        );
    }
}
