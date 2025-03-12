import {register} from '../util/web_worker_transfer';
import {MapboxRasterTile, MapboxRasterLayer, MRTDecodingBatch} from './mrt/mrt.esm.js';

register(MRTDecodingBatch, 'MRTDecodingBatch', {omit: ['_onCancel', '_onComplete']});
register(MapboxRasterTile, 'MapboxRasterTile');
register(MapboxRasterLayer, 'MapboxRasterLayer', {omit: ['_blocksInProgress']});
