import {register} from '../util/web_worker_transfer';
import {MRTDecodingBatch} from './mrt/mrt';

// @ts-expect-error - TS2820 - Type '"_onCancel"' is not assignable to type 'keyof MRTDecodingBatch'. Did you mean '"cancel"'? | TS2820 - Type '"_onComplete"' is not assignable to type 'keyof MRTDecodingBatch'. Did you mean '"complete"'?
register(MRTDecodingBatch, 'MRTDecodingBatch', {omit: ['_onCancel', '_onComplete']});
