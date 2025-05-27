/// <reference types="@vitest/browser/providers/playwright" />

import os from 'node:os';
import {mergeConfig, defineConfig} from 'vitest/config';
import baseRenderConfig from './vitest.config.render';

const browserFlags: string[] = [
    '--disable-backgrounding-occluded-windows',
    '--disable-background-networking'
];

const isCI = process.env.CI === 'true';

if (process.env.USE_ANGLE) {
    // Allow setting chrome flag `--use-angle` for local development on render/query tests only.
    // Some devices (e.g. M1 Macs) seem to run test with significantly less failures when forcing the ANGLE backend to use Metal or OpenGL.
    // Search accepted values for `--use-angle` here: https://source.chromium.org/search?q=%22--use-angle%3D%22
    const angleBackends = ['metal', 'gl', 'vulkan', 'swiftshader', 'gles'];
    if (!angleBackends.includes(process.env.USE_ANGLE)) {
        throw new Error(`Unknown value for 'use-angle': '${process.env.USE_ANGLE}'. Should be one of: ${angleBackends.join(', ')}.`);
    }
    browserFlags.push(`--use-angle=${process.env.USE_ANGLE}`);
} else if (isCI && os.platform() === 'darwin' && os.arch() === 'arm64') {
    browserFlags.push("--use-angle=metal", "--ignore-gpu-blocklist");
} else if (isCI && os.platform() === 'linux') {
    browserFlags.push(
        "--ignore-gpu-blocklist",
        "--use-angle=gl",
    );
}

export default mergeConfig(baseRenderConfig, defineConfig({
    test: {
        browser: {
            provider: 'playwright',
            instances: [
                {browser: 'chromium', launch: {args: browserFlags, channel: isCI && os.platform() === 'linux' ? 'chrome' : undefined}},
            ],
        }
    },
}));
