export type Style = {
    convertToMeters: boolean,
    entranceColorRgb: number[],
    facadeGlazingColorRgb: number[],
    normalScale: number[],
    ridgeHeight: number,
    roofColorRgb: number[],
    tileToMeters: number,
    tileZoom: number,
    wallColorRgb: number[]
};

export type Feature = {
    coordinates: {x: number, y: number}[][],
    height: number,
    id: number,
    minHeight: number,
    roofType: string,
    sourceId: number
}

export type Facade = {
    coordinates: {x: number, y: number}[],
    crossPerc: number,
    distanceToRoad: number,
    entrances: string,
    sourceId: number
};

export interface MeshBuffer {
    positions?: Float32Array;
    normals?: Float32Array;
    colors?: Uint8Array;
    ao?: Float32Array;
    indices?: Int32Array;
    buildingPart?: string;
}

export interface MeshCollection {
    meshes: MeshBuffer[];
    modifiedPolygonRings: Float32Array[];
}

export class BuildingGen {
    module: BuildingGenModule;

    constructor(module: BuildingGenModule) {
        this.module = module;
    }

    createIntArray(data: number[]): number {
        const typedArray = new Int32Array(data);
        const pointer = this.module.malloc(
            typedArray.length * typedArray.BYTES_PER_ELEMENT
        );
        this.module.heap32.set(
            typedArray, pointer / typedArray.BYTES_PER_ELEMENT
        );
        return pointer;
    }

    createFloatArray(data: number[]): number {
        const typedArray = new Float32Array(data);
        const pointer = this.module.malloc(
            typedArray.length * typedArray.BYTES_PER_ELEMENT
        );
        this.module.heapF32.set(
            typedArray, pointer / typedArray.BYTES_PER_ELEMENT
        );
        return pointer;
    }

    createStringBuffer(str: string): number {
        const strPtr = this.module.malloc(str.length + 1);
        for (let i = 0; i < str.length; ++i) {
            this.module.heapU8[strPtr + i] = str.charCodeAt(i);
        }
        this.module.heapU8[strPtr + str.length] = 0;
        return strPtr;
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
        const entranceColor = style.entranceColorRgb;
        const facadeGlazingColor = style.facadeGlazingColorRgb;
        const roofColor = style.roofColorRgb;
        const wallColor = style.wallColorRgb;
        const normalScale = style.normalScale;
        this.module.setStyle(
            entranceColor[0], entranceColor[1], entranceColor[2],
            facadeGlazingColor[0], facadeGlazingColor[1], facadeGlazingColor[2],
            roofColor[0], roofColor[1], roofColor[2],
            wallColor[0], wallColor[1], wallColor[2],
            normalScale[0], normalScale[1], normalScale[2],
            style.tileToMeters);
    }

    setAOOptions(bakeToVertices: boolean, parapetOcclusionDistance: number) {
        this.module.setAOOptions(bakeToVertices ? 1 : 0, parapetOcclusionDistance);
    }

    setMetricOptions(convertToMeters: boolean, tileZoom: number) {
        this.module.setMetricOptions(convertToMeters ? 1 : 0, tileZoom);
    }

    setFacadeOptions(crossPercThreshold: number, roadDistanceThreshold: number, classificationDistance: number) {
        this.module.setFacadeOptions(crossPercThreshold, roadDistanceThreshold, classificationDistance);
    }

