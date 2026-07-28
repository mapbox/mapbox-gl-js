import type MapWorker from '../source/worker';
import type {RtlTextPlugin} from '../source/rtl_text_plugin';

// Ambient augmentations of the environment's built-in DOM types. This file is
// intentionally never imported: tsconfig `include` still pulls it into the
// program (so the augmentations apply everywhere), but keeping it out of the
// entry import graph keeps these internal declarations out of the bundled,
// published `.d.ts`.

// Minimal shapes for the File System Access API used by the devtools control.
interface FileSystemWritableFileStream {
    write: (data: string) => Promise<void>;
    close: () => Promise<void>;
}

interface FileSystemFileHandle {
    createWritable: () => Promise<FileSystemWritableFileStream>;
    getFile: () => Promise<File>;
}

interface FilePickerOptions {
    types?: Array<{
        description?: string;
        accept: Record<string, string[]>;
    }>;
}

declare global {
    // Worker plumbing attached to the worker global scope.
    interface Worker {
        worker: MapWorker;
        registerRTLTextPlugin?: (rtlTextPlugin: RtlTextPlugin) => void;
    }

    // File System Access API, used by the devtools control.
    interface Window {
        showSaveFilePicker?: (options?: FilePickerOptions) => Promise<FileSystemFileHandle>;
        showOpenFilePicker?: (options?: FilePickerOptions) => Promise<FileSystemFileHandle[]>;
    }

    // Safari-only compass heading on device orientation events.
    interface DeviceOrientationEvent {
        readonly webkitCompassHeading?: number;
    }

    // Chrome DevTools extension: timeStamp accepts extra args for performance tracing.
    interface Console {
        // eslint-disable-next-line @typescript-eslint/method-signature-style
        timeStamp(label?: string, start?: string | number, end?: string | number, trackName?: string): void;
    }
}
