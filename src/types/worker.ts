import type {WorkerSourceConstructor, WorkerSource} from '../source/worker_source';
import type {RtlTextPlugin} from '../source/rtl_text_plugin';

// Extends Worker interface in a browser environment
declare global {
    interface Worker {
        registerWorkerSource?: (name: string, WorkerSource: WorkerSourceConstructor) => void;
        getWorkerSource?: (mapId: string, type: string, source: string, scope: string) => WorkerSource;
        registerRTLTextPlugin?: (rtlTextPlugin?: RtlTextPlugin) => void;

        importScripts: (...urls: string[]) => void;
    }
}
