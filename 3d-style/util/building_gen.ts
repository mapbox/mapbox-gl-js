export type Style = {
    normalScale: number[],
    tileToMeters: number
};

export type Feature = {
    coordinates: number[],
    ringIndices: number[],
    height: number,
    id: number,
    minHeight: number,
    roofType: RoofType,
    sourceId: number
};

export type Facade = {
    coordinates: number[],
    crossPerc: number,
    distanceToRoad: number,
    entrances: string,
    sourceId: number
};

export interface MeshBuffer {
    positions?: Float32Array;
    normals?: Float32Array;
    ao?: Float32Array;
    uv?: Float32Array;
    isFauxFacade?: Uint8Array;
    indices?: Int16Array;
    buildingPart?: BuildingPart;
}

export interface MeshCollection {
    meshes: MeshBuffer[];
    outerRingLength: number;
    modifiedPolygonRings: Float32Array[];
}

// Roof type constants - these must match the enum in the building generation library
export const ROOF_TYPE_PARAPET = 0;
export const ROOF_TYPE_HIPPED = 1;
export const ROOF_TYPE_GABLED = 2;
export const ROOF_TYPE_FLAT = 3;
export const ROOF_TYPE_MANSARD = 4;
export const ROOF_TYPE_SKILLION = 5;
export const ROOF_TYPE_PYRAMIDAL = 6;
export type RoofType = number;

// Building part constants - these must match the enum in the building generation library
export const BUILDING_PART_WALL = 0;
export const BUILDING_PART_ROOF = 1;
export const BUILDING_PART_FACADE_GLAZING = 2;
export const BUILDING_PART_ENTRANCE = 3;
export type BuildingPart = number;

const MEMORY_STACK_SIZE = 1024 * 4;
export class BuildingGen {
    module: BuildingGenModule;
    memoryStack: number;
    memoryStackNextFree: number;

    constructor(module: BuildingGenModule) {
        this.module = module;
        this.memoryStack = this.module.malloc(MEMORY_STACK_SIZE);
        this.memoryStackNextFree = this.memoryStack;
    }

    createIntArray(data: ArrayLike<number>): number {
        const positionsPtr = this.memoryStackNextFree;
        this.memoryStackNextFree += data.length * Int32Array.BYTES_PER_ELEMENT;
        if (this.memoryStackNextFree - this.memoryStack > MEMORY_STACK_SIZE) {
            return -1;
        }
        const positionsArray = new Int32Array(this.module.heap32.buffer, positionsPtr, data.length);
        positionsArray.set(data);

        return positionsPtr;
    }

    createFloatArray(data: ArrayLike<number>): number {
        const positionsPtr = this.memoryStackNextFree;
        this.memoryStackNextFree += data.length * Float32Array.BYTES_PER_ELEMENT;
        if (this.memoryStackNextFree - this.memoryStack > MEMORY_STACK_SIZE) {
            return -1;
        }
        const positionsArray = new Float32Array(this.module.heapF32.buffer, positionsPtr, data.length);
        positionsArray.set(data);

        return positionsPtr;
    }

    readStringBuffer(ptr: number): string {
        let str = '';
        while (this.module.heapU8[ptr] !== 0) {
            str += String.fromCharCode(this.module.heapU8[ptr]);
            ++ptr;
        }
        return str;
    }

    setStyle(style: Style) {
        const normalScale = style.normalScale;
        this.module.setStyle(
            normalScale[0], normalScale[1], normalScale[2],
            style.tileToMeters);
    }

    setAOOptions(bakeToVertices: boolean, parapetOcclusionDistance: number) {
        this.module.setAOOptions(bakeToVertices ? 1 : 0, parapetOcclusionDistance);
    }

    setMetricOptions(convertToMeters: boolean, tileZoom: number) {
        this.module.setMetricOptions(convertToMeters ? 1 : 0, tileZoom);
    }

    setStructuralOptions(simplifyInput: boolean) {
        this.module.setStructuralOptions(simplifyInput ? 1 : 0);
    }

    setFacadeOptions(facadeHeight: number, createEaves: boolean) {
        this.module.setFacadeOptions(facadeHeight, createEaves ? 1 : 0);
    }

