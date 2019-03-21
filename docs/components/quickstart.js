import React from 'react';
import urls from './urls';
import Copyable from './copyable';
import ControlToggleSet from '@mapbox/mr-ui/control-toggle-set';

class Quickstart extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            userAccessToken: undefined,
            selectedMethod: 'cdn-select'
        };
    }

    componentDidMount() {
        MapboxPageShell.afterUserCheck(() => {
            this.setState({
                userAccessToken: MapboxPageShell.getUserPublicAccessToken()
            });
        });
    }

    renderCdn() {
        return (
            <div id='quickstart-cdn'>
                <p>Include the JavaScript and CSS files in the <code>&lt;head&gt;</code> of your HTML file.</p>
                <Copyable lang='markup'>{`
<script src='${urls.js()}'></script>
<link href='${urls.css()}' rel='stylesheet' />
`}</Copyable>

                <p>Include the following code in the <code>&lt;body&gt;</code> of your HTML file.</p>
                <Copyable lang='markup'>{`
<div id='map' style='width: 400px; height: 300px;'></div>
<script>
mapboxgl.accessToken = '${this.state.userAccessToken}';
var map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/streets-v9'
});
</script>
`}</Copyable>
            </div>
        );
    }

    renderBundler() {
        return (
            <div id='quickstart-bundler'>
                <p>Install the npm package.</p>
                <Copyable lang='markup'>{`
npm install --save mapbox-gl
`}</Copyable>

                <p>Include the CSS file in the <code>&lt;head&gt;</code> of your HTML file.</p>
                <Copyable lang='markup'>{`
<link href='${urls.css()}' rel='stylesheet' />
`}</Copyable>

                <p>Include the following code in the <code>&lt;body&gt;</code> of your HTML file.</p>
                <Copyable lang='javascript'>{`
import mapboxgl from 'mapbox-gl';
// or "const mapboxgl = require('mapbox-gl');"

mapboxgl.accessToken = '${this.state.userAccessToken}';
const map = new mapboxgl.Map({
    container: '<your HTML element id>',
    style: 'mapbox://styles/mapbox/streets-v9'
});
`}</Copyable>
            </div>
        );
    }

    renderContents(selectedMethod) {
        if (selectedMethod === 'cdn-select') return this.renderCdn();
        if (selectedMethod === 'bundler-select') return this.renderBundler();
    }

    render() {
        return (
            <div>
                <ControlToggleSet
                    id="select-quickstart"
                    themeToggleGroup="bg-blue py3 px3 my12"
                    themeToggle="txt-s py3 toggle--white toggle--active-blue"
                    onChange={
                        (value) => {
                            this.setState({ selectedMethod: value });
                        }
                    }
                    value={this.state.selectedMethod}
                    options={[
                        {
                            label: 'Mapbox CDN',
                            value: 'cdn-select'
                        },
                        {
                            label: 'Module bundler',
                            value: 'bundler-select'
                        }
                    ]}
                />
                {this.renderContents(this.state.selectedMethod)}
            </div>
        );
    }
}

export default Quickstart;
