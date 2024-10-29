interface ImportMeta {
    env: {
        mode?: 'dev' | 'production' | 'bench';
        [key: string]: unknown;
    };
}
