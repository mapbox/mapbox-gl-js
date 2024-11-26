import {register} from '../util/web_worker_transfer';
import {MRTDecodingBatch} from './mrt/mrt.esm.js';

register(MRTDecodingBatch, 'MRTDecodingBatch', {omit: ['_onCancel', '_onComplete']});
