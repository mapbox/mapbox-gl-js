import {styleUrl, zoomGroup} from './precompile_list_lookup';
import {programsForDeviceNeutralKey} from './precompile_programs';
import browser from '../util/browser';
import {warnOnce} from '../util/util';
import {FOG_PITCH_START} from '../style/fog_helpers';

import type Painter from './painter';
import type Transform from '../geo/transform';
import type {LinkedProgram} from './program';
import type {PrecompileList, PrecompileListEntry, PrecompileStyleLists} from './precompile_lists';
import type {ProgramToPrecompile} from './precompile_programs';
import type {ProgramSteps} from './precompile_step_costs';

// The recorded list for a style and camera, or null when none fits.
// A map that sets no camera stays at zoom 0 until style.load, then opens at the style's own zoom.
export function precompileListFor(lists: Record<string, PrecompileStyleLists>, styleId: string | null, transform: Transform): PrecompileList | null {
    const style = styleId ? lists[styleUrl(styleId)] : undefined;
    if (!style) return null;
    // Lists are recorded at pitch 0 (without fog), where most of the programs differ from that with fog.
    if (transform.pitch > FOG_PITCH_START) return null;

    const zoom = transform.unmodified ? style.defaultZoom : transform.zoom;
    const group = zoomGroup(style.zoomGroups, zoom);
    return (group && style.lists[group]) || null;
}

// The entries of the first batch, from each entry's cost or null when it can't be built yet: in list order, until one
// doesn't fit the budget.
export function firstBatch(costs: ReadonlyArray<number | null>, budget: number): number[] {
    const batch: number[] = [];
    for (const [i, cost] of costs.entries()) {
        if (cost === null) continue;
        if (cost > budget) break;
        batch.push(i);
        budget -= cost;
    }
    return batch;
}

type Job = {
    program: ProgramToPrecompile;
    costs: ProgramSteps;
    glProgram: WebGLProgram;
    shaders: WebGLShader[];
    // one step at a time; 0: fragment shader, 1: vertex shader, 2: links.
    step: number;
};

/**
 * Compiles the programs of a style's recorded list during a cold load, before drawing needs them.
 * The first batch goes right after the first frame: the GPU is idle until the next frame, while the style loads.
 * Then the rest is fed step by step between frames, each submission after the GPU is done with the previous one.
 * Drawing then takes over a linked program with the same key and GLSL.
 * @private
 */
export class ListPrecompiler {
    _painter: Painter;
    _entries: ReadonlyArray<PrecompileListEntry>;
    // Whether a frame is waiting to be drawn; if so, each submission is one step instead of up to the cap.
    _framePending: () => boolean;
    // Timestamp when the precompile starts.
    _start: number;
    // Per entry, its programs on this device once its shader source is loaded.
    _programs: Array<Array<ProgramToPrecompile> | null>;
    // Programs for which the precompile has started.
    _started: Set<string>;
    // Linked programs not taken yet, by key.
    _linked: Map<string, LinkedProgram>;
    // Programs linked since the last fence; their link status is queried once that fence is signaled.
    _toQuery: Array<{key: string; program: WebGLProgram}>;
    // The program that is being precompiled.
    _job: Job | null;
    // The fence after the last submission.
    _fence: WebGLSync | null;
    // Timer for the next check: whether the last submission is done, or shader sources have loaded.
    _timer: ReturnType<typeof setTimeout> | null;
    // Whether the precompile has ended: nothing is left that it can build, or it was stopped.
    _done: boolean;

    // The first batch must fit in the idle window and not block any potential GPU work. The window and the step costs
    // come from recorded loads, not this one, so the batch fills only this share of the window.
    static readonly FIRST_BATCH_SHARE = 0.8;
    // The most cost (ms) packed into one submission after the first batch: a frame that comes meanwhile waits for the
    // whole submission. A step that costs more is submitted alone.
    static readonly SUBMISSION_CAP = 250;
    // How often to check between frames whether the GPU is done with the submitted work (ms).
    static readonly POLL_INTERVAL = 4;
    // How long to wait for shader sources that come with a lazy module (ms).
    static readonly SOURCE_WAIT_LIMIT = 20000;

    // Right after the first frame: the GPU has nothing to do until the next frame.
    constructor(painter: Painter, list: PrecompileList, framePending: () => boolean) {
        this._painter = painter;
        this._entries = list.entries;
        this._framePending = framePending;
        this._start = browser.now();
        this._programs = list.entries.map(() => null);
        this._started = new Set();
        this._linked = new Map();
        this._toQuery = [];
        this._job = null;
        this._fence = null;
        this._timer = null;
        this._done = false;

        this._guarded(() => this._submitFirstBatch(list.idleWindow));
    }

    // The linked program for a key, handed over once.
    take(key: string): LinkedProgram | null {
        const linked = this._linked.get(key);
        if (!linked) return null;
        this._linked.delete(key);
        return linked;
    }

    // Called after every frame from the second one on, so that only the first batch goes before the second frame.
    afterFrame() {
        if (this._timer !== null) clearTimeout(this._timer);
        this._timer = null;
        this._pump();
    }

    // Stops permanently. Deletes the programs not taken yet, except on a lost context, where they're already gone.
    stop(context: 'contextLost' | 'contextAlive') {
        if (this._timer !== null) clearTimeout(this._timer);
        this._timer = null;
        this._done = true;
        if (context === 'contextAlive') {
            const gl = this._painter.context.gl;
            for (const {program} of this._linked.values()) gl.deleteProgram(program);
            if (this._job) this._dropJob();
            if (this._fence) gl.deleteSync(this._fence);
        }
        this._linked.clear();
        this._toQuery = [];
        this._job = null;
        this._fence = null;
    }

    // Submit the first batch of programs given the idle window.
    _submitFirstBatch(idleWindow: number) {
        // Style load checks once whether the browser adds noise to pixels read from a canvas; the check waits for the
        // GPU process. Done now, while that process is idle, it's quick and its result is cached, so style load doesn't
        // wait for the first batch to finish.
        browser.hasCanvasFingerprintNoise();
        const sum = (steps: ProgramSteps) => steps[0] + steps[1] + steps[2];
        const costs = this._entries.map((entry, i) => {
            const programs = this._toBuild(i);
            // one entry might contain multiple variants
            return programs && programs.length ? programs.length * sum(entry.steps) : null;
        });
        for (const i of firstBatch(costs, idleWindow * ListPrecompiler.FIRST_BATCH_SHARE)) {
            for (const program of this._toBuild(i)!) this._submitWhole(program);
        }
        this._fenceWork();
    }

    // An entry's programs not started here and not built by the painter yet,
    // or null while its shader source isn't loaded.
    _toBuild(i: number): Array<ProgramToPrecompile> | null {
        if (!this._programs[i]) this._programs[i] = programsForDeviceNeutralKey(this._painter, this._entries[i]!.key);
        const programs = this._programs[i];
        return programs && programs.filter(program => !this._started.has(program.key) && !this._painter.cache.has(program.key));
    }

    _submitWhole(program: ProgramToPrecompile) {
        const gl = this._painter.context.gl;
        const glProgram = gl.createProgram();
        const shaders = [this._compile(gl.FRAGMENT_SHADER, program.fragmentSource), this._compile(gl.VERTEX_SHADER, program.vertexSource)];
        for (const shader of shaders) gl.attachShader(glProgram, shader);
        this._link(program, glProgram, shaders);
        // One program per flush, so the GPU process can do other work in between.
        gl.flush();
    }

    _compile(type: number, source: string): WebGLShader {
        const gl = this._painter.context.gl;
        const shader = gl.createShader(type)!;
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        return shader;
    }

    _link(program: ProgramToPrecompile, glProgram: WebGLProgram, shaders: WebGLShader[]) {
        const gl = this._painter.context.gl;
        gl.linkProgram(glProgram);
        // A shader deleted while attached to a program stays until the program is deleted.
        for (const shader of shaders) gl.deleteShader(shader);
        this._started.add(program.key);
        this._linked.set(program.key, {program: glProgram, vertexSource: program.vertexSource, fragmentSource: program.fragmentSource});
        this._toQuery.push({key: program.key, program: glProgram});
    }

