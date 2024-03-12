// @flow

import {register} from '../util/web_worker_transfer.js';
import {MRTDecodingBatch} from './mrt/mrt.js';

register(MRTDecodingBatch, 'MRTDecodingBatch', {omit: ['_onCancel', '_onComplete']});
