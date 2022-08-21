const THREE = window.THREE;

const DEG_TO_RAD = Math.PI / 180;

const EARTH_RADIUS_METERS = 6371008.8;
const EARTH_CIRCUMFERENCE_METERS = 2 * Math.PI * EARTH_RADIUS_METERS;

const GLOBE_CIRCUMFERENCE_ECEF = 8192;
const GLOBE_RADIUS_ECEF = GLOBE_CIRCUMFERENCE_ECEF / (2 * Math.PI);

const METERS_TO_ECEF = GLOBE_CIRCUMFERENCE_ECEF / EARTH_CIRCUMFERENCE_METERS;

const CLOUD_TEXTURE_SIZE = 64;

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

function getModelToEcefMatrix(cloudAltitudeMeter) {
    const altEcef = Math.max(cloudAltitudeMeter, 0) * METERS_TO_ECEF;
    const modelToEcefScaler = altEcef + GLOBE_RADIUS_ECEF;
    const modelToEcef = new THREE.Matrix4().scale(
        new THREE.Vector3(modelToEcefScaler, modelToEcefScaler, modelToEcefScaler)
    )
    return modelToEcef;
}

function getModelToMercatorMatrix(transform, cloudAltitudeMeter) {
    const modelToEcef = getModelToEcefMatrix(cloudAltitudeMeter);
    const ecefToPixel = getEcefToPixelMatrix(transform);
    const pixelToMercator = getPixelToMercatorMatrix(transform);
    return pixelToMercator.multiply(ecefToPixel).multiply(modelToEcef);
}

const vertexShader = /* glsl */`
    attribute vec3 position;
    uniform mat4 projectionMatrix;
    varying vec3 vPosition;
    void main() {
        vPosition = position;
        gl_Position = projectionMatrix * vec4(position, 1.0);
    }
`;

const fragmentShader = /* glsl */`
    precision highp float;

    float square(float x) { return x * x; }
    float hash(float p) { p = fract(p * 0.011); p *= p + 7.5; p *= p + p; return fract(p); }
    float noise(vec3 x) { const vec3 step = vec3(110, 241, 171); vec3 i = floor(x); vec3 f = fract(x); float n = dot(i, step); vec3 u = f * f * (3.0 - 2.0 * f); return mix(mix(mix( hash(n + dot(step, vec3(0, 0, 0))), hash(n + dot(step, vec3(1, 0, 0))), u.x), mix( hash(n + dot(step, vec3(0, 1, 0))), hash(n + dot(step, vec3(1, 1, 0))), u.x), u.y), mix(mix( hash(n + dot(step, vec3(0, 0, 1))), hash(n + dot(step, vec3(1, 0, 1))), u.x), mix( hash(n + dot(step, vec3(0, 1, 1))), hash(n + dot(step, vec3(1, 1, 1))), u.x), u.y), u.z); }
    #define DEFINE_FBM(name, OCTAVES) float name(vec3 x) { float v = 0.0; float a = 0.5; vec3 shift = vec3(100); for (int i = 0; i < OCTAVES; ++i) { v += a * noise(x); x = x * 2.0 + shift; a *= 0.5; } return v; }
    DEFINE_FBM(fbm3, 3)
    DEFINE_FBM(fbm5, 5)

    varying vec3 vPosition;
    uniform mat4 projectionMatrix;    
    uniform vec3 cloudColor;
    uniform vec3 cameraPos;
    uniform vec3 lightDir;
    uniform float opacity;
    uniform float steps;

    // Hit unit sphere at origin.
    vec2 sphereIntersection(vec3 ro, vec3 rd) {
        float b = dot(ro, rd);
        float c = dot(ro, ro) - 1.0;
        float d = b * b - c;
        if (d < 0.0) discard;
        d = sqrt(d);
        float tN = (-b - d);
        float tF = (-b + d);
        if (tF < 0.0) discard;
        return vec2(tN, tF);
    }

    float cloudDensity(vec3 p, float t) {
        return fbm5(p + 1.5 * fbm3(p - t * 0.047) - t * vec3(0.03, 0.01, 0.01)) - 0.42;
    }

    float cloudDensity2(vec3 p, float t) {
        return fbm5(p);
    }

    const float MAX_STEPS = 100.0;

    void main() {
        vec3 rd = normalize(vPosition - cameraPos);
        vec3 ro = -0.01 * rd + vPosition; // avoids precision issues when camera is too far.
        vec2 hit = sphereIntersection(ro, rd);
        
        hit.x = max(hit.x, 0.0);
        hit.y = hit.x + (hit.y - hit.x) / 100.0;
        float stepSize = 1.0 / steps;

        vec4 radiance = vec4(0.0);
        float t = hit.y;
        for (float i = 0.0; i < MAX_STEPS; i++) {
            if (t > hit.x) {
                vec3 p = ro + t * rd;
                float density = cloudDensity(p, 0.0);
                if (density > 0.0) {
                    float shading = clamp(-(cloudDensity(p + lightDir * stepSize, 0.0) - density) / stepSize, -1.0, 1.0) * 0.5 + 0.5;
                    vec3 Lo = cloudColor * shading * vec3(2.1);
                    radiance = mix(radiance, vec4(Lo, 1.0), density);
                    density *= square(1.0 - abs(2.0 * length(p) - (0.85 + 1.0)) * (1.0 / (1.0 - 0.85)));
                    t += 2.0 * stepSize; 
                }
                t -= 3.0 * stepSize;
            } else {
                break;
            }
        }
        gl_FragColor = radiance;
    }
`;

