// @flow

export default {
    name: 'wgs84',
    range: [],
    project(lng: number, lat: number) {
        const x = 0.5 + lng / 360;
        const y = 0.5 - lat / 360;
        return {x, y};
    },
    unproject: () => {}
};
