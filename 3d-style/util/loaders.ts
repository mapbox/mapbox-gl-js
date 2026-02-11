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
import {PerformanceUtils} from '../../src/util/performance';
import {makeAsyncRequest} from '../../src/util/ajax';

import type {vec3, mat4, quat} from 'gl-matrix';
import type {BuildingGen} from './building_gen';
import type {TextureImage} from '../../src/render/texture';
import type {MaterialDescription, Sampler} from '../data/model';

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
    const startTime = PerformanceUtils.now();

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    dracoLoading = DracoDecoderModule(fetch(getDracoUrl()));

    return dracoLoading.then((module) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        draco = module;
        dracoLoading = undefined;
        PerformanceUtils.measureWithDetails(PerformanceUtils.GROUP_COMMON, "waitForDraco", "Models", startTime);
    });
}

export function getMeshoptUrl(): string {
    if (isWorker(self) && self.worker.meshoptUrl) {
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
    const startTime = PerformanceUtils.now();
    const decoder = MeshoptDecoder(fetch(getMeshoptUrl()));
    return decoder.ready.then(() => {
        PerformanceUtils.measureWithDetails(PerformanceUtils.GROUP_COMMON, "waitForMeshopt", "Models", startTime);
        meshopt = decoder;
    });
}

export function waitForBuildingGen(): Promise<unknown> {
    if (buildingGen != null || buildingGenError != null) return null;
    if (buildingGenLoading != null) return buildingGenLoading;
    const m = PerformanceUtils.now();
    const wasmData = fetch(config.BUILDING_GEN_URL);
    buildingGenLoading = loadBuildingGen(wasmData).then((instance) => {
        buildingGenLoading = null;
        buildingGen = instance;
        PerformanceUtils.measureWithDetails(PerformanceUtils.GROUP_COMMON, "waitForBuildingGen", "BuildingBucket", m);
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
    [type: number]: Int8ArrayConstructor | Uint8ArrayConstructor | Int16ArrayConstructor | Uint16ArrayConstructor | Uint32ArrayConstructor | Float32ArrayConstructor;
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

export type GLTFAccessor = {
    count: number;
    type: 'SCALAR' | 'VEC2' | 'VEC3' | 'VEC4' | 'MAT2' | 'MAT3' | 'MAT4';
    componentType: number;
    bufferView?: number;
    byteOffset?: number;
    min?: vec3;
    max?: vec3;
};

export type GLTFPrimitive = {
    material?: number;
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

type Extension = {
    buffer: number;
    byteLength: number;
    byteOffset: number;
    byteStride: number;
    count: number;
    filter: string;
    mode: 'ATTRIBUTES';
};

type GLTFBufferView = {
    buffer: number;
    byteOffset?: number;
    byteLength: number;
    byteStride?: number;
    extensions?: Record<string, Extension>;
};

export type GLTFNode = {
    matrix: mat4;
    rotation: quat;
    translation: vec3;
    scale: vec3;
    mesh: number;
    extras: Record<string, unknown>;
    children: number[];
    name?: string;
};

export type GLTF = {
    json?: {
        accessors: GLTFAccessor[];
        asset?: {extras: Record<string, boolean>};
        buffers?: Array<{uri: string; byteLength: number}>;
        bufferViews: GLTFBufferView[];
        extensionsUsed?: string[];
        images?: Array<{uri?: string; bufferView?: number; mimeType: string}>;
        materials: MaterialDescription[];
        meshes?: Array<{primitives: GLTFPrimitive[]}>;
        nodes: GLTFNode[];
        samplers?: Sampler[];
        scene: number;
        scenes?: Array<{name?: string; nodes: number[]}>;
        textures?: Array<{source?: number; sampler?: number}>;
    };
    images: TextureImage[];
    buffers: ArrayBuffer[];
};

function setAccessorBuffer(buffer: ArrayBuffer, accessor: GLTFAccessor, gltf: GLTF) {
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

function loadDracoMesh(primitive: GLTFPrimitive, gltf: GLTF) {
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

    const indexAccessor = gltf.json.accessors[primitive.indices];
    const IndexArrayType = GLTF_TO_ARRAY_TYPE[indexAccessor.componentType];
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
        const accessor = gltf.json.accessors[primitive.attributes[attributeId]];
        const ArrayType = GLTF_TO_ARRAY_TYPE[accessor.componentType];
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const dracoTypeName = GLTF_TO_DRACO_TYPE[accessor.componentType];

        const numComponents = GLTF_COMPONENTS[accessor.type];

        const numValues = accessor.count * numComponents;
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

function loadMeshoptBuffer(bufferView: GLTFBufferView, gltf: GLTF) {
    if (!(bufferView.extensions && bufferView.extensions[MESHOPT_EXT])) return;
    const config = bufferView.extensions[MESHOPT_EXT];

    const byteOffset = config.byteOffset || 0;
    const byteLength = config.byteLength || 0;

    const buffer = gltf.buffers[config.buffer];

    const source = new Uint8Array(buffer, byteOffset, byteLength);

    const target = new Uint8Array(config.count * config.byteStride);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
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

async function loadBuffer(buffer: {uri: string; byteLength: number}, gltf: GLTF, index: number, baseUrl?: string, signal?: AbortSignal): Promise<void> {
    const response = await fetch(resolveUrl(buffer.uri, baseUrl), {signal});
    const arrayBuffer = await response.arrayBuffer();
    assert(arrayBuffer.byteLength >= buffer.byteLength);
    gltf.buffers[index] = arrayBuffer;
}

function getGLTFBytes(gltf: GLTF, bufferViewIndex: number): Uint8Array<ArrayBuffer> {
    const bufferView = gltf.json.bufferViews[bufferViewIndex];
    const buffer = gltf.buffers[bufferView.buffer];
    return new Uint8Array<ArrayBuffer>(buffer, bufferView.byteOffset || 0, bufferView.byteLength);
}

async function loadImage(img: {uri?: string; bufferView?: number; mimeType: string}, gltf: GLTF, index: number, baseUrl?: string, signal?: AbortSignal): Promise<void> {
    if (img.uri) {
        const uri = resolveUrl(img.uri, baseUrl);
        const response = await fetch(uri, {signal});
        const blob = await response.blob();
        const imageBitmap = await createImageBitmap(blob);
        gltf.images[index] = imageBitmap;
    } else if (img.bufferView !== undefined) {
        const bytes = getGLTFBytes(gltf, img.bufferView);
        const blob = new Blob([bytes], {type: img.mimeType});
        const imageBitmap = await createImageBitmap(blob);
        gltf.images[index] = imageBitmap;
    }
}

export async function decodeGLTF(arrayBuffer: ArrayBuffer, byteOffset: number = 0, baseUrl?: string, signal?: AbortSignal): Promise<GLTF> {
    const startTime = PerformanceUtils.now();

    const gltf: GLTF = {json: null, images: [], buffers: []};

    if (new Uint32Array(arrayBuffer, byteOffset, 1)[0] === MAGIC_GLTF) {
        const view = new Uint32Array(arrayBuffer, byteOffset);
        assert(view[1] === 2);

        let pos = 2;
        const glbLen = (view[pos++] >> 2) - 3;
        const jsonLen = view[pos++] >> 2;
        const jsonType = view[pos++];
        assert(jsonType === GLB_CHUNK_TYPE_JSON);

        gltf.json = JSON.parse(textDecoder.decode(view.subarray(pos, pos + jsonLen))) as GLTF['json'];
        pos += jsonLen;

        if (pos < glbLen) {
            const byteLength = view[pos++];
            const binType = view[pos++];
            assert(binType === GLB_CHUNK_TYPE_BIN);
            const start = byteOffset + (pos << 2);
            gltf.buffers[0] = arrayBuffer.slice(start, start + byteLength);
        }
    } else {
        gltf.json = JSON.parse(textDecoder.decode(new Uint8Array(arrayBuffer, byteOffset))) as GLTF['json'];
    }

    const {buffers, images, meshes, extensionsUsed, bufferViews} = gltf.json;

    if (buffers) {
        const bufferLoads: Promise<void>[] = [];
        for (let i = 0; i < buffers.length; i++) {
            const buffer = buffers[i];
            if (buffer.uri) {
                bufferLoads.push(loadBuffer(buffer, gltf, i, baseUrl, signal));
            } else if (!gltf.buffers[i]) {
                gltf.buffers[i] = null;
            }
        }
        await Promise.all(bufferLoads);
    }

    if (signal && signal.aborted) throw new DOMException('Aborted', 'AbortError');

    const assetLoads: Promise<unknown>[] = [];
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
            assetLoads.push(loadImage(images[i], gltf, i, baseUrl, signal));
        }
    }

    if (assetLoads.length) {
        await Promise.all(assetLoads);
    }

    if (signal && signal.aborted) throw new DOMException('Aborted', 'AbortError');

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

    PerformanceUtils.measureWithDetails(PerformanceUtils.GROUP_COMMON, "decodeGLTF", "Models", startTime);

    return gltf;
}

export async function loadGLTF(url: string, signal?: AbortSignal): Promise<GLTF> {
    const buffer = await makeAsyncRequest<ArrayBuffer>({url, type: 'arrayBuffer'}, signal);
    return decodeGLTF(buffer, 0, url, signal);
}

export function load3DTile(data: ArrayBuffer): Promise<GLTF> {
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
