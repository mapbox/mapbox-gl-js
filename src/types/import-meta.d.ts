interface ImportMeta {
    env: {
        mode?: 'dev' | 'production';
        format?: 'umd' | 'csp' | 'esm';
        [key: string]: unknown;
    };
}
