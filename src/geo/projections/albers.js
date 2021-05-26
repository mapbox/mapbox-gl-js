function albers (lng, lat) {
    const p1r = 29.5;
    const p2r = 45.5;
    const p1 = p1r / 180 * Math.PI;
    const p2 = p2r / 180 * Math.PI;
    const n = 0.5 * (Math.sin(p1) + Math.sin(p2));
    const theta = n * ((lng + 77) / 180 * Math.PI);
    const c = Math.pow(Math.cos(p1), 2) + 2 * n * Math.sin(p1);
    const r = 0.5;
    const a = r / n * Math.sqrt(c - 2 * n * Math.sin(lat / 180 * Math.PI));
    const b = r / n * Math.sqrt(c - 2 * n * Math.sin(0 / 180 * Math.PI));
    const x = a * Math.sin(theta);
    const y = b - a * Math.cos(theta);

    return {x: 0.5 + 0.5 * x, y: 0.5 + 0.5 * -y};
}

export default {
    project: (lng, lat) => {
        const {x, y} = albers(lng, lat);

        return {
            x: x + 0.5,
            y: y + 0.5
        };
    },
    unproject: (x, y) => mercatorProjection.unproject(x, y)
};
