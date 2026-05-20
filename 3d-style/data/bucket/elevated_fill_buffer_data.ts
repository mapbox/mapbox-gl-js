import {FillExtLayoutArray} from '../../../src/data/array_types';
import {fillLayoutAttributesExt} from '../../../src/data/bucket/fill_attributes';
import FillBufferData from '../../../src/data/bucket/fill_buffer_data';
import assert from '../../../src/style-spec/util/assert';
import {register} from '../../../src/util/web_worker_transfer';

import type {Range} from '../../elevation/elevation_feature';
import type {LUT} from '../../../src/util/lut';
import type FillStyleLayer from '../../../src/style/style_layer/fill_style_layer';
import type Context from '../../../src/gl/context';
import type VertexBuffer from '../../../src/gl/vertex_buffer';

/**
 * Subclass of `FillBufferData` carrying the elevated-only state used by the HD
 * road-elevation path. Lives in the HD module so the parallel vertex array, its
 * upload buffer, and the `heightRange` tracker don't pull `FillExtLayoutArray` /
 * `fillLayoutAttributesExt` into the core bundle.
 *
 * @private
 */
class ElevatedFillBufferData extends FillBufferData {
    elevatedLayoutVertexArray: FillExtLayoutArray;
    elevatedLayoutVertexBuffer: VertexBuffer | undefined;
    heightRange: Range | undefined;

    constructor(layers: Array<FillStyleLayer>, zoom: number, lut: LUT | null) {
        super(layers, zoom, lut);
        this.elevatedLayoutVertexArray = new FillExtLayoutArray();
    }

    override upload(context: Context) {
        const wasUploaded = this.uploaded;
        super.upload(context);
        if (!wasUploaded && this.elevatedLayoutVertexArray.length > 0) {
            assert(this.layoutVertexArray.length === this.elevatedLayoutVertexArray.length);
            this.elevatedLayoutVertexBuffer = context.createVertexBuffer(this.elevatedLayoutVertexArray, fillLayoutAttributesExt.members);
        }
    }

    override destroy() {
        if (this.elevatedLayoutVertexBuffer) {
            this.elevatedLayoutVertexBuffer.destroy();
        }
        super.destroy();
    }
}

register(ElevatedFillBufferData, 'ElevatedFillBufferData');

export default ElevatedFillBufferData;
