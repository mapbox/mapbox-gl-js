// @flow

import Layout from './layout';

import { OverscaledTileID } from '../../src/source/tile_id';

const LAYER_COUNT = 2;

module.exports = class LayoutDDS extends Layout {
    tileIDs(): Array<OverscaledTileID> {
        return [
            new OverscaledTileID(15, 0, 15, 9373, 12535)
        ];
    }

    sourceID(): string {
        return 'mapbox';
    }

    fetchStyle(): Promise<StyleSpecification> {
        const style = {
            "version": 8,
            "sources": {
                "mapbox": { "type": "vector", "url": "mapbox://mapbox.mapbox-streets-v7" }
            },
            "layers": []
        };

        const layers = [
            {
                "id": "road",
                "type": "line",
                "source": "mapbox",
                "source-layer": "road",
                "paint": {
                    "line-width": 3,
                    "line-color":{
                        "type": "categorical",
                        "property": "class",
                        "stops":[
                            [{"zoom": 0, "value": "motorway"}, "#0000FF"],
                            [{"zoom": 0, "value": "trunk"}, "#000FF0"],
                            [{"zoom": 0, "value": "primary"}, "#00FF00"],
                            [{"zoom": 0, "value": "secondary"}, "#0FF000"],
                            [{"zoom": 0, "value": "street"}, "#FF0000"],
                            [{"zoom": 17, "value": "motorway"}, "#000088"],
                            [{"zoom": 17, "value": "trunk"}, "#000880"],
                            [{"zoom": 17, "value": "primary"}, "#008800"],
                            [{"zoom": 17, "value": "secondary"}, "#088000"],
                            [{"zoom": 17, "value": "street"}, "#880000"]
                        ],
                        "default": "#444444"
                    }
                }
            },
            {
                "id": "poi",
                "type": "circle",
                "source": "mapbox",
                "source-layer": "poi_label",
                "paint": {
                    "circle-radius": {
                        "base": 2,
                        "property": "scalerank",
                        "stops":[
                            [{"zoom": 0, "value": 0}, 1],
                            [{"zoom": 0, "value": 10}, 5],
                            [{"zoom": 17, "value": 0}, 20],
                            [{"zoom": 17, "value": 10}, 50]
                        ]
                    },
                    "circle-color": {
                        "base": 1.25,
                        "property": "localrank",
                        "stops":[
                            [{"zoom": 0, "value": 0}, "#002222"],
                            [{"zoom": 0, "value": 10}, "#220022"],
                            [{"zoom": 17, "value": 0}, "#008888"],
                            [{"zoom": 17, "value": 10}, "#880088"]
                        ]
                    }
                }
            }
        ];

        while (style.layers.length < LAYER_COUNT) {
            for (const layer of layers) {
                style.layers.push(Object.assign(({}: any), layer, {
                    id: layer.id + style.layers.length
                }));
            }
        }

        return Promise.resolve(style);
    }
};
