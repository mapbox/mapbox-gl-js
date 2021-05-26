function sinc(x) {
    return Math.sin(x) / x;
}

function winkelTripel(lng, lat) {
    lat = lat / 180 * Math.PI;
    lng = lng / 180 * Math.PI;
    const phi1 = Math.acos(2 / Math.PI);
    const alpha = Math.acos(Math.cos(lat) * Math.cos(lng / 2));
    const x = 0.5 * (lng * Math.cos(phi1) + (2 * Math.cos(lat) * Math.sin(lng/2)) / sinc(alpha)) || 0;
    const y = 0.5 * (lat + Math.sin(lat) / sinc(alpha)) || 0;
    function s(n) {
        return (n / (Math.PI) + 0.5) * 0.5;
    }
    return { x: s(x), y: 1 - s(y) };
}

export default {
    project: (lng, lat) => winkelTripel(lng, lat),
    unproject: () => {}
};