    setFauxFacadeOptions(hasFacade: boolean, useUvXModifier: boolean, uvXModifier: number) {
        this.module.setFauxFacadeOptions(hasFacade ? 1 : 0, useUvXModifier ? 1 : 0, uvXModifier);
    }

    setFacadeClassifierOptions(classificationDistance: number) {
        this.module.setFacadeClassifierOptions(classificationDistance);
    }

    generateMesh(features: Feature[], facades: Facade[]): MeshCollection | string {
        this.memoryStackNextFree = this.memoryStack;
        for (const feature of features) {
            const ringIndexPointer = this.createIntArray(feature.ringIndices);
            const coordinatesPointer = this.createFloatArray(feature.coordinates);
            if (ringIndexPointer === -1 || coordinatesPointer === -1) {
                return `building_gen: Out of stack memory: ${this.memoryStackNextFree - this.memoryStack}/${MEMORY_STACK_SIZE}`;
            }
            this.module.addFeature(feature.id, feature.sourceId,
                feature.minHeight, feature.height,
                feature.roofType,
                coordinatesPointer, ringIndexPointer, feature.ringIndices.length - 1);
        }

        for (const facade of facades) {
            let entrances: number[];
            if (facade.entrances) {
                entrances = JSON.parse(facade.entrances) as number[];
            } else {
                entrances = [];
            }
            const entrancesPointer = this.createFloatArray(entrances);
            const coordinatesPointer = this.createFloatArray(facade.coordinates);

            if (entrancesPointer === -1 || coordinatesPointer === -1) {
                return `building_gen: Out of stack memory: ${this.memoryStackNextFree - this.memoryStack}/${MEMORY_STACK_SIZE}`;
            }

            this.module.addFacade(facade.sourceId, facade.crossPerc, facade.distanceToRoad,
                entrancesPointer, entrances.length,
                coordinatesPointer, facade.coordinates.length);
        }

        const success = this.module.generateMesh();

        if (!success) {
            const errorPtr = this.module.getLastError();
            return this.readStringBuffer(errorPtr);
        }

        const meshCount = this.module.getMeshCount();
        const meshes = new Array<MeshBuffer>(meshCount);
        for (let i = 0; i < meshCount; i++) {
            const positionsPtr = this.module.getPositionsPtr(i);
            const positionsLength = this.module.getPositionsLength(i);
            const positionsArray = new Float32Array(this.module.heapF32.buffer, positionsPtr, positionsLength);

            const normalsPtr = this.module.getNormalsPtr(i);
            const normalsLength = this.module.getNormalsLength(i);
            const normalsArray = new Float32Array(this.module.heapF32.buffer, normalsPtr, normalsLength);

            const aoPtr = this.module.getAOPtr(i);
            const aoLength = this.module.getAOLength(i);
            const aoArray = new Float32Array(this.module.heapF32.buffer, aoPtr, aoLength);

            const uvPtr = this.module.getUVPtr(i);
            const uvLength = this.module.getUVLength(i);
            const uvArray = new Float32Array(this.module.heapF32.buffer, uvPtr, uvLength);

            const fauxFacadePtr = this.module.getFauxFacadePtr(i);
            const fauxFacadeLength = this.module.getFauxFacadeLength(i);
            const isFauxFacadeArray = new Uint8Array(this.module.heapU8.buffer, fauxFacadePtr, fauxFacadeLength);

            const indicesPtr = this.module.getIndicesPtr(i);
            const indicesLength = this.module.getIndicesLength(i);
            const indicesArray = new Int16Array(this.module.heap16.buffer, indicesPtr, indicesLength);

            const buildingPart = this.module.getBuildingPart(i);

            meshes[i] = {
                positions: positionsArray,
                normals: normalsArray,
                ao: aoArray,
                uv: uvArray,
                isFauxFacade: isFauxFacadeArray,
                indices: indicesArray,
                buildingPart
            };
        }

        const ringCount = this.module.getRingCount();
        const modifiedPolygonRings: Float32Array[] = [];

        for (let i = 0; i < ringCount; i++) {
            const ringPtr = this.module.getRingPtr(i);
            const ringLength = this.module.getRingLength(i);
            const ringArray = new Float32Array(this.module.heapF32.buffer, ringPtr, ringLength);
            modifiedPolygonRings.push(ringArray);
        }

        const outerRingLength = this.module.getOuterRingLength();
        return {meshes, outerRingLength, modifiedPolygonRings};
    }
}

