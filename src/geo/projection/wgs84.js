export default {
    name: 'wgs84',
    project: (lng, lat) => {
        const x = 0.5 + lng / 360;
        const y = 0.5 - lat / 360;

        return {x, y};
    },
    unproject: () => {},
};