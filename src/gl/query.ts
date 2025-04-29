import type Context from './context';

export class OcclusionQuery {
    _query: WebGLQuery;
    _gl: WebGL2RenderingContext;
    _isFree: boolean;

    constructor(context: Context) {
        this._gl = context.gl;
        this._query = this._gl.createQuery();
        this._isFree = true;
    }

    begin() {
        this._gl.beginQuery(this._gl.ANY_SAMPLES_PASSED, this._query);
        this._isFree = false;
    }

    end() {
        this._gl.endQuery(this._gl.ANY_SAMPLES_PASSED);
    }

    isResultAvailable(): boolean {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const resultReady: any =  this._gl.getQueryParameter(this._query, this._gl.QUERY_RESULT_AVAILABLE);

        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return resultReady;
    }

    consumeResult(): number {
        const samplesPassed = this._gl.getQueryParameter(this._query, this._gl.QUERY_RESULT);

        this._isFree = true;

        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return samplesPassed;
    }

    isFree(): boolean {
        return this._isFree;
    }

    destroy() {
        this._gl.deleteQuery(this._query);
    }
}
