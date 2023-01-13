const THREE = window.THREE;

const EARTH_RADIUS_METERS = 6371008.8;
const EARTH_CIRCUMFERENCE_METERS = 2 * Math.PI * EARTH_RADIUS_METERS;
const GLOBE_CIRCUMFERENCE_ECEF = 8192;
const METERS_TO_ECEF = GLOBE_CIRCUMFERENCE_ECEF / EARTH_CIRCUMFERENCE_METERS;

const KM_TO_M = 1000;
const TIME_STEP = 3 * 1000;
const SATELLITE_SIZE_KM = 60;

function getModelToGlobeMatrix(lat, lon, altKm, sizeKm) {
    const [x, y, z] = mapboxgl.MercatorCoordinate.lngLatToEcef([lon, lat], altKm * KM_TO_M);
    const sizeEcefScaler = sizeKm * KM_TO_M * METERS_TO_ECEF;
    const modelToEcef = new THREE.Matrix4()
    .makeTranslation(x, y, z)
    .scale(
        new THREE.Vector3(sizeEcefScaler, -sizeEcefScaler, sizeEcefScaler)
    )
    return modelToEcef;
}

let time = new Date();

const satellitesLayer = {
    id: 'satellites',
    type: 'custom',
    onAdd (map, gl) {
        this.renderer = new THREE.WebGLRenderer({
            canvas: map.getCanvas(),
            context: gl,
            antialias: true
        });
        this.renderer.autoClear = false;
        this.camera = new THREE.Camera();
        this.scene = new THREE.Scene();
        this.map = map;

        fetch('space-track-leo.txt').then(r => r.text()).then(rawData => {
            const tleData = rawData.replace(/\r/g, '')
              .split(/\n(?=[^12])/)
              .filter(d => d)
              .map(tle => tle.split('\n'));
            this.satData = tleData.map(([name, ...tle]) => ({
              satrec: satellite.twoline2satrec(...tle),
              name: name.trim().replace(/^0 /, '')
            }))
            // exclude those that can't be propagated
            .filter(d => !!satellite.propagate(d.satrec, new Date()).position)
            .slice(0, 500);

            const geometry = new THREE.OctahedronGeometry(1, 1);
            const material = new THREE.MeshBasicMaterial({color: '#ff0000', transparent: true, opacity: 0.8});
            this.mesh = new THREE.InstancedMesh(geometry, material, this.satData.length);
            this.scene.add(this.mesh);
        });
    },

    render (gl, projectionMatrix, globeMatrix) {
        if (this.satData && globeMatrix !== null) {
            time = new Date(+time + TIME_STEP);
            const gmst = satellite.gstime(time);
            

            for (let i = 0; i < this.satData.length; ++i) {
                const satrec = this.satData[i].satrec;
                const eci = satellite.propagate(satrec, time);
                if (eci.position) {
                    const geodetic = satellite.eciToGeodetic(eci.position, gmst);
                    const modelToGlobe = getModelToGlobeMatrix(
                        satellite.degreesLat(geodetic.latitude),
                        satellite.degreesLong(geodetic.longitude),
                        geodetic.height,
                        SATELLITE_SIZE_KM);
                    const globeToMerc = new THREE.Matrix4().fromArray(globeMatrix);
                    const final = globeToMerc.multiply(modelToGlobe);
                    this.mesh.setMatrixAt(i, final);
                }
            }

            this.mesh.instanceMatrix.needsUpdate = true;

            const projection = new THREE.Matrix4().fromArray(projectionMatrix);
            this.camera.projectionMatrix = projection;

            this.renderer.resetState();
            this.renderer.render(this.scene, this.camera);
        }
    }
};