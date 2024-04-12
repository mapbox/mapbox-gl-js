// @flow
/* eslint-disable new-cap */

import config from '../../src/util/config.js';
import browser from '../../src/util/browser.js';
import Dispatcher from '../../src/util/dispatcher.js';
import getWorkerPool from '../../src/util/global_worker_pool.js';
import {Evented} from '../../src/util/evented.js';
import {isWorker, warnOnce} from '../../src/util/util.js';
import assert from 'assert';
import {DracoDecoderModule} from './draco_decoder_gltf.js';
import {MeshoptDecoder} from './meshopt_decoder.js';

import type {Class} from '../../src/types/class.js';

let dispatcher = null;

let dracoLoading: Promise<any> | void;
let dracoUrl: ?string;
let draco: any;
let meshoptUrl: ?string;
let meshopt: any;

export function getDracoUrl(): string {
    if (isWorker() && self.worker && self.worker.dracoUrl) {
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
    if (dracoLoading) return dracoLoading;

    dracoLoading = DracoDecoderModule(fetch(getDracoUrl()));

    return dracoLoading.then((module) => {
        draco = module;
        dracoLoading = undefined;
    });
}

export function getMeshoptUrl(): string {
    if (isWorker() && self.worker && self.worker.meshoptUrl) {
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

export const GLTF_BYTE = 5120;
export const GLTF_UBYTE = 5121;
export const GLTF_SHORT = 5122;
export const GLTF_USHORT = 5123;
export const GLTF_UINT = 5125;
export const GLTF_FLOAT = 5126;

export const GLTF_TO_ARRAY_TYPE: {[type: number]: Class<$TypedArray>} = {
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
};

type GLTFAccessor = {
    count: number;
    type: string;
    componentType: number;
    bufferView?: number;
};

type GLTFPrimitive = {
    indices: number;
    attributes: {[id: string]: number};
    extensions: {
        KHR_draco_mesh_compression?: {
            bufferView: number;
            attributes: {[id: string]: number};
        }
    };
};

function setAccessorBuffer(buffer: ArrayBuffer, accessor: GLTFAccessor, gltf: any) {
    const bufferViewIndex = gltf.json.bufferViews.length;
    const bufferIndex = gltf.buffers.length;

    accessor.bufferView = bufferViewIndex;

    gltf.json.bufferViews[bufferViewIndex] = {
        buffer: bufferIndex,
        byteLength: buffer.byteLength
    };
    gltf.buffers[bufferIndex] = buffer;
}

const DRACO_EXT = 'KHR_draco_mesh_compression';

function loadDracoMesh(primitive: GLTFPrimitive, gltf: any) {
    const config = primitive.extensions && primitive.extensions[DRACO_EXT];
    if (!config) return;

    const decoder = new draco.Decoder();
    const bytes = getGLTFBytes(gltf, config.bufferView);

    const mesh = new draco.Mesh();
    const ok = decoder.DecodeArrayToMesh(bytes, bytes.byteLength, mesh);
    if (!ok) throw new Error('Failed to decode Draco mesh');

    const indexAccessor = gltf.json.accessors[primitive.indices];
    const IndexArrayType = GLTF_TO_ARRAY_TYPE[indexAccessor.componentType];
    const indicesSize = indexAccessor.count * IndexArrayType.BYTES_PER_ELEMENT;

    const ptr = draco._malloc(indicesSize);
    if (IndexArrayType === Uint16Array) {
        decoder.GetTrianglesUInt16Array(mesh, indicesSize, ptr);
    } else {
        decoder.GetTrianglesUInt32Array(mesh, indicesSize, ptr);
    }
    const indicesBuffer = draco.memory.buffer.slice(ptr, ptr + indicesSize);
    setAccessorBuffer(indicesBuffer, indexAccessor, gltf);
    draco._free(ptr);

    for (const attributeId of Object.keys(config.attributes)) {
        const attribute = decoder.GetAttributeByUniqueId(mesh, config.attributes[attributeId]);
        const accessor = gltf.json.accessors[primitive.attributes[attributeId]];
        const ArrayType = GLTF_TO_ARRAY_TYPE[accessor.componentType];
        const dracoTypeName = GLTF_TO_DRACO_TYPE[accessor.componentType];

        const numComponents = GLTF_COMPONENTS[accessor.type];
        const numValues = accessor.count * numComponents;
        const dataSize = numValues * ArrayType.BYTES_PER_ELEMENT;

        const ptr = draco._malloc(dataSize);
        decoder.GetAttributeDataArrayForAllPoints(mesh, attribute, draco[dracoTypeName], dataSize, ptr);
        const buffer = draco.memory.buffer.slice(ptr, ptr + dataSize);
        setAccessorBuffer(buffer, accessor, gltf);
        draco._free(ptr);
    }

    decoder.destroy();
    mesh.destroy();

    delete primitive.extensions[DRACO_EXT];
}

const MESHOPT_EXT = 'EXT_meshopt_compression';

function loadMeshoptBuffer(bufferView: any, gltf: any) {

    if (!(bufferView.extensions && bufferView.extensions[ MESHOPT_EXT ])) return;
    const config = bufferView.extensions[ MESHOPT_EXT ];
    const byteOffset = config.byteOffset || 0;
    const byteLength = config.byteLength || 0;

    const buffer = gltf.buffers[config.buffer];
    const source = new Uint8Array(buffer, byteOffset, byteLength);
    const target = new Uint8Array(config.count * config.byteStride);
    meshopt.decodeGltfBuffer(target, config.count, config.byteStride, source, config.mode, config.filter);
    bufferView.buffer = gltf.buffers.length;
    bufferView.byteOffset = 0;
    gltf.buffers[bufferView.buffer] = target.buffer;

    delete bufferView.extensions[MESHOPT_EXT];
}

const MAGIC_GLTF = 0x46546C67;
const GLB_CHUNK_TYPE_JSON = 0x4E4F534A;
const GLB_CHUNK_TYPE_BIN = 0x004E4942;

const textDecoder = new TextDecoder('utf8');

function resolveUrl(url: string, baseUrl?: string) {
    return (new URL(url, baseUrl)).href;
}

function loadBuffer(buffer: {uri: string, byteLength: number}, gltf: any, index: number, baseUrl?: string) {
    return fetch(resolveUrl(buffer.uri, baseUrl))
        .then(response => response.arrayBuffer())
        .then(arrayBuffer => {
            assert(arrayBuffer.byteLength >= buffer.byteLength);
            gltf.buffers[index] = arrayBuffer;
        });
}

function getGLTFBytes(gltf: any, bufferViewIndex: number): Uint8Array {
    const bufferView = gltf.json.bufferViews[bufferViewIndex];
    const buffer = gltf.buffers[bufferView.buffer];
    return new Uint8Array(buffer, bufferView.byteOffset || 0, bufferView.byteLength);
}

function loadImage(img: {uri?: string, bufferView?: number, mimeType: string}, gltf: any, index: number, baseUrl?: string) {
    if (img.uri) {
        const uri = resolveUrl(img.uri, baseUrl);
        return fetch(uri)
            .then(response => response.blob())
            // $FlowFixMe https://github.com/facebook/flow/pull/7483
            .then(blob => createImageBitmap(blob))
            .then(imageBitmap => {
                gltf.images[index] = imageBitmap;
            });
    } else if (img.bufferView !== undefined) {
        const bytes = getGLTFBytes(gltf, img.bufferView);
        const blob = new Blob([bytes], {type: img.mimeType});
        return createImageBitmap(blob)
            .then(imageBitmap => {
                gltf.images[index] = imageBitmap;
            });
    }
}

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
        gltf.json = JSON.parse(textDecoder.decode(new Uint8Array(arrayBuffer, byteOffset)));
    }

    const {buffers, images, meshes, extensionsUsed, bufferViews} = (gltf.json: any);
    let bufferLoadsPromise: Promise<any> = Promise.resolve();
    if (buffers) {
        const bufferLoads = [];
        for (let i = 0; i < buffers.length; i++) {
            const buffer = buffers[i];
            if (buffer.uri) {
                bufferLoads.push(loadBuffer(buffer, gltf, i, baseUrl));

            } else if (!gltf.buffers[i]) {
                gltf.buffers[i] = null;
            }
        }
        bufferLoadsPromise = Promise.all(bufferLoads);
    }

    return bufferLoadsPromise.then(() => {
        const assetLoads = [];

        const dracoUsed = extensionsUsed && extensionsUsed.includes(DRACO_EXT);
        const meshoptUsed = extensionsUsed && extensionsUsed.includes(MESHOPT_EXT);
        if (dracoUsed) {
            assetLoads.push(waitForDraco());
        }

        if (meshoptUsed) {
            assetLoads.push(waitForMeshopt());
        }
        if (images) {
            for (let i = 0; i < images.length; i++) {
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

export function loadGLTF(url: string): Promise<any> {
    return fetch(url)
        .then(response => response.arrayBuffer())
        .then(buffer => decodeGLTF(buffer, 0, url));
}

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
    return decodeGLTF(data, gltfOffset);
}
