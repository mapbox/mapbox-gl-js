import md from '@mapbox/batfish/modules/md'; // eslint-disable-line import/no-unresolved

export const plugins = {
    "User Interface Plugins": {
        "mapbox-gl-accessibility": {
            "website": "https://github.com/mapbox/mapbox-gl-accessibility/",
            "description": "integrates with ARIA-compatible screen readers for users with visual impairments"
        },
        "mapbox-gl-boundaries": {
            "website": "https://github.com/mapbox/mapbox-gl-boundaries",
            "description": "enables users to show/hide disputed borders"
        },
        "mapbox-gl-compare": {
            "website": "https://github.com/mapbox/mapbox-gl-compare",
            "description": "enables users to compare two maps by swiping left and right",
            "example": "mapbox-gl-compare"
        },
        "mapbox-gl-directions": {
            "website": "https://github.com/mapbox/mapbox-gl-directions",
            "description": "adds a control which allows users to plot driving, walking, and cycling directions on the map",
            "example": "mapbox-gl-directions"
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
        "mapboxgl-minimap": {
            "website": "https://github.com/aesqe/mapboxgl-minimap",
            "description": "adds a control showing a miniature overview of the current map"
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
        "mapbox-gl-traffic": {
            "website": "https://github.com/mapbox/mapbox-gl-traffic",
            "description": "hide and show traffic layers on your map with an optional toggle button"
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
            "description": md`provides an [AngularJS](https://angularjs.org/) directive for Mapbox GL JS`
        },
        "ngx-mapbox-gl": {
            "website": "https://github.com/Wykks/ngx-mapbox-gl",
            "description": md`provides an [Angular](https://angular.io/) integration for Mapbox GL JS`
        },
        "elm-mapbox": {
            "website": "https://package.elm-lang.org/packages/gampleman/elm-mapbox/latest/",
            "description": md`provides an [Elm](https://elm-lang.org) integration for Mapbox GL JS`
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
        "expression-jamsession": {
            "website": "https://github.com/mapbox/expression-jamsession/",
            "description": md`converts [Mapbox Studio formulas](https://www.mapbox.com/help/studio-manual-styles/#use-a-formula) into [expressions](https://www.mapbox.com/mapbox-gl-js/style-spec/#expressions)`
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
        },
        "mapbox-choropleth": {
            "website": "https://github.com/stevage/mapbox-choropleth",
            "description": "create a choropleth layer from a CSV source and a geometry source"
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
