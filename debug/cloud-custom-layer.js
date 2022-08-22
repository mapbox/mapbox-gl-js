const THREE = window.THREE;

const DEG_TO_RAD = Math.PI / 180;

const EARTH_RADIUS_METERS = 6371008.8;
const EARTH_CIRCUMFERENCE_METERS = 2 * Math.PI * EARTH_RADIUS_METERS;

const GLOBE_CIRCUMFERENCE_ECEF = 8192;
const GLOBE_RADIUS_ECEF = GLOBE_CIRCUMFERENCE_ECEF / (2 * Math.PI);

const METERS_TO_ECEF = GLOBE_CIRCUMFERENCE_ECEF / EARTH_CIRCUMFERENCE_METERS;

const KM_TO_M = 1000;
const TIME_STEP = 3 * 1000;

function getPixelToMercatorMatrix(transform) {
    const PIXEL_TO_MERCATOR = 1 / transform.worldSize;
    const METER_TO_MERCATOR = transform.pixelsPerMeter * PIXEL_TO_MERCATOR;
    const pixelToMercator = new THREE.Matrix4().scale(
        new THREE.Vector3(PIXEL_TO_MERCATOR, PIXEL_TO_MERCATOR, METER_TO_MERCATOR)
    )
    return pixelToMercator;
}

function getEcefToPixelMatrix(transform) {
    const {lng, lat} = transform._center;
    
    const ecefToPixelScale = transform.worldSize / GLOBE_CIRCUMFERENCE_ECEF;

    const centerPixel = transform.point;
    const centerZPixel = transform.worldSize / (2 * Math.PI);

    const rotationX = new THREE.Matrix4().makeRotationAxis(
        new THREE.Vector3(1, 0, 0),
        -lat * DEG_TO_RAD
    );

    const rotationY = new THREE.Matrix4().makeRotationAxis(
        new THREE.Vector3(0, 1, 0),
        -lng * DEG_TO_RAD
    );

    const ecefToPixel = new THREE.Matrix4()
    .makeTranslation(
        centerPixel.x,
        centerPixel.y,
        -centerZPixel
    )
    .scale(
        new THREE.Vector3(ecefToPixelScale, ecefToPixelScale, ecefToPixelScale)
    )
    .multiply(rotationX)
    .multiply(rotationY);

    return ecefToPixel;
}

function getModelToEcefMatrix(lat, lon, altKm, sizeKm) {
    const [x, y, z] = mapboxgl.MercatorCoordinate.lngLatToEcef([lon, lat], altKm * KM_TO_M);
    const sizeEcefScaler = sizeKm * KM_TO_M * METERS_TO_ECEF;
    const modelToEcef = new THREE.Matrix4()
    .makeTranslation(x, y, z)
    .scale(
        new THREE.Vector3(sizeEcefScaler, -sizeEcefScaler, sizeEcefScaler)
    )
    return modelToEcef;
}

function getModelToMercatorMatrix(transform, lat, lon, altKm, sizeKm) {
    const modelToEcef = getModelToEcefMatrix(lat, lon, altKm, sizeKm);
    const ecefToPixel = getEcefToPixelMatrix(transform);
    const pixelToMercator = getPixelToMercatorMatrix(transform);
    return pixelToMercator.multiply(ecefToPixel).multiply(modelToEcef);
}

let time = new Date();

const cloudLayer = {
    id: 'cloud',
    type: 'custom',
    onAdd (map, gl) {
        this.renderer = new THREE.WebGLRenderer({
            canvas: map.getCanvas(),
            context: gl,
            antialias: true
        });
        this.renderer.autoClear = false;

        const satrec = satellite.twoline2satrec('1    11U 59001A   22053.83197560  .00000847  00000-0  45179-3 0  9996',
                                                '2    11  32.8647 264.6509 1466352 126.0358 248.5175 11.85932318689790');

        this.satrec = satrec;

        this.camera = new THREE.Camera();
        this.scene = new THREE.Scene();

        const geometry = new THREE.OctahedronGeometry(1, 0);
        const material = new THREE.MeshBasicMaterial({color: '#ff0000', transparent: true, opacity: 0.8});
        const mesh = new THREE.InstancedMesh(geometry, material, 1);
        this.mesh = mesh;
        this.scene.add(mesh);
        this.map = map;
    },

    render (gl, projectionMatrix, globeMatrix) {
        if (this.map.transform.projection.name === 'globe') {
            const transform = this.map.transform;

            time = new Date(+time + TIME_STEP);

            const gmst = satellite.gstime(time);
            const eci = satellite.propagate(this.satrec, time);

            if (eci.position) {
                const geodetic = satellite.eciToGeodetic(eci.position, gmst);
                const modelToMercator = getModelToMercatorMatrix(
                    transform,
                    satellite.degreesLat(geodetic.latitude),
                    satellite.degreesLong(geodetic.longitude),
                    geodetic.height,
                    100);
                this.mesh.setMatrixAt(0, modelToMercator);
                this.mesh.instanceMatrix.needsUpdate = true;
            }
            
            const projection = new THREE.Matrix4().fromArray(projectionMatrix);
            this.camera.projectionMatrix = projection;

            this.renderer.resetState();
            this.renderer.render(this.scene, this.camera);
        }
    }
};