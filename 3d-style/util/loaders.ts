/* eslint-disable new-cap */

import config from '../../src/util/config';
import browser from '../../src/util/browser';
import Dispatcher from '../../src/util/dispatcher';
import {getGlobalWorkerPool as getWorkerPool} from '../../src/util/worker_pool_factory';
import {Evented} from '../../src/util/evented';
import {isWorker, warnOnce} from '../../src/util/util';
import {loadBuildingGen} from './building_gen';
import assert from 'assert';
import {DracoDecoderModule} from './draco_decoder_gltf';
import {MeshoptDecoder} from './meshopt_decoder';

import type {BuildingGen} from './building_gen';
import type {Class} from '../../src/types/class';

let dispatcher: Dispatcher | null = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let dracoLoading: Promise<any> | undefined;
let dracoUrl: string | null | undefined;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let draco: any;
let meshoptUrl: string | null | undefined;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let meshopt: any;
let buildingGenLoading: Promise<unknown> | null = null;
let buildingGenError: Error = null;
let buildingGen: BuildingGen | null = null;

export function getDracoUrl(): string {
    if (isWorker(self) && self.worker.dracoUrl) {
        return self.worker.dracoUrl;
    }

    return dracoUrl ? dracoUrl : config.DRACO_URL;
}

export function setDracoUrl(url: string) {
    dracoUrl = browser.resolveURL(url);

    if (!dispatcher) {
        dispatcher = new Dispatcher(getWorkerPool(), new Evented());
    }

    // Sets the Draco URL in all workers.
    dispatcher.broadcast('setDracoUrl', dracoUrl);
}

function waitForDraco() {
    if (draco) return;
    if (dracoLoading != null) return dracoLoading;

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    dracoLoading = DracoDecoderModule(fetch(getDracoUrl()));

    return dracoLoading.then((module) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        draco = module;
        dracoLoading = undefined;
    });
}

export function getMeshoptUrl(): string {
// @ts-expect-error - TS2551 - Property 'worker' does not exist on type 'Window & typeof globalThis'. Did you mean 'Worker'? | TS2551 - Property 'worker' does not exist on type 'Window & typeof globalThis'. Did you mean 'Worker'?
    if (isWorker(self) && self.worker.meshoptUrl) {
        // @ts-expect-error - TS2551 - Property 'worker' does not exist on type 'Window & typeof globalThis'. Did you mean 'Worker'?
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return self.worker.meshoptUrl;
    }

    if (meshoptUrl) return meshoptUrl;

    const detector = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 4, 1, 96, 0, 0, 3, 3, 2, 0, 0, 5, 3, 1, 0, 1, 12, 1, 0, 10, 22, 2, 12, 0, 65, 0, 65, 0, 65, 0, 252, 10, 0, 0, 11, 7, 0, 65, 0, 253, 15, 26, 11]);

    if (typeof WebAssembly !== 'object') {
        throw new Error("WebAssembly not supported, cannot instantiate meshoptimizer");
    }

    meshoptUrl = WebAssembly.validate(detector) ? config.MESHOPT_SIMD_URL : config.MESHOPT_URL;

    return meshoptUrl;
}

export function setMeshoptUrl(url: string) {
    meshoptUrl = browser.resolveURL(url);
    if (!dispatcher) {
        dispatcher = new Dispatcher(getWorkerPool(), new Evented());
    }
    // Sets the Meshopt URL in all workers.
    dispatcher.broadcast('setMeshoptUrl', meshoptUrl);
}

function waitForMeshopt() {
    if (meshopt) return;
    const decoder = MeshoptDecoder(fetch(getMeshoptUrl()));
    return decoder.ready.then(() => {
        meshopt = decoder;
    });
}

export function waitForBuildingGen(): Promise<unknown> {
    if (buildingGen != null || buildingGenError != null) return null;
    if (buildingGenLoading != null) return buildingGenLoading;

    const wasmData = fetch(config.BUILDING_GEN_URL);
    buildingGenLoading = loadBuildingGen(wasmData).then((instance) => {
        buildingGenLoading = null;
        buildingGen = instance;
        return buildingGen;
    }).catch((error) => {
        warnOnce('Could not load building-gen');
        buildingGenLoading = null;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        buildingGenError = error;
    });
    return buildingGenLoading;
}

export function getBuildingGen(): BuildingGen {
    return buildingGen;
}

export const GLTF_BYTE = 5120;
export const GLTF_UBYTE = 5121;
export const GLTF_SHORT = 5122;
export const GLTF_USHORT = 5123;
export const GLTF_UINT = 5125;
export const GLTF_FLOAT = 5126;

export const GLTF_TO_ARRAY_TYPE: {
    [type: number]: Class<ArrayBufferView>;
} = {
    [GLTF_BYTE]: Int8Array,
    [GLTF_UBYTE]: Uint8Array,
    [GLTF_SHORT]: Int16Array,
    [GLTF_USHORT]: Uint16Array,
    [GLTF_UINT]: Uint32Array,
    [GLTF_FLOAT]: Float32Array
};

const GLTF_TO_DRACO_TYPE = {
    [GLTF_BYTE]: 'DT_INT8',
    [GLTF_UBYTE]: 'DT_UINT8',
    [GLTF_SHORT]: 'DT_INT16',
    [GLTF_USHORT]: 'DT_UINT16',
    [GLTF_UINT]: 'DT_UINT32',
    [GLTF_FLOAT]: 'DT_FLOAT32'
};

export const GLTF_COMPONENTS = {
    SCALAR: 1,
    VEC2: 2,
    VEC3: 3,
    VEC4: 4,
    MAT2: 4,
    MAT3: 9,
    MAT4: 16
} as const;

type GLTFAccessor = {
    count: number;
    type: string;
    componentType: number;
    bufferView?: number;
};

type GLTFPrimitive = {
    indices: number;
    attributes: {
        [id: string]: number;
    };
    extensions: {
        KHR_draco_mesh_compression?: {
            bufferView: number;
            attributes: {
                [id: string]: number;
            };
        };
    };
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function setAccessorBuffer(buffer: ArrayBuffer, accessor: GLTFAccessor, gltf: any) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const bufferViewIndex = gltf.json.bufferViews.length;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const bufferIndex = gltf.buffers.length;

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    accessor.bufferView = bufferViewIndex;

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    gltf.json.bufferViews[bufferViewIndex] = {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        buffer: bufferIndex,
        byteLength: buffer.byteLength
    };
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    gltf.buffers[bufferIndex] = buffer;
}

const DRACO_EXT = 'KHR_draco_mesh_compression';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function loadDracoMesh(primitive: GLTFPrimitive, gltf: any) {
    const config = primitive.extensions && primitive.extensions[DRACO_EXT];
    if (!config) return;

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const decoder = new draco.Decoder();
    const bytes = getGLTFBytes(gltf, config.bufferView);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const mesh = new draco.Mesh();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const ok = decoder.DecodeArrayToMesh(bytes, bytes.byteLength, mesh);
    if (!ok) throw new Error('Failed to decode Draco mesh');

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const indexAccessor = gltf.json.accessors[primitive.indices];
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const IndexArrayType = GLTF_TO_ARRAY_TYPE[indexAccessor.componentType];
    // @ts-expect-error - TS2339 - Property 'BYTES_PER_ELEMENT' does not exist on type 'Class<ArrayBufferView>'.
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const indicesSize = indexAccessor.count * IndexArrayType.BYTES_PER_ELEMENT;

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const ptr = draco._malloc(indicesSize);
    if (IndexArrayType === Uint16Array) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        decoder.GetTrianglesUInt16Array(mesh, indicesSize, ptr);
    } else {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        decoder.GetTrianglesUInt32Array(mesh, indicesSize, ptr);
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const indicesBuffer = draco.memory.buffer.slice(ptr, ptr + indicesSize);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    setAccessorBuffer(indicesBuffer, indexAccessor, gltf);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    draco._free(ptr);

    for (const attributeId of Object.keys(config.attributes)) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        const attribute = decoder.GetAttributeByUniqueId(mesh, config.attributes[attributeId]);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        const accessor = gltf.json.accessors[primitive.attributes[attributeId]];
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const ArrayType = GLTF_TO_ARRAY_TYPE[accessor.componentType];
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        const dracoTypeName = GLTF_TO_DRACO_TYPE[accessor.componentType];

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        const numComponents = GLTF_COMPONENTS[accessor.type];
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const numValues = accessor.count * numComponents;
        // @ts-expect-error - TS2339 - Property 'BYTES_PER_ELEMENT' does not exist on type 'Class<ArrayBufferView>'.
        const dataSize = numValues * ArrayType.BYTES_PER_ELEMENT;

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        const ptr = draco._malloc(dataSize);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        decoder.GetAttributeDataArrayForAllPoints(mesh, attribute, draco[dracoTypeName], dataSize, ptr);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        const buffer = draco.memory.buffer.slice(ptr, ptr + dataSize);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        setAccessorBuffer(buffer, accessor, gltf);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        draco._free(ptr);
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    decoder.destroy();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    mesh.destroy();

    delete primitive.extensions[DRACO_EXT];
}

const MESHOPT_EXT = 'EXT_meshopt_compression';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function loadMeshoptBuffer(bufferView: any, gltf: any) {

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (!(bufferView.extensions && bufferView.extensions[MESHOPT_EXT])) return;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const config = bufferView.extensions[MESHOPT_EXT];
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const byteOffset = config.byteOffset || 0;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const byteLength = config.byteLength || 0;

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const buffer = gltf.buffers[config.buffer];
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const source = new Uint8Array(buffer, byteOffset, byteLength);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const target = new Uint8Array(config.count * config.byteStride);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    meshopt.decodeGltfBuffer(target, config.count, config.byteStride, source, config.mode, config.filter);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    bufferView.buffer = gltf.buffers.length;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    bufferView.byteOffset = 0;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    gltf.buffers[bufferView.buffer] = target.buffer;

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    delete bufferView.extensions[MESHOPT_EXT];
}

const MAGIC_GLTF = 0x46546C67;
const GLB_CHUNK_TYPE_JSON = 0x4E4F534A;
const GLB_CHUNK_TYPE_BIN = 0x004E4942;

const textDecoder = new TextDecoder('utf8');

function resolveUrl(url: string, baseUrl?: string) {
    return (new URL(url, baseUrl)).href;
}

function loadBuffer(buffer: {
    uri: string;
    byteLength: number;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
}, gltf: any, index: number, baseUrl?: string) {
    return fetch(resolveUrl(buffer.uri, baseUrl))
        .then(response => response.arrayBuffer())
        .then(arrayBuffer => {
            assert(arrayBuffer.byteLength >= buffer.byteLength);
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            gltf.buffers[index] = arrayBuffer;
        });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getGLTFBytes(gltf: any, bufferViewIndex: number): Uint8Array {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const bufferView = gltf.json.bufferViews[bufferViewIndex];
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const buffer = gltf.buffers[bufferView.buffer];
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
    return new Uint8Array(buffer, bufferView.byteOffset || 0, bufferView.byteLength);
}

function loadImage(img: {
    uri?: string;
    bufferView?: number;
    mimeType: string;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
}, gltf: any, index: number, baseUrl?: string) {
    if (img.uri) {
        const uri = resolveUrl(img.uri, baseUrl);
        return fetch(uri)
            .then(response => response.blob())
            .then(blob => createImageBitmap(blob))
            .then(imageBitmap => {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                gltf.images[index] = imageBitmap;
            });
    } else if (img.bufferView !== undefined) {
        const bytes = getGLTFBytes(gltf, img.bufferView);
        const blob = new Blob([bytes], {type: img.mimeType});
        return createImageBitmap(blob)
            .then(imageBitmap => {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                gltf.images[index] = imageBitmap;
            });
    }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function decodeGLTF(arrayBuffer: ArrayBuffer, byteOffset: number = 0, baseUrl?: string): any {
    const gltf = {json: null, images: [], buffers: []};

    if (new Uint32Array(arrayBuffer, byteOffset, 1)[0] === MAGIC_GLTF) {
        const view = new Uint32Array(arrayBuffer, byteOffset);
        assert(view[1] === 2);

        let pos = 2;
        const glbLen = (view[pos++] >> 2) - 3;
        const jsonLen = view[pos++] >> 2;
        const jsonType = view[pos++];
        assert(jsonType === GLB_CHUNK_TYPE_JSON);

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        gltf.json = JSON.parse(textDecoder.decode(view.subarray(pos, pos + jsonLen)));
        pos += jsonLen;

        if (pos < glbLen) {
            const byteLength = view[pos++];
            const binType = view[pos++];
            assert(binType === GLB_CHUNK_TYPE_BIN);
            const start = byteOffset + (pos << 2);
            gltf.buffers[0] = arrayBuffer.slice(start, start + byteLength);
        }

    } else {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        gltf.json = JSON.parse(textDecoder.decode(new Uint8Array(arrayBuffer, byteOffset)));
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const {buffers, images, meshes, extensionsUsed, bufferViews} = (gltf.json);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let bufferLoadsPromise: Promise<any> = Promise.resolve();
    if (buffers) {
        const bufferLoads = [];
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        for (let i = 0; i < buffers.length; i++) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            const buffer = buffers[i];
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            if (buffer.uri) {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                bufferLoads.push(loadBuffer(buffer, gltf, i, baseUrl));

            } else if (!gltf.buffers[i]) {
                gltf.buffers[i] = null;
            }
        }
        bufferLoadsPromise = Promise.all(bufferLoads);
    }

    return bufferLoadsPromise.then(() => {
        const assetLoads = [];

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        const dracoUsed = extensionsUsed && extensionsUsed.includes(DRACO_EXT);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        const meshoptUsed = extensionsUsed && extensionsUsed.includes(MESHOPT_EXT);
        if (dracoUsed) {
            assetLoads.push(waitForDraco());
        }

        if (meshoptUsed) {
            assetLoads.push(waitForMeshopt());
        }
        if (images) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            for (let i = 0; i < images.length; i++) {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
                assetLoads.push(loadImage(images[i], gltf, i, baseUrl));
            }
        }

        const assetLoadsPromise = assetLoads.length ?
            Promise.all(assetLoads) :
            Promise.resolve();

        return assetLoadsPromise.then(() => {
            if (dracoUsed && meshes) {
                for (const {primitives} of meshes) {
                    for (const primitive of primitives) {
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                        loadDracoMesh(primitive, gltf);
                    }
                }
            }

            if (meshoptUsed && meshes && bufferViews) {
                for (const bufferView of bufferViews) {
                    loadMeshoptBuffer(bufferView, gltf);
                }
            }

            return gltf;
        });
    });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function loadGLTF(url: string): Promise<any> {
    return fetch(url)
        .then(response => response.arrayBuffer())
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        .then(buffer => decodeGLTF(buffer, 0, url));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function load3DTile(data: ArrayBuffer): Promise<any> {
    const magic = new Uint32Array(data, 0, 1)[0];
    let gltfOffset = 0;
    if (magic !== MAGIC_GLTF) {
        const header = new Uint32Array(data, 0, 7);
        const [/*magic*/, /*version*/, byteLen, featureTableJsonLen, featureTableBinLen, batchTableJsonLen/*, batchTableBinLen*/] = header;
        gltfOffset = header.byteLength + featureTableJsonLen + featureTableBinLen + batchTableJsonLen + featureTableBinLen;
        if (byteLen !== data.byteLength || gltfOffset >= data.byteLength) {
            warnOnce('Invalid b3dm header information.');
        }
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return decodeGLTF(data, gltfOffset);
}