const cloudLayer = {
    id: 'cloud',
    type: 'custom',
    onAdd (map, gl) {
        this.camera = new THREE.Camera();
        this.scene = new THREE.Scene();

        const geometry = new THREE.IcosahedronGeometry(1, 8);
        const material = new THREE.RawShaderMaterial({
            uniforms: {
                cloudColor: {value: new THREE.Color(0xffffff)},
                cameraPos: {value: new THREE.Vector3()},
                lightDir: {value: new THREE.Vector3(1.0 / 1.7464, 1.3 / 1.7464, 0.6 / 1.7464)},
                opacity: {value: 0.75},
                steps: {value: 100}
            },
            vertexShader,
            fragmentShader,
            side: THREE.BackSide,
            transparent: true
        });
        const mesh = new THREE.Mesh(geometry, material);
        this.mesh = mesh;
        this.scene.add(mesh);

        this.map = map;

        this.renderer = new THREE.WebGLRenderer({
            canvas: map.getCanvas(),
            context: gl,
            antialias: true
        });

        this.renderer.autoClear = false;
    },

    render (gl, projectionMatrix, globeMatrix) {

        // const cloudRangeNormalized = Math.min(1, Math.max(0, cloudRangeMeter / EARTH_RADIUS_METERS));
        // const cloudStartAltNormalized = 1 - cloudRangeNormalized;
        // const cloudEndAltNormalized = 1;

        if (this.map.transform.projection.name === 'globe') {
            const transform = this.map.transform;

            const projection = new THREE.Matrix4().fromArray(projectionMatrix);
            const cloudAltitudeMeter = 50000;
            const modelToMercator = getModelToMercatorMatrix(transform, cloudAltitudeMeter);
            const mercatorToModel = modelToMercator.clone().invert();

            let cameraPos = new THREE.Vector4(transform._camera.position[0],
                                              transform._camera.position[1],
                                              transform._camera.position[2]);
            cameraPos.applyMatrix4(mercatorToModel);

            this.mesh.material.uniforms.cameraPos.value.copy(cameraPos);
            this.camera.projectionMatrix = projection.multiply(modelToMercator);

            this.renderer.resetState();
            this.renderer.render(this.scene, this.camera);
        }
    }
};