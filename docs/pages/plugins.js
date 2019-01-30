import React from 'react';
import slug from 'slugg';
import {prefixUrl} from '@mapbox/batfish/modules/prefix-url';
import md from '@mapbox/batfish/modules/md'; // eslint-disable-line import/no-unresolved
import PageShell from '../components/page_shell';
import entries from 'object.entries';
import IconText from '@mapbox/mr-ui/icon-text';

const meta = {
    title: 'Mapbox GL JS Plugins',
    description: 'Extend your Mapbox GL JS map with plugins.',
    pathname: '/mapbox-gl-js/plugins'
};

const plugins = {
    "User Interface Plugins": {
        "mapbox-gl-accessibility": {
            "website": "https://github.com/mapbox/mapbox-gl-accessibility/",
            "description": "Integrates with ARIA-compatible screen readers for users with visual impairments."
        },
        "mapbox-gl-boundaries": {
            "website": "https://github.com/mapbox/mapbox-gl-boundaries",
            "description": "Enables users to show/hide disputed borders."
        },
        "mapbox-gl-compare": {
            "website": "https://github.com/mapbox/mapbox-gl-compare",
            "description": "Enables users to compare two maps by swiping left and right.",
            "example": "mapbox-gl-compare"
        },
        "mapbox-gl-controls": {
            "website": "https://github.com/bravecow/mapbox-gl-controls",
            "description": "alternative basic map controls"
        },
        "mapbox-gl-directions": {
            "website": "https://github.com/mapbox/mapbox-gl-directions",
            "description": "Adds a control which allows users to plot driving, walking, and cycling directions on the map.",
            "example": "mapbox-gl-directions"
        },
        "mapbox-gl-draw": {
            "website": "https://github.com/mapbox/mapbox-gl-draw",
            "description": "Adds support for drawing and editing features on Mapbox GL JS maps.",
            "example": "mapbox-gl-draw"
        },
        "mapbox-gl-geocoder": {
            "website": "https://github.com/mapbox/mapbox-gl-geocoder",
            "description": "Adds a Geocoder control to Mapbox GL JS.",
            "example": "mapbox-gl-geocoder"
        },
        "mapbox-gl-infobox": {
            "website": "https://github.com/el/infobox-control",
            "description": "adds a control to display an infobox or a gradient"
        },
        "mapbox-gl-style-switcher": {
            "website": "https://github.com/el/style-switcher",
            "description": "adds a control to switch between styles"
        },
        "mapboxgl-minimap": {
            "website": "https://github.com/aesqe/mapboxgl-minimap",
            "description": "Adds a control showing a miniature overview of the current map."
        }
    },
    "Map Rendering Plugins": {
        "mapbox-gl-language": {
            "website": "https://github.com/mapbox/mapbox-gl-language/",
            "description": "Automatically localizes the map into the user’s language."
        },
        "mapbox-gl-rtl-text": {
            "website": "https://github.com/mapbox/mapbox-gl-rtl-text",
            "description": "Adds right-to-left text support to Mapbox GL JS.",
            "example": "mapbox-gl-rtl-text"
        },
        "mapbox-gl-traffic": {
            "website": "https://github.com/mapbox/mapbox-gl-traffic",
            "description": "Hide and show traffic layers on your map with an optional toggle button."
        },
        "deck.gl": {
            "website": "https://github.com/uber/deck.gl",
            "description": "Adds advanced WebGL visualization layers to Mapbox GL JS."
        }
    },
    "Framework Integrations": {
        "echartslayer": {
            "website": "https://github.com/lzxue/echartLayer",
            "description": md`Provides an [echarts](https://ecomfe.github.io/echarts/index-en.html) integration for Mapbox GL JS.`
        },
        "wtMapbox": {
            "website": "https://github.com/yvanvds/wtMapbox",
            "description": md`Provides a [Webtoolkit](https://www.webtoolkit.eu/wt) integration for Mapbox GL JS.`
        },
        "react-mapbox-gl": {
            "website": "https://github.com/alex3165/react-mapbox-gl",
            "description": md`Provides a [React](https://facebook.github.io/react/) integration for Mapbox GL JS.`
        },
        "angular-mapboxgl-directive": {
            "website": "https://github.com/Naimikan/angular-mapboxgl-directive",
            "description": md`Provides an [AngularJS](https://angularjs.org/) directive for Mapbox GL JS.`
        },
        "ngx-mapbox-gl": {
            "website": "https://github.com/Wykks/ngx-mapbox-gl",
            "description": md`Provides an [Angular](https://angular.io/) integration for Mapbox GL JS.`
        },
        "elm-mapbox": {
            "website": "https://package.elm-lang.org/packages/gampleman/elm-mapbox/latest/",
            "description": md`Provides an [Elm](https://elm-lang.org) integration for Mapbox GL JS.`
        },
        "ember-mapbox-gl": {
            "website": "https://github.com/kturney/ember-mapbox-gl",
            "description": md`Provides an [Ember](http://emberjs.com) integration for Mapbox GL JS.`
        }
    },
    "Utility Libraries": {
        "turf": {
            "website": "http://turfjs.org/",
            "description": "Provides advanced geospatial analysis tools."
        },
        "mapbox-gl-layer-groups": {
            "website": "https://github.com/mapbox/mapbox-gl-layer-groups",
            "description": "Manages layer groups in Mapbox GL JS."
        },
        "expression-jamsession": {
            "website": "https://github.com/mapbox/expression-jamsession/",
            "description": md`converts [Mapbox Studio formulas](https://www.mapbox.com/help/studio-manual-styles/#use-a-formula) into [expressions](https://docs.mapbox.com/mapbox-gl-js/style-spec/#expressions)`
        },
        "simplespec-to-gl-style": {
            "website": "https://github.com/mapbox/simplespec-to-gl-style",
            "description": md`Converts GeoJSON styled with [\`simplestyle-spec\`](https://github.com/mapbox/simplestyle-spec/) to a Mapbox GL Style.`
        },
        "mapbox-gl-supported": {
            "website": "https://github.com/mapbox/mapbox-gl-supported",
            "description": "Determines if the current browser supports Mapbox GL JS.",
            "example": "mapbox-gl-supported"
        },
        "mapbox-gl-sync-move": {
            "website": "https://github.com/mapbox/mapbox-gl-sync-move",
            "description": "Syncs movement between two Mapbox GL JS maps."
        },
        "mapbox-choropleth": {
            "website": "https://github.com/stevage/mapbox-choropleth",
            "description": "create a choropleth layer from a CSV source and a geometry source"
        },
        "mapbox-gl-utils": {
            "website": "https://github.com/stevage/mapbox-gl-utils",
            "description": "manage layers, sources and properties with syntactic sugar and convenience functions"
        }
    },
    "Development Tools": {
        "mapbox-gl-js-mock": {
            "website": "https://github.com/mapbox/mapbox-gl-js-mock",
            "description": md`Is a [mock](https://en.wikipedia.org/wiki/Mock_object) of Mapbox GL JS.`
        },
        "mapbox-gl-inspect": {
            "website": "https://github.com/lukasmartinelli/mapbox-gl-inspect",
            "description": "Adds an inspect control to view vector source features and properties."
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
                <h1 className='mt24 mt0-mm'>Plugins</h1>
                <div className=''>
                    <div id='plugins' className='doc' data-swiftype-index='true'>
                        {entries(plugins).map(([title, plugins], i) => <div key={i} className=''>
                            <h2 id={slug(title)}><a className="unprose color-blue-on-hover" href={`#${slug(title)}`}>{title}</a></h2>
                            {entries(plugins).map(([name, plugin], i) => <div key={i} className=''>
                                <h3 id={slug(name)}><a className="unprose color-blue-on-hover" href={`#${slug(name)}`}>{name}</a></h3>
                                <div>{ plugin.description }</div>
                                <div className="my12">
                                    { plugin.website &&
                                                <div className='mb6'>
                                                    <a className="color-blue color-blue-dark-on-hover unprose" href={plugin.website}>
                                                        <IconText iconBefore="github">View on GitHub</IconText>
                                                    </a>
                                                </div>
                                    }
                                    { plugin.example &&
                                                <div>
                                                    <a className="color-blue color-blue-dark-on-hover unprose" href={prefixUrl(`/example/${plugin.example}`)}>
                                                        <IconText iconBefore="code">View example</IconText>
                                                    </a>
                                                </div>
                                    }
                                </div>
                            </div>
                            )}
                        </div>
                        )}
                    </div>
                </div>
            </PageShell>
        );
    }
}