type SetStyleFunction = (
    normalScaleX: number, normalScaleY: number, normalScaleZ: number,
    tileToMeters: number) => void;
type SetAOOptionsFunction = (bakeToVertices: number, parapetOcclusionDistance: number) => void;
type SetMetricOptionsFunction = (convertToMeters: number, tileZoom: number) => void;
type SetStructuralOptionsFunction = (simplifyInput: number) => void;
type SetFacadeOptionsFunction = (facadeHeight: number, createEaves: number) => void;
type SetFauxFacadeOptionsFunction = (hasFacade: number, useUvXModifier: number, uvXModifier: number) => void;
type SetFacadeClassifierOptionsFunction = (classificationDistance: number) => void;
type AddFeatureFunction = (id: number, sourceId: number, minHeight: number, height: number, roofShape: number,
                           coords: number, ringIndices: number, numRings: number) => void;
type AddFacadeFunction = (id: number, crossPerc: number, distanceToRoad: number, entrances: number, entrancesLength: number,
                          coords: number, numCoords: number) => void;
type GenerateMeshFunction = () => number;
type GetLastErrorFunction = () => number;
type GetOuterRingLengthFunction = () => number;
type GetMeshCountFunction = () => number;
type GetPositionsPtrFunction = (meshIndex: number) => number;
type GetPositionsLengthFunction = (meshIndex: number) => number;
type GetNormalsPtrFunction = (meshIndex: number) => number;
type GetNormalsLengthFunction = (meshIndex: number) => number;
type GetAOPtrFunction = (meshIndex: number) => number;
type GetAOLengthFunction = (meshIndex: number) => number;
type GetUVPtrFunction = (meshIndex: number) => number;
type GetUVLengthFunction = (meshIndex: number) => number;
type GetFauxFacadePtrFunction = (meshIndex: number) => number;
type GetFauxFacadeLengthFunction = (meshIndex: number) => number;
type GetIndicesPtrFunction = (meshIndex: number) => number;
type GetIndicesLengthFunction = (meshIndex: number) => number;
type GetBuildingPartFunction = (meshIndex: number) => number;
type GetRingCountFunction = () => number;
type GetRingPtrFunction = (ringIndex: number) => number;
type GetRingLengthFunction = (ringIndex: number) => number;
type FreeFunction = (ptr: number) => void;
type MallocFunction = (size: number) => number;

interface BuildingGenModule {
    heapU8: Uint8Array;
    heap16: Int16Array;
    heap32: Int32Array;
    heapF32: Float32Array;
    setStyle: SetStyleFunction;
    setAOOptions: SetAOOptionsFunction;
    setMetricOptions: SetMetricOptionsFunction;
    setStructuralOptions: SetStructuralOptionsFunction;
    setFacadeOptions: SetFacadeOptionsFunction;
    setFauxFacadeOptions: SetFauxFacadeOptionsFunction;
    setFacadeClassifierOptions: SetFacadeClassifierOptionsFunction;
    addFeature: AddFeatureFunction;
    addFacade: AddFacadeFunction;
    generateMesh: GenerateMeshFunction;
    getLastError: GetLastErrorFunction;
    getOuterRingLength: GetOuterRingLengthFunction;
    getMeshCount: GetMeshCountFunction;
    getPositionsPtr: GetPositionsPtrFunction;
    getPositionsLength: GetPositionsLengthFunction;
    getNormalsPtr: GetNormalsPtrFunction;
    getNormalsLength: GetNormalsLengthFunction;
    getAOPtr: GetAOPtrFunction;
    getAOLength: GetAOLengthFunction;
    getUVPtr: GetUVPtrFunction;
    getUVLength: GetUVLengthFunction;
    getFauxFacadePtr: GetFauxFacadePtrFunction;
    getFauxFacadeLength: GetFauxFacadeLengthFunction;
    getIndicesPtr: GetIndicesPtrFunction;
    getIndicesLength: GetIndicesLengthFunction;
    getBuildingPart: GetBuildingPartFunction;
    getRingCount: GetRingCountFunction;
    getRingPtr: GetRingPtrFunction;
    getRingLength: GetRingLengthFunction;
    free: FreeFunction;
    malloc: MallocFunction;
}

