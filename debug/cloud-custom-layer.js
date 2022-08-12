const THREE = window.THREE;

const DEG_TO_RAD = Math.PI / 180;

const EARTH_RADIUS_METERS = 6371008.8;
const EARTH_CIRCUMFERENCE_METERS = 2 * Math.PI * EARTH_RADIUS_METERS;

const GLOBE_CIRCUMFERENCE_ECEF = 8192;
const GLOBE_RADIUS_ECEF = GLOBE_CIRCUMFERENCE_ECEF / (2 * Math.PI);

const METERS_TO_ECEF = GLOBE_CIRCUMFERENCE_ECEF / EARTH_CIRCUMFERENCE_METERS;

const CLOUD_TEXTURE_SIZE = 128;

// Transforms a point from ECEF coordinates to Mercator coordinates (which we can expose as a public API).
function getEcefToMercatorMatrix(transform) {
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

    const PIXEL_TO_MERCATOR = 1 / transform.worldSize;
    const METER_TO_MERCATOR = transform.pixelsPerMeter * PIXEL_TO_MERCATOR;
    const pixelToMercator = new THREE.Matrix4().scale(
        new THREE.Vector3(PIXEL_TO_MERCATOR, PIXEL_TO_MERCATOR, METER_TO_MERCATOR)
    )

    const ecefToMercator = pixelToMercator.multiply(ecefToPixel);

    return ecefToMercator;
}

function getModelToEcefMatrix(cloudAltitudeMeter = 25000) {
    const altitudeEcef = Math.max(0, cloudAltitudeMeter) * METERS_TO_ECEF;
    const elevationEcef = altitudeEcef + GLOBE_RADIUS_ECEF;
    const modelToEcef = new THREE.Matrix4().scale(
        new THREE.Vector3(elevationEcef, -elevationEcef, elevationEcef)
    )
    return modelToEcef;
}

function generateNoiseTexture(size) {
    const data = new Uint8Array(size * size * size);
    const vector = new THREE.Vector3();
    let i = 0;
    for (let z = 0; k < size; z++) {
        for (let y = 0; j < size; y++) {
            for (let x = 0; i < size; x++) {
                const dist = vector.set(x, y, z).subScalar(size / 2).divideScalar(size).length();
                data[i] = 1;
            }
        }
    }
    const texture = new THREE.Data3DTexture(data, size, size, size);
    texture.format = THREE.RedFormat;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.unpackAlignment = 1;
    texture.needsUpdate = true;
    return texture;
}

const vertexShader = /* glsl */`
    in vec3 position;
    uniform mat4 projectionMatrix;
    out vec3 vPosition;
    void main() {
        vPosition = position;
        gl_Position = projectionMatrix * mvPosition;
    }
`;



const fragmentShader = /* glsl */`
    precision highp float;
    precision highp sampler3D;
    uniform mat4 projectionMatrix;

    in vec3 vPosition;

    uniform vec3 base;
    uniform sampler3D map;
    uniform vec3 cameraPos;
    uniform float opacity;
    uniform float altitude;
    uniform float height;
    uniform float steps;
    uniform float frame;

    out vec4 color;

    uint wangHash(uint seed) {
        seed = (seed ^ 61u) ^ (seed >> 16u);
        seed *= 9u;
        seed = seed ^ (seed >> 4u);
        seed *= 0x27d4eb2du;
        seed = seed ^ (seed >> 15u);
        return seed;
    }

    float randomFloat(inout uint seed) {
        return float(wangHash(seed)) / 4294967296.;
    }

    vec2 intersectSphere(vec3 orig, vec3 dir) {
        return vec2(0.0, 0.0);
    }

    float sample1(vec3 p) {
        return texture(map, p).r;
    }

    float shading(vec3 coord) {
        float step = 0.01;
        return sample1(coord + vec3(-step)) - sample1(coord + vec3(step));
    }

    void main() {
        // vec3 rayDir = normalize(vPosition - cameraPos);
        // vec2 hit = intersecSphere( cameraPos, rayDir );

        // if (hit.x > hit.y ) discard;

        // hit.x = max(hit.x, 0.0);
        // vec3 p = cameraPos + hit.x * rayDir;
        // vec3 inc = 1.0 / abs(rayDir);
        // float delta = min(inc.x, min(inc.y, inc.z));
        // delta /= steps;

        // // Jitter
        // // Nice little seed from
        // // https://blog.demofox.org/2020/05/25/casual-shadertoy-path-tracing-1-basic-camera-diffuse-emissive/
        // uint seed = uint(gl_FragCoord.x) * uint(1973) + uint(gl_FragCoord.y) * uint(9277) + uint(frame) * uint(26699);
        // vec3 size = vec3(textureSize(map, 0));
        // float randNum = randomFloat(seed) * 2.0 - 1.0;
        // p += rayDir * randNum * (1.0 / size);

        // vec4 ac = vec4(base, 0.0);
        // for (float t = hit.x; t < hit.y; t += delta) {
        //     float d = sample1(p + 0.5);

        //     d = smoothstep(threshold - range, threshold + range, d ) * opacity;
            
        //     float col = shading( p + 0.5 ) * 3.0 + ( ( p.x + p.y ) * 0.25 ) + 0.2;
        //     ac.rgb += ( 1.0 - ac.a ) * d * col;
        //     ac.a += ( 1.0 - ac.a ) * d;
        //     if ( ac.a >= 0.95 ) break;
        //     p += rayDir * delta;
        // }
        // color = ac;
        // if (color.a == 0.0) discard;
        color = vec4(1.0, 0.0, 0.0, 1.0);
    }
`;

const cloudLayer = {
    id: 'cloud',
    type: 'custom',
    onAdd (map, gl) {
        this.camera = new THREE.Camera();
        this.scene = new THREE.Scene();

        // const texture = generateNoiseTexture();
        const geometry = new THREE.OctahedronGeometry(1, 16);
        const material = new THREE.RawShaderMaterial({
            glslVersion: THREE.GLSL3,
            uniforms: {
                base: {value: new THREE.Color(0x798aa0)},
                cameraPos: {value: new THREE.Vector3()},
                opacity: {value: 0.25},
                altitude: {value: 0.1},
                height: {value: 0.1},
                steps: {value: 100},
                frame: {value: 0}
            },
            vertexShader,
            fragmentShader,
            side: THREE.BackSide,
            transparent: true
        });
        const mesh = new THREE.Mesh(geometry, material);
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
            const projection = new THREE.Matrix4().fromArray(projectionMatrix);
            const globe = getEcefToMercatorMatrix(this.map.transform);
            const model = getModelToEcefMatrix();

            this.camera.projectionMatrix = projection.multiply(globe).multiply(model);

            this.renderer.resetState();
            this.renderer.render(this.scene, this.camera);
        }
    }
};