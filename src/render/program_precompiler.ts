import browser from '../util/browser';

import type Painter from './painter';
import type {CreateProgramParams} from './painter';
import type {ProgramName} from './program';
import type Style from '../style/style';
import type {TypedStyleLayer} from '../style/style_layer/typed_style_layer';
import type EvaluationParameters from '../style/evaluation_parameters';

type PrecompileTask = {
    programId: ProgramName;
    params: CreateProgramParams;
    fog: boolean;
    overrideRtt: boolean;
};

export class ProgramPrecompiler {
    // Safety margin (ms) before the idle deadline. Stopping a few ms early prevents a
    // long-running program compilation from extending past the deadline and stealing
    // time from the next frame.
    static readonly DEADLINE_SAFETY_MARGIN_MS = 5;

    _queue: PrecompileTask[];
    _needsBuild: boolean;
    _idleHandle: number | null;

    constructor() {
        this._queue = [];
        this._needsBuild = true;
        this._idleHandle = null;
    }

    needsBuild(): boolean {
        return this._needsBuild;
    }

    buildQueue(layers: TypedStyleLayer[], parameters: EvaluationParameters, style: Style) {
        if (this._idleHandle != null && typeof cancelIdleCallback !== 'undefined') {
            cancelIdleCallback(this._idleHandle);
        }
        this._idleHandle = null;
        this._queue = [];
        this._needsBuild = false;

        const stylesheet = style.stylesheet;
        const hasTerrainOrGlobe = !!(stylesheet && (stylesheet.terrain || (stylesheet.projection && stylesheet.projection.name === 'globe')));
        const hasFog = !!style.fog;

        for (const layer of layers) {
            if (layer.visibility === 'none') continue;
            const programIds = layer.getProgramIds();
            if (!programIds) continue;

            for (const programId of programIds) {
                const params = layer.getDefaultProgramParams(programId, parameters.zoom, style._styleColorTheme.lut);
                if (!params) continue;

                this._queue.push({programId, params, fog: false, overrideRtt: false});

                if (hasFog) {
                    this._queue.push({programId, params, fog: true, overrideRtt: false});
                }

                if (hasTerrainOrGlobe) {
                    this._queue.push({programId, params, fog: false, overrideRtt: true});
                }
            }
        }
    }

    _executeBatch(deadline: IdleDeadline, painter: Painter, style: Style) {
        while (this._queue.length > 0) {
            const task = this._queue.shift();
            if (!task) break;
            painter.style = style;
            painter._fogVisible = task.fog;
            const params = Object.assign({}, task.params);
            params.overrideFog = task.fog;
            params.overrideRtt = task.overrideRtt;
            painter.getOrCreateProgram(task.programId, params);
            if (deadline.timeRemaining() <= ProgramPrecompiler.DEADLINE_SAFETY_MARGIN_MS) break;
        }

        if (this._queue.length === 0 || deadline.timeRemaining() > ProgramPrecompiler.DEADLINE_SAFETY_MARGIN_MS) {
            // Do a flush to ensure that programs compiled ahead of rendering
            painter.context.gl.flush();
        }

        if (this._queue.length > 0) {
            this._idleHandle = browser.requestIdleCallback((d) => this._executeBatch(d, painter, style));
        } else {
            this._idleHandle = null;
        }
    }

    processQueue(painter: Painter, style: Style) {
        if (this._queue.length === 0) return;

        if (this._idleHandle != null && typeof cancelIdleCallback !== 'undefined') {
            cancelIdleCallback(this._idleHandle);
        }

        this._idleHandle = browser.requestIdleCallback((d) => this._executeBatch(d, painter, style));
    }

    reset() {
        if (this._idleHandle != null && typeof cancelIdleCallback !== 'undefined') {
            cancelIdleCallback(this._idleHandle);
        }
        this._queue = [];
        this._idleHandle = null;
        this._needsBuild = true;
    }
}
