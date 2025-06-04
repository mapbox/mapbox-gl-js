// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
export function createStyle(options = {}) {
    return {
        version: 8,
        center: [-73.9749, 40.7736],
        zoom: 12.5,
        bearing: 29,
        pitch: 50,
        sources: {},
        layers: [],
        ...options
    };
}

export function createStyleSource() {
    return {
        type: "geojson",
        data: {
            type: "FeatureCollection",
            features: []
        }
    };
}
