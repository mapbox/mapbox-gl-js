import type {StyleSpecification} from './types';

const MAPBOX_URL_RE = /^mapbox:\/\/(.*)/;

export default function (style: StyleSpecification): StyleSpecification {
    const styleIDs: string[] = [];
    const sourceIDs: string[] = [];
    const compositedSourceLayers: string[] = [];

    for (const id in style.sources) {
        const source = style.sources[id];

        if (source.type !== "vector")
            continue;

        const match = MAPBOX_URL_RE.exec(source.url);
        if (!match)
            continue;

        styleIDs.push(id);
        sourceIDs.push(match[1]);
    }

    if (styleIDs.length < 2)
        return style;

    styleIDs.forEach((id) => {
        delete style.sources[id];
    });

    const compositeID = sourceIDs.join(",");

    style.sources[compositeID] = {
        "type": "vector",
        "url": `mapbox://${compositeID}`
    };

    style.layers.forEach((layer) => {
        if (styleIDs.includes(layer.source)) {
            layer.source = compositeID;

            if ('source-layer' in layer) {
                if (compositedSourceLayers.includes(layer['source-layer'])) {
                    throw new Error('Conflicting source layer names');
                } else {
                    compositedSourceLayers.push(layer['source-layer']);
                }
            }
        }
    });

    return style;
}
