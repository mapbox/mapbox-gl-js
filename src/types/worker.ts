import type MapWorker from '../source/worker';
import type {RtlTextPlugin} from '../source/rtl_text_plugin';
import type {WorkerSourceConstructor, WorkerSource, WorkerSourceRequest} from '../source/worker_source';

// Extends Worker interface in a browser environment
declare global {
    interface Worker {
        worker: MapWorker;
        registerWorkerSource?: (name: string, WorkerSource: WorkerSourceConstructor) => void;
        getWorkerSource?: (mapId: number, params: WorkerSourceRequest) => WorkerSource;
        registerRTLTextPlugin?: (rtlTextPlugin: RtlTextPlugin) => void;
    }
}
