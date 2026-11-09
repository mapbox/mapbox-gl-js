// Minimal declarations for untyped dev dependencies used by build scripts, configs and tests.
// Typed only as far as this repo uses them.

declare module 'serve-static' {
    import type {IncomingMessage, ServerResponse} from 'node:http';

    export type ServeStaticOptions = {
        index?: string | string[] | false;
        fallthrough?: boolean;
        etag?: boolean;
        lastModified?: boolean;
        maxAge?: number | string;
        immutable?: boolean;
    };

    export default function serveStatic(
        root: string,
        options?: ServeStaticOptions
    ): (req: IncomingMessage, res: ServerResponse, next: (err?: unknown) => void) => void;
}

declare module 'postcss-inline-svg' {
    import type {PluginCreator} from 'postcss';

    const inlineSvg: PluginCreator<Record<string, unknown>>;
    export default inlineSvg;
}

declare module 'eslint-config-mourner' {
    import type {Linter} from 'eslint';

    const config: Linter.Config[];
    export default config;
}