export function loadBuildingGen(wasmPromise: Promise<Response>): Promise<BuildingGen> {
    let heapU8: Uint8Array;
    let heap16: Int16Array;
    let heap32: Int32Array;
    let heapF32: Float32Array;
    let wasmMemory: WebAssembly.Memory;

    function updateMemoryViews() {
        heapU8 = new Uint8Array(wasmMemory.buffer);
        heap16 = new Int16Array(wasmMemory.buffer);
        heap32 = new Int32Array(wasmMemory.buffer);
        heapF32 = new Float32Array(wasmMemory.buffer);
    }

    function abort() {
        throw new Error("Unexpected BuildingGen error.");
    }

    function resizeHeap(requestedSize: number) {
        const oldSize = heapU8.length;
        const newSize = Math.max(requestedSize >>> 0, Math.ceil(oldSize * 1.2));
        const pages = Math.ceil((newSize - oldSize) / 65536);
        try {
            wasmMemory.grow(pages);
            updateMemoryViews();
            return true;
        } catch (_) {
            return false;
        }
    }

    const wasmVoid = () => { };

    const wasmImports = {
        a: {
            a: abort,
            f: resizeHeap,
            g: abort,

            // These are a regression in emscripten and mostly don't appear to
            // be used/important.
            // https://github.com/emscripten-core/emscripten/issues/22534
            b: wasmVoid,
            c: wasmVoid,
            d: wasmVoid,
            e: wasmVoid
        }
    };

    const instantiateWasm = WebAssembly.instantiateStreaming ?
        WebAssembly.instantiateStreaming(wasmPromise, wasmImports) :
        wasmPromise.then(wasm => wasm.arrayBuffer()).then(buffer => WebAssembly.instantiate(buffer, wasmImports));

    return instantiateWasm.then(output => {
        const exports = output.instance.exports;

        const initialiseRuntime = exports.g as () => void;
        initialiseRuntime();

        wasmMemory = exports.f as WebAssembly.Memory;
        updateMemoryViews();

        // Minified exports values might change when recompiling, these may need to be regenerated
        // when the library changes. They can be found in the building_gen_lib.js file that is
        // generated alongside the wasm.
        return new BuildingGen({
            setStyle: exports.h as SetStyleFunction,
            setAOOptions: exports.i as SetAOOptionsFunction,
            setMetricOptions: exports.j as SetMetricOptionsFunction,
            setStructuralOptions: exports.k as SetStructuralOptionsFunction,
            setFacadeOptions: exports.l as SetFacadeOptionsFunction,
            setFauxFacadeOptions: exports.m as SetFauxFacadeOptionsFunction,
            setFacadeClassifierOptions: exports.n as SetFacadeClassifierOptionsFunction,
            addFeature: exports.o as AddFeatureFunction,
            addFacade: exports.p as AddFacadeFunction,
            generateMesh: exports.q as GenerateMeshFunction,
            getLastError: exports.r as GetLastErrorFunction,
            getOuterRingLength: exports.s as GetOuterRingLengthFunction,
            getMeshCount: exports.t as GetMeshCountFunction,
            getPositionsPtr: exports.u as GetPositionsPtrFunction,
            getPositionsLength: exports.v as GetPositionsLengthFunction,
            getNormalsPtr: exports.w as GetNormalsPtrFunction,
            getNormalsLength: exports.x as GetNormalsLengthFunction,
            getAOPtr: exports.y as GetAOPtrFunction,
            getAOLength: exports.z as GetAOLengthFunction,
            getUVPtr: exports.A as GetUVPtrFunction,
            getUVLength: exports.B as GetUVLengthFunction,
            getFauxFacadePtr: exports.C as GetFauxFacadePtrFunction,
            getFauxFacadeLength: exports.D as GetFauxFacadeLengthFunction,
            getIndicesPtr: exports.E as GetIndicesPtrFunction,
            getIndicesLength: exports.F as GetIndicesLengthFunction,
            getBuildingPart: exports.G as GetBuildingPartFunction,
            getRingCount: exports.H as GetRingCountFunction,
            getRingPtr: exports.I as GetRingPtrFunction,
            getRingLength: exports.J as GetRingLengthFunction,
            malloc: exports.K as MallocFunction,
            free: exports.L as FreeFunction,
            heapU8,
            heap16,
            heap32,
            heapF32
        });
    });
}