    generateMesh(features: Feature[], facades: Facade[]): MeshCollection | string {
        for (const feature of features) {
            const roofTypePtr = this.createStringBuffer(feature.roofType);

            const ringIndices = [0];
            const coordinates = [];
            for (const ring of feature.coordinates) {
                if (!Array.isArray(ring)) {
                    continue;
                }

                for (const point of ring) {
                    coordinates.push(point.x);
                    coordinates.push(point.y);
                }
                ringIndices.push(coordinates.length);
            }

            const ringIndexPointer = this.createIntArray(ringIndices);
            const coordinatesPointer = this.createFloatArray(coordinates);

            this.module.addFeature(feature.id, feature.sourceId,
                feature.minHeight, feature.height,
                roofTypePtr, feature.roofType.length,
                coordinatesPointer, ringIndexPointer, ringIndices.length - 1);

            this.module.free(roofTypePtr);
            this.module.free(ringIndexPointer);
            this.module.free(coordinatesPointer);
        }

        for (const facade of facades) {
            let entrances: number[];
            if (facade.entrances) {
                entrances = JSON.parse(facade.entrances);
            } else {
                entrances = [];
            }
            const entrancesPointer = this.createFloatArray(entrances);

            const coordinates = [];
            for (const point of facade.coordinates) {
                coordinates.push(point.x);
                coordinates.push(point.y);
            }

            const coordinatesPointer = this.createFloatArray(coordinates);

            this.module.addFacade(facade.sourceId, facade.crossPerc, facade.distanceToRoad,
                entrancesPointer, entrances.length,
                coordinatesPointer, coordinates.length);

            this.module.free(entrancesPointer);
            this.module.free(coordinatesPointer);
        }

        const success = this.module.generateMesh();

        if (!success) {
            const errorPtr = this.module.getLastError();
            return this.readStringBuffer(errorPtr);
        }

        const meshCount = this.module.getMeshCount();
        const meshes: MeshBuffer[] = new Array(meshCount);
        for (let i = 0; i < meshCount; i++) {
            const positionsPtr = this.module.getPositionsPtr(i);
            const positionsLength = this.module.getPositionsLength(i);
            const positionsArray = new Float32Array(this.module.heapF32.buffer, positionsPtr, positionsLength);

            const normalsPtr = this.module.getNormalsPtr(i);
            const normalsLength = this.module.getNormalsLength(i);
            const normalsArray = new Float32Array(this.module.heapF32.buffer, normalsPtr, normalsLength);

            const colorsPtr = this.module.getColorsPtr(i);
            const colorsLength = this.module.getColorsLength(i);
            const colorsArray = new Uint8Array(this.module.heapU8.buffer, colorsPtr, colorsLength);

            const aoPtr = this.module.getAOPtr(i);
            const aoLength = this.module.getAOLength(i);
            const aoArray = new Float32Array(this.module.heapF32.buffer, aoPtr, aoLength);

            const indicesPtr = this.module.getIndicesPtr(i);
            const indicesLength = this.module.getIndicesLength(i);
            const indicesArray = new Int32Array(this.module.heap32.buffer, indicesPtr, indicesLength);

            const buildingPartPtr = this.module.getBuildingPart(i);
            const buildingPart = this.readStringBuffer(buildingPartPtr);

            meshes[i] = {
                positions: positionsArray,
                normals: normalsArray,
                colors: colorsArray,
                ao: aoArray,
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

        return {meshes, modifiedPolygonRings};
    }
}

type SetStyleFunction = (
    entranceR: number, entranceG: number, entranceB: number,
    facadeR: number, facadeG: number, facadeB: number,
    roofingR: number, roofingG: number, roofingB: number,
    wallR: number, wallG: number, wallB: number,
    normalScaleX: number, normalScaleY: number, normalScaleZ: number,
    tileToMeters: number) => void;
type SetAOOptionsFunction = (bakeToVertices: number, parapetOcclusionDistance: number) => void;
type SetMetricOptionsFunction = (convertToMeters: number, tileZoom: number) => void;
type SetFacadeOptionsFunction = (crossPercThreshold: number, roadDistanceThreshold: number, classificationDistance: number) => void;
type AddFeatureFunction = (id: number, sourceId: number, minHeight: number, height: number, roofShape: number,
    roofShapeLength: number, coords: number, ringIndices: number, numRings: number) => void;
type AddFacadeFunction = (id: number, crossPerc: number, distanceToRoad: number, entrances: number, entrancesLength: number,
    coords: number, numCoords: number) => void;
type GenerateMeshFunction = () => number;
type GetLastErrorFunction = () => number;
type GetMeshCountFunction = () => number;
type GetPositionsPtrFunction = (meshIndex: number) => number;
type GetPositionsLengthFunction = (meshIndex: number) => number;
type GetNormalsPtrFunction = (meshIndex: number) => number;
type GetNormalsLengthFunction = (meshIndex: number) => number;
type GetColorsPtrFunction = (meshIndex: number) => number;
type GetColorsLengthFunction = (meshIndex: number) => number;
type GetAOPtrFunction = (meshIndex: number) => number;
type GetAOLengthFunction = (meshIndex: number) => number;
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
    heap32: Int32Array;
    heapF32: Float32Array;
    setStyle: SetStyleFunction;
    setAOOptions: SetAOOptionsFunction;
    setMetricOptions: SetMetricOptionsFunction;
    setFacadeOptions: SetFacadeOptionsFunction;
    addFeature: AddFeatureFunction;
    addFacade: AddFacadeFunction;
    generateMesh: GenerateMeshFunction;
    getLastError: GetLastErrorFunction;
    getMeshCount: GetMeshCountFunction;
    getPositionsPtr: GetPositionsPtrFunction;
    getPositionsLength: GetPositionsLengthFunction;
    getNormalsPtr: GetNormalsPtrFunction;
    getNormalsLength: GetNormalsLengthFunction;
    getColorsPtr: GetColorsPtrFunction;
    getColorsLength: GetColorsLengthFunction;
    getAOPtr: GetAOPtrFunction;
    getAOLength: GetAOLengthFunction;
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
    let heap32: Int32Array;
    let heapF32: Float32Array;
    let wasmMemory: WebAssembly.Memory;

    function updateMemoryViews() {
        heapU8 = new Uint8Array(wasmMemory.buffer);
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
            setFacadeOptions: exports.k as SetFacadeOptionsFunction,
            addFeature: exports.l as AddFeatureFunction,
            addFacade: exports.m as AddFacadeFunction,
            generateMesh: exports.n as GenerateMeshFunction,
            getLastError: exports.o as GetLastErrorFunction,
            getMeshCount: exports.p as GetMeshCountFunction,
            getPositionsPtr: exports.q as GetPositionsPtrFunction,
            getPositionsLength: exports.r as GetPositionsLengthFunction,
            getNormalsPtr: exports.s as GetNormalsPtrFunction,
            getNormalsLength: exports.t as GetNormalsLengthFunction,
            getColorsPtr: exports.u as GetColorsPtrFunction,
            getColorsLength: exports.v as GetColorsLengthFunction,
            getAOPtr: exports.w as GetAOPtrFunction,
            getAOLength: exports.x as GetAOLengthFunction,
            getIndicesPtr: exports.y as GetIndicesPtrFunction,
            getIndicesLength: exports.z as GetIndicesLengthFunction,
            getBuildingPart: exports.A as GetBuildingPartFunction,
            getRingCount: exports.B as GetRingCountFunction,
            getRingPtr: exports.C as GetRingPtrFunction,
            getRingLength: exports.D as GetRingLengthFunction,
            free: exports.E as FreeFunction,
            malloc: exports.F as MallocFunction,
            heapU8,
            heap32,
            heapF32
        });
    });
}
