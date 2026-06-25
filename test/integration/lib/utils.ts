export function sendFragment(id: number, data: string | undefined) {
    if (!data) {
        return Promise.resolve();
    }

    return fetch('/report-html/send-fragment', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            id,
            data: btoa(data),
        })
    });
}

function parseBrowserFromUserAgent(ua: string): string | undefined {
    const match =
        /Edg\/([\d.]+)/.exec(ua) ||
        /Firefox\/([\d.]+)/.exec(ua) ||
        /Chrome\/([\d.]+)/.exec(ua) ||
        /Version\/([\d.]+).*Safari/.exec(ua);
    if (!match) return undefined;
    const name = ua.includes('Edg/') ? 'Edge' :
        ua.includes('Firefox/') ? 'Firefox' :
        ua.includes('Chrome/') ? 'Chrome' :
        ua.includes('Safari') ? 'Safari' : 'Unknown';
    return `${name} ${match[1]}`;
}

function parseBrowserTagFromUserAgent(ua: string): string | undefined {
    if (ua.includes('Firefox/')) return 'firefox';
    if (ua.includes('Edg/')) return 'chrome';
    if (ua.includes('Chrome/')) return 'chrome';
    if (ua.includes('Version/') && ua.includes('Safari/')) return 'safari';
    return undefined;
}

function parseOSFromUserAgent(ua: string): string | undefined {
    const winMatch = /Windows NT ([\d.]+)/.exec(ua);
    if (winMatch) return `Windows NT ${winMatch[1]}`;
    const macMatch = /Mac OS X ([\d_.]+)/.exec(ua);
    if (macMatch) return `macOS ${macMatch[1].replace(/_/g, '.')}`;
    if (ua.includes('Linux')) return 'Linux';
    if (ua.includes('Android')) return 'Android';
    if (ua.includes('iPhone') || ua.includes('iPad')) return 'iOS';
    return undefined;
}

function parseOSTagFromUserAgent(ua: string): string | undefined {
    if (ua.includes('Windows')) return 'windows';
    if (ua.includes('Macintosh')) return 'macos';
    if (ua.includes('Linux')) return 'linux';
    return undefined;
}

export function detectPlatformTagFromUserAgent(ua: string): string | undefined {
    const browser = parseBrowserTagFromUserAgent(ua);
    const os = parseOSTagFromUserAgent(ua);

    if (!browser || !os) {
        return undefined;
    }
    const platformTag = `web-${os}-${browser}`;
    return isKnownPlatformTag(platformTag) ? platformTag : undefined;
}

export type SkipRuleMatch = {
    rules: string[];
    reasons: string[];
};

export type SkipRuleEvaluation = {
    match?: SkipRuleMatch;
    validationError?: string;
};

type SkipTestRule = {
    'platform-tag-contains': string;
    reason: string;
};

const KNOWN_PLATFORM_TAGS = [
    'web-macos-chrome',
    'web-macos-safari',
    'web-linux-chrome',
    'web-linux-firefox',
    'web-windows-chrome',
    'native-macos-metal',
    'native-macos-vulkan',
    'native-linux-gl',
    'native-linux-egl',
    'native-linux-egl-swiftshader',
    'native-linux-vulkan',
    'native-ios-metal',
    'native-android-gl-adreno',
    'native-android-gl-mali',
    'native-android-gl-powervr',
    'native-android-vulkan-adreno',
    'native-android-vulkan-mali',
    'native-android-vulkan-powervr'
];

function ruleMatchesPlatformTag(rule: string, platformTag: string): boolean {
    return rule.length === 0 || platformTag.includes(rule);
}

function isValidPlatformTagRule(rule: string): boolean {
    return rule.length === 0 || KNOWN_PLATFORM_TAGS.some((platformTag) => platformTag.includes(rule));
}

function isKnownPlatformTag(platformTag: string): boolean {
    return KNOWN_PLATFORM_TAGS.includes(platformTag);
}

function getMatchingRules(rules: string[], platformTag: string): number[] {
    const matches: number[] = [];
    for (let i = 0; i < rules.length; i++) {
        if (ruleMatchesPlatformTag(rules[i], platformTag)) {
            matches.push(i);
        }
    }
    return matches;
}

export function matchSkipTestRule(skipTestValue: unknown, platformTag: string | undefined): SkipRuleEvaluation {
    if (!platformTag) return {};
    if (!skipTestValue) return {};
    if (!Array.isArray(skipTestValue)) {
        return {
            validationError:
                'skip-test must be an array of objects with "platform-tag-contains" and "reason" keys'
        };
    }

    const rawRules: string[] = [];
    const reasons: string[] = [];
    const allowedSkipRuleKeys = new Set(['platform-tag-contains', 'reason']);

    for (const [index, ruleValue] of skipTestValue.entries()) {
        if (!ruleValue || typeof ruleValue !== 'object' || Array.isArray(ruleValue)) {
            return {
                validationError:
                    `Invalid skip-test rule at index ${index}. Expected an object with ` +
                    '"platform-tag-contains" and "reason" keys.'
            };
        }

        const skipRule = ruleValue as Record<string, unknown>;
        for (const key of Object.keys(skipRule)) {
            if (!allowedSkipRuleKeys.has(key)) {
                return {
                    validationError:
                        `Unknown key "${key}" in skip-test rule at index ${index}. ` +
                        'Allowed keys: platform-tag-contains, reason.'
                };
            }
        }

        if (!('platform-tag-contains' in skipRule) || !('reason' in skipRule)) {
            return {
                validationError:
                    `Invalid skip-test rule at index ${index}. Missing required keys ` +
                    '"platform-tag-contains" and/or "reason".'
            };
        }

        if (typeof skipRule['platform-tag-contains'] !== 'string' || typeof skipRule.reason !== 'string') {
            return {
                validationError:
                    `Invalid skip-test rule at index ${index}. "platform-tag-contains" and "reason" must be strings.`
            };
        }

        const typedSkipRule = skipRule as SkipTestRule;
        const rule = typedSkipRule['platform-tag-contains'];
        if (!isValidPlatformTagRule(rule)) {
            return {
                validationError:
                    `Invalid platform-tag rule "${rule}" in skip-test. ` +
                    `Rule must match at least one known platform-tag by substring. ` +
                    `Known tags: ${KNOWN_PLATFORM_TAGS.join(', ')}`
            };
        }
        rawRules.push(rule);
        reasons.push(typedSkipRule.reason);
    }

    const matchingRuleIndices = getMatchingRules(rawRules, platformTag);
    if (!matchingRuleIndices.length) return {};

    const matchedRules: string[] = [];
    const matchedReasons: string[] = [];
    for (const idx of matchingRuleIndices) {
        matchedRules.push(rawRules[idx]);
        matchedReasons.push(reasons[idx]);
    }

    return {match: {rules: matchedRules, reasons: matchedReasons}};
}

const suiteStartTime = Date.now();

export function sendBrowserDiagnostics() {
    const ua = navigator.userAgent;
    const platformTag = detectPlatformTagFromUserAgent(ua);
    const payload = {
        platformTag,
        userAgent: ua,
        browser: parseBrowserFromUserAgent(ua),
        os: parseOSFromUserAgent(ua),
        viewport: {width: window.innerWidth, height: window.innerHeight},
        devicePixelRatio: window.devicePixelRatio,
        durationMs: Date.now() - suiteStartTime,
    };
    return fetch('/report-html/send-diagnostics', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(payload),
    });
}
