/// <reference types="@vitest/browser/providers/playwright" />

import os from 'node:os';
import {mergeConfig, defineConfig} from 'vitest/config';
import baseRenderConfig from './vitest.config.render';

const isCI = process.env.CI === 'true';

const args: string[] = [
    '--disable-background-networking',
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-features=CalculateNativeWinOcclusion',
    '--disable-renderer-backgrounding',
    '--ash-no-nudges'
];

if (isCI) {
    args.push('--ignore-gpu-blocklist');
}

if (os.platform() === 'darwin' && os.arch() === 'arm64') {
    args.push('--use-angle=metal');
} else {
    args.push('--use-angle=gl');
}

export default mergeConfig(baseRenderConfig, defineConfig({
    test: {
        browser: {
            provider: 'playwright',
            instances: [
                {browser: 'chromium', launch: {args, channel: isCI ? 'chromium' : 'chrome'}},
            ],
        }
    },
}));
