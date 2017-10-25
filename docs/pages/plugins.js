import React from 'react';
import slug from 'slugg';
import {prefixUrl} from '@mapbox/batfish/modules/prefix-url';
import md from '@mapbox/batfish/modules/md';
import PageShell from '../components/page_shell';
import LeftNav from "../components/left_nav";
import TopNav from "../components/top_nav";
import entries from 'object.entries';

const meta = {
    title: 'Mapbox GL JS Plugins',
    description: '',
    pathname: '/plugins'
};

const plugins = {
    "User Interface Plugins": {
        "mapbox-gl-boundaries": {
            "website": "https://github.com/mapbox/mapbox-gl-boundaries",
            "description": "enables users to show/hide disputed borders"
        },
        "mapbox-gl-compare": {
            "website": "https://github.com/mapbox/mapbox-gl-compare",
            "description": "enables users to compare two maps by swiping left and right",
            "example": "mapbox-gl-compare"
        },
        "mapbox-gl-draw": {
            "website": "https://github.com/mapbox/mapbox-gl-draw",
            "description": "adds support for drawing and editing features on Mapbox GL JS maps",
            "example": "mapbox-gl-draw"
        },
        "mapbox-gl-geocoder": {
            "website": "https://github.com/mapbox/mapbox-gl-geocoder",
            "description": "adds a Geocoder control to Mapbox GL JS",
            "example": "mapbox-gl-geocoder"
        },
        "mapbox-gl-directions": {
            "website": "https://github.com/mapbox/mapbox-gl-directions",
            "description": "adds a control which allows users to plot driving, walking, and cycling directions on the map",
            "example": "mapbox-gl-directions"
        }
    },
    "Map Rendering Plugins": {
        "mapbox-gl-language": {
            "website": "https://github.com/mapbox/mapbox-gl-language/",
            "description": "automatically localizes the map into the user’s language"
        },
        "mapbox-gl-rtl-text": {
            "website": "https://github.com/mapbox/mapbox-gl-rtl-text",
            "description": "adds right-to-left text support to Mapbox GL JS",
            "example": "mapbox-gl-rtl-text"
        },
        "deck.gl": {
            "website": "https://github.com/uber/deck.gl",
            "description": "adds advanced WebGL visualization layers to Mapbox GL JS"
        }
    },
    "Framework Integrations": {
        "echartslayer": {
            "website": "https://github.com/lzxue/echartLayer",
            "description": md`provides an [echarts](https://ecomfe.github.io/echarts/index-en.html) integration for Mapbox GL JS`
        },
        "wtMapbox": {
            "website": "https://github.com/yvanvds/wtMapbox",
            "description": md`provides a [Webtoolkit](https://www.webtoolkit.eu/wt) integration for Mapbox GL JS`
        },
        "react-mapbox-gl": {
            "website": "https://github.com/alex3165/react-mapbox-gl",
            "description": md`provides a [React](https://facebook.github.io/react/) integration for Mapbox GL JS`
        },
        "angular-mapboxgl-directive": {
            "website": "https://github.com/Naimikan/angular-mapboxgl-directive",
            "description": md`provides an [Angular](https://angularjs.org/) directive for Mapbox GL JS`
        }
    },
    "Utility Libraries": {
        "turf": {
            "website": "http://turfjs.org/",
            "description": "provides advanced geospatial analysis tools"
        },
        "mapbox-gl-layer-groups": {
            "website": "https://github.com/mapbox/mapbox-gl-layer-groups",
            "description": "manages layer groups in Mapbox GL JS"
        },
        "simplespec-to-gl-style": {
            "website": "https://github.com/mapbox/simplespec-to-gl-style",
            "description": md`converts GeoJSON styled with [\`simplestyle-spec\`](https://github.com/mapbox/simplestyle-spec/) to a Mapbox GL Style`
        },
        "mapbox-gl-supported": {
            "website": "https://github.com/mapbox/mapbox-gl-supported",
            "description": "determines if the current browser supports Mapbox GL JS",
            "example": "mapbox-gl-supported"
        },
        "mapbox-gl-sync-move": {
            "website": "https://github.com/mapbox/mapbox-gl-sync-move",
            "description": "syncs movement between two Mapbox GL JS maps"
        }
    },
    "Development Tools": {
        "mapbox-gl-js-mock": {
            "website": "https://github.com/mapbox/mapbox-gl-js-mock",
            "description": md`is a [mock](https://en.wikipedia.org/wiki/Mock_object) of Mapbox GL JS`
        },
        "mapbox-gl-inspect": {
            "website": "https://github.com/lukasmartinelli/mapbox-gl-inspect",
            "description": "adds an inspect control to view vector source features and properties"
        },
        "mapbox-gl-fps": {
            "website": "https://github.com/MazeMap/mapbox-gl-fps",
            "description": "A frames-per-seconds GUI control and measurer with statistic report output."
        }
    }
};

export default class extends React.Component {
    render() {
        return (
            <PageShell meta={meta}>
                <LeftNav>
                    <div>
                        {entries(plugins).map(([title, plugins], i) =>
                            <div key={i} className="space-bottom">
                                <a href={prefixUrl(`/plugins/#${slug(title)}`)} className='dark-link block small truncate'>{title}</a>
                                {entries(plugins).map(([name], i) =>
                                    <a key={i} href={prefixUrl(`/plugins/#${slug(name)}`)} className='block small truncate'>{name}</a>
                                )}
                            </div>
                        )}
                    </div>
                </LeftNav>

                <div className='limiter clearfix'>
                    <TopNav current='plugins'/>

                    <div className='contain margin3 col9'>
                        <div id='plugins' className='doc' data-swiftype-index='true'>
                            {entries(plugins).map(([title, plugins], i) =>
                                <div key={i} className='space-bottom4'>
                                    <a id={slug(title)}/>
                                    <h2 className='space-bottom1'>{title}</h2>
                                    {entries(plugins).map(([name, plugin], i) =>
                                        <div key={i} className='space-bottom1 keyline-all pad2 fill-white'>
                                            <a id={slug(name)}/>
                                            <h3><a href={plugin.website}>{name}</a></h3>
                                            { plugin.example && <a
                                                className="small quiet rcon"
                                                href={prefixUrl(`/example/${plugin.example}`)}>view example</a> }
                                            <p>{ plugin.description }</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </PageShell>
        );
    }
}