    // A fence after the submitted work. The GPU process runs commands in order,
    // so once the fence is signaled, all work before it is done.
    _fenceWork() {
        const gl = this._painter.context.gl;
        this._fence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
        gl.flush();
    }

    _pump() {
        this._timer = null;
        if (!this._done) this._guarded(() => this._submitNext());
    }

    // On a lost context, createShader returns null and shaderSource throws. The webglcontextlost event comes a task
    // later, so check the context first. Any error stops the precompile; the map then loads without it.
    _guarded(work: () => void) {
        if (this._painter.context.gl.isContextLost()) {
            this.stop('contextLost');
            return;
        }
        try {
            work();
        } catch (e) {
            this.stop('contextAlive');
            warnOnce(`Stopped precompiling shaders: ${(e as Error).message}`);
        }
    }

    // Once the submitted work is done, submits the next steps: one step if a frame waits, else as many as fit the cap.
    _submitNext() {
        const gl = this._painter.context.gl;
        if (this._fence) {
            // Reading a fence's status doesn't wait.
            if (gl.getSyncParameter(this._fence, gl.SYNC_STATUS) !== gl.SIGNALED) {
                this._poll();
                return;
            }
            gl.deleteSync(this._fence);
            this._fence = null;
            this._queryLinkStatus();
        }

        let budget = this._framePending() ? 0 : ListPrecompiler.SUBMISSION_CAP;
        let packed = false;
        for (;;) {
            // The painter built it before this could link it.
            if (this._job && this._painter.cache.has(this._job.program.key)) this._dropJob();
            if (!this._job && !this._nextJob()) break;
            const job = this._job!;
            const cost = job.costs[job.step]!;
            if (packed && cost > budget) break;
            this._runStep(job);
            budget -= cost;
            packed = true;
        }

        if (packed) {
            this._fenceWork();
        } else if (!this._waitingForSources()) {
            this._done = true;
            return;
        }
        this._poll();
    }

    _poll() {
        if (this._timer === null) this._timer = setTimeout(() => this._pump(), ListPrecompiler.POLL_INTERVAL);
    }

    // Before drawing with a program, its link status and uniform blocks are queried; each query blocks the main thread
    // until all queued GPU work is done. Queried here, right after the fence, they return at once and stay cached, so
    // the first draw with the program doesn't block.
    _queryLinkStatus() {
        const gl = this._painter.context.gl;
        for (const {key, program} of this._toQuery) {
            if (!this._linked.has(key)) continue;
            gl.getProgramParameter(program, gl.LINK_STATUS);
            gl.getProgramParameter(program, gl.ACTIVE_UNIFORM_BLOCKS);
        }
        this._toQuery = [];
    }

    // Starts building the first program in list order that has not started, or returns false if there's none now.
    _nextJob(): boolean {
        for (const [i, entry] of this._entries.entries()) {
            const programs = this._toBuild(i);
            if (!programs || !programs.length) continue;
            const program = programs[0]!;
            this._started.add(program.key);
            this._job = {program, costs: entry.steps, glProgram: this._painter.context.gl.createProgram(), shaders: [], step: 0};
            return true;
        }
        return false;
    }

    _runStep(job: Job) {
        const gl = this._painter.context.gl;
        if (job.step < 2) {
            const shader = job.step === 0 ? this._compile(gl.FRAGMENT_SHADER, job.program.fragmentSource) : this._compile(gl.VERTEX_SHADER, job.program.vertexSource);
            gl.attachShader(job.glProgram, shader);
            job.shaders.push(shader);
            job.step++;
        } else {
            this._link(job.program, job.glProgram, job.shaders);
            this._job = null;
        }
    }

    _dropJob() {
        const gl = this._painter.context.gl;
        for (const shader of this._job!.shaders) gl.deleteShader(shader);
        gl.deleteProgram(this._job!.glProgram);
        this._job = null;
    }

    // Whether some entries are still waiting for their shader source, within the wait limit.
    _waitingForSources(): boolean {
        if (browser.now() - this._start > ListPrecompiler.SOURCE_WAIT_LIMIT) return false;
        return this._entries.some((_, i) => !this._toBuild(i));
    }
}
