import {FillLayoutArray} from '../array_types';
import {fillLayoutAttributes} from './fill_attributes';
import SegmentVector from '../segment';
import {ProgramConfigurationSet} from '../program_configuration';
import {LineIndexArray, TriangleIndexArray} from '../index_array_type';
import {register} from '../../util/web_worker_transfer';

import type {CanonicalTileID} from '../../source/tile_id';
import type {BucketFeature} from '../bucket';
import type {FeatureStates} from '../../source/source_state';
import type {SpritePositions} from '../../util/image';
import type {ImageId} from '../../style-spec/expression/types/image_id';
import type {LUT} from '../../util/lut';
import type {TypedStyleLayer} from '../../style/style_layer/typed_style_layer';
import type {VectorTileLayer} from '@mapbox/vector-tile';
import type FillStyleLayer from '../../style/style_layer/fill_style_layer';
import type Context from '../../gl/context';
import type IndexBuffer from '../../gl/index_buffer';
import type VertexBuffer from '../../gl/vertex_buffer';

class FillBufferData {
    layoutVertexArray: FillLayoutArray;
    layoutVertexBuffer: VertexBuffer | undefined;

    indexArray: TriangleIndexArray;
    indexBuffer: IndexBuffer | undefined;

    lineIndexArray: LineIndexArray;
    lineIndexBuffer: IndexBuffer | undefined;

    triangleSegments: SegmentVector;
    lineSegments: SegmentVector;

    programConfigurations: ProgramConfigurationSet<FillStyleLayer>;
    uploaded: boolean;

    constructor(layers: Array<FillStyleLayer>, zoom: number, lut: LUT | null) {
        this.layoutVertexArray = new FillLayoutArray();
        this.indexArray = new TriangleIndexArray();
        this.lineIndexArray = new LineIndexArray();
        this.triangleSegments = new SegmentVector();
        this.lineSegments = new SegmentVector();
        this.programConfigurations = new ProgramConfigurationSet(layers, {zoom, lut});
        this.uploaded = false;
    }

    update(states: FeatureStates, vtLayer: VectorTileLayer, availableImages: ImageId[], imagePositions: SpritePositions, layers: ReadonlyArray<TypedStyleLayer>, isBrightnessChanged: boolean, brightness?: number | null, worldview?: string) {
        this.programConfigurations.updatePaintArrays(states, vtLayer, layers, availableImages, imagePositions, isBrightnessChanged, brightness, worldview);
    }

    isEmpty(): boolean {
        return this.layoutVertexArray.length === 0;
    }

    needsUpload(): boolean {
        return this.programConfigurations.needsUpload;
    }

    upload(context: Context) {
        if (!this.uploaded) {
            this.layoutVertexBuffer = context.createVertexBuffer(this.layoutVertexArray, fillLayoutAttributes.members);
            this.indexBuffer = context.createIndexBuffer(this.indexArray);
            this.lineIndexBuffer = context.createIndexBuffer(this.lineIndexArray);
        }
        this.programConfigurations.upload(context);
        this.uploaded = true;
    }

    destroy() {
        if (!this.layoutVertexBuffer) return;
        this.layoutVertexBuffer.destroy();
        this.indexBuffer!.destroy();
        this.lineIndexBuffer!.destroy();
        this.programConfigurations.destroy();
        this.triangleSegments.destroy();
        this.lineSegments.destroy();
    }

    populatePaintArrays(feature: BucketFeature, index: number, imagePositions: SpritePositions, availableImages: ImageId[], canonical: CanonicalTileID, brightness?: number | null, worldview?: string) {
        this.programConfigurations.populatePaintArrays(this.layoutVertexArray.length, feature, index, imagePositions, availableImages, canonical, brightness, undefined, worldview);
    }
}

register(FillBufferData, 'FillBufferData');

export default FillBufferData;
