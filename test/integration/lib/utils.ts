export function sendFragments(fragments: Array<[number, string]>) {
    if (!fragments.length) {
        return Promise.resolve();
    }

    return fetch('/report-html/send-fragment', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(fragments.map(([id, data]) => ({id, data: btoa(data)})))
    });
}

export function sendFragment(id: number, data: string | undefined) {
    return data ? sendFragments([[id, data]]) : Promise.resolve();
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
    'native-macos-gl',
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

export type ImageThresholdRuleMatch = {
    rule: string;
    value: number;
};

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

// Jira issue or GitHub issue / pull request URL. The groups capture the parts of the shorthand.
const TICKET_URL_PATTERN = /^https:\/\/(?:mapbox\.atlassian\.net\/browse\/([A-Z][A-Z0-9]+-[1-9][0-9]*)|github\.com\/([A-Za-z0-9-]+\/[A-Za-z0-9._-]+)\/(?:issues|pull)\/([1-9][0-9]*))$/;
// Jira key (MAPS3D-1494) or GitHub reference (owner/repo#N). At least 4 characters in the project key, so words
// like UTF-8 or SHA-256 are not taken as tickets.
const TICKET_NAME_PATTERN = /^(?:[A-Z][A-Z0-9]{3,}-[1-9][0-9]*|[A-Za-z0-9-]+\/[A-Za-z0-9._-]+#[1-9][0-9]*)$/;
const TICKET_URL_EXAMPLES = `'https://mapbox.atlassian.net/browse/MAPS3D-1494' or 'https://github.com/mapbox/mapbox-gl-js/issues/1234'`;

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
                    `Invalid skip-test rule at index ${index}. Expected an object with "platform-tag-contains" and "reason" keys.`
            };
        }

        const skipRule = ruleValue as Record<string, unknown>;
        for (const key of Object.keys(skipRule)) {
            if (!allowedSkipRuleKeys.has(key)) {
                return {
                    validationError:
                        `Unknown key "${key}" in skip-test rule at index ${index}. Allowed keys: platform-tag-contains, reason.`
                };
            }
        }

        if (!('platform-tag-contains' in skipRule) || !('reason' in skipRule)) {
            return {
                validationError:
                    `Invalid skip-test rule at index ${index}. Missing required keys "platform-tag-contains" and/or "reason".`
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
                    `Invalid platform-tag rule "${rule}" in skip-test. Rule must match at least one known platform-tag by substring. Known tags: ${KNOWN_PLATFORM_TAGS.join(', ')}`
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

export type TicketsEvaluation = {
    tickets?: string[];
    validationError?: string;
};

/** Validates `metadata.test.tickets`. */
export function parseTickets(ticketsValue: unknown): TicketsEvaluation {
    if (ticketsValue === undefined) return {};
    if (!Array.isArray(ticketsValue)) {
        return {validationError: `'metadata.test.tickets' must be an array of ticket URLs.`};
    }
    for (const [index, ticket] of ticketsValue.entries()) {
        if (typeof ticket !== 'string' || !TICKET_URL_PATTERN.test(ticket)) {
            return {validationError: `Invalid entry at index ${index} of 'metadata.test.tickets'. Expected a full ticket URL such as ${TICKET_URL_EXAMPLES}.`};
        }
    }
    return {tickets: ticketsValue as string[]};
}

const URL_IN_TEXT = /https?:\/\/[^\s"'()[\]<>,;]+/g;

/** Shorthand of a ticket URL (`MAPS3D-1494`, `owner/repo#N`); undefined for any other URL. */
function ticketName(url: string): string | undefined {
    const match = TICKET_URL_PATTERN.exec(url);
    if (!match) return undefined;
    return match[1] || `${match[2]}#${match[3]}`;
}

const TICKET_TOKEN = /[A-Za-z0-9._/#-]+/g;

/** Ticket shorthands mentioned as whole words in free text, without duplicates. */
function findTicketNames(text: string): string[] {
    const names: string[] = [];
    for (const match of text.matchAll(TICKET_TOKEN)) {
        const token = match[0].replace(/\.+$/, '');
        if (TICKET_NAME_PATTERN.test(token) && !names.includes(token)) names.push(token);
    }
    return names;
}

/** URLs in free text, without duplicates and without trailing dots and colons. */
function findUrls(text: string): string[] {
    const urls: string[] = [];
    for (const match of text.matchAll(URL_IN_TEXT)) {
        const url = match[0].replace(/[.:]+$/, '');
        if (!urls.includes(url)) urls.push(url);
    }
    return urls;
}

const REMOVED_COMMENT_KEYS = ['comment', '_comment'];
const REMOVED_COMMENT_KEYS_ALL = ['comment', '_comment', 'description'];

function asObject(value: unknown): Record<string, unknown> | undefined {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function checkNoCommentKeys(object: Record<string, unknown>, location: string, keys: string[]): string | undefined {
    const key = keys.find((k) => k in object);
    if (key === undefined) return undefined;
    return `'${key}' is no longer supported (found at ${location}). Move its text to the top-level 'description' field of the test file.`;
}

function checkRuleReasons(testMetadata: Record<string, unknown>, field: string, tickets: string[]): string | undefined {
    const rules = testMetadata[field];
    if (!Array.isArray(rules)) return undefined;
    for (const [index, rule] of rules.entries()) {
        const reason = asObject(rule)?.reason;
        if (typeof reason !== 'string') continue;
        for (const url of findUrls(reason)) {
            if (tickets.includes(url)) continue;
            if (!TICKET_URL_PATTERN.test(url)) {
                return `The reason of ${field} rule ${index} contains the URL '${url}', which is not a ticket URL. A reason may only link tickets such as ${TICKET_URL_EXAMPLES}, and each must also be listed in 'metadata.test.tickets'.`;
            }
            return `Ticket '${url}' is mentioned in the reason of ${field} rule ${index}, but is missing from 'metadata.test.tickets'. Every ticket in a skip-test or ignore-metrics reason must also be listed there, e.g. "tickets": ["${url}"].`;
        }
        for (const name of findTicketNames(reason)) {
            if (tickets.some((ticket) => ticketName(ticket) === name)) continue;
            const [repo, number] = name.split('#');
            const example = number ? `https://github.com/${repo}/issues/${number}` : `https://mapbox.atlassian.net/browse/${name}`;
            return `Ticket '${name}' is mentioned in the reason of ${field} rule ${index}, but its URL is missing from 'metadata.test.tickets'. Every ticket in a skip-test or ignore-metrics reason must also be listed there as a full URL, e.g. "tickets": ["${example}"].`;
        }
    }
    return undefined;
}

/**
 * Checks the platform-independent conventions of a test file (`style.json` / `test.json`): no `comment` /
 * `_comment` keys, no `description` key in `metadata` or `metadata.test`, `metadata.test.tickets` holds ticket
 * URLs, and every ticket mentioned in a `skip-test` or `ignore-metrics` reason is listed in `tickets`. Returns an
 * error message, or undefined if the file is valid.
 */
export function validateTestFile(file: unknown): string | undefined {
    const root = asObject(file);
    if (!root) return undefined;
    const rootError = checkNoCommentKeys(root, 'the top level', REMOVED_COMMENT_KEYS);
    if (rootError) return rootError;
    const metadata = asObject(root.metadata);
    if (!metadata) return undefined;
    const testError1 = checkNoCommentKeys(metadata, `'metadata'`, REMOVED_COMMENT_KEYS_ALL);
    if (testError1) return testError1;
    const testMetadata = asObject(metadata.test);
    if (!testMetadata) return undefined;
    const testError2 = checkNoCommentKeys(testMetadata, `'metadata.test'`, REMOVED_COMMENT_KEYS_ALL);
    if (testError2) return testError2;
    const {tickets = [], validationError} = parseTickets(testMetadata.tickets);
    if (validationError) return validationError;
    return checkRuleReasons(testMetadata, 'skip-test', tickets) || checkRuleReasons(testMetadata, 'ignore-metrics', tickets);
}

type ImageThresholdRule = {
    'platform-tag-contains': string;
    threshold: number;
};

export type ImageThresholdEvaluation = {
    match?: ImageThresholdRuleMatch;
    validationError?: string;
};

/** Evaluates `image-threshold` rules against the platform tag. Last matching rule wins. */
export function matchImageThresholdRule(imageThresholdValue: unknown, platformTag: string | undefined): ImageThresholdEvaluation {
    if (!platformTag) return {};
    if (!imageThresholdValue) return {};
    if (!Array.isArray(imageThresholdValue)) {
        return {
            validationError:
                'image-threshold must be an array of objects with "platform-tag-contains" and "threshold" keys'
        };
    }

    const allowedKeys = new Set(['platform-tag-contains', 'threshold']);
    let lastMatch: ImageThresholdRuleMatch | undefined;

    for (const [index, ruleValue] of imageThresholdValue.entries()) {
        if (!ruleValue || typeof ruleValue !== 'object' || Array.isArray(ruleValue)) {
            return {
                validationError:
                    `Invalid image-threshold rule at index ${index}. Expected an object with "platform-tag-contains" and "threshold" keys.`
            };
        }

        const ruleObj = ruleValue as Record<string, unknown>;
        for (const key of Object.keys(ruleObj)) {
            if (!allowedKeys.has(key)) {
                return {
                    validationError:
                        `Unknown key "${key}" in image-threshold rule at index ${index}. Allowed keys: platform-tag-contains, threshold.`
                };
            }
        }

        if (!('platform-tag-contains' in ruleObj) || !('threshold' in ruleObj)) {
            return {
                validationError:
                    `Invalid image-threshold rule at index ${index}. Missing required keys "platform-tag-contains" and/or "threshold".`
            };
        }

        if (typeof ruleObj['platform-tag-contains'] !== 'string' || typeof ruleObj.threshold !== 'number') {
            return {
                validationError:
                    `Invalid image-threshold rule at index ${index}. "platform-tag-contains" must be a string and "threshold" must be a number.`
            };
        }

        const typedRule = ruleObj as ImageThresholdRule;
        const rule = typedRule['platform-tag-contains'];
        if (!isValidPlatformTagRule(rule)) {
            return {
                validationError:
                    `Invalid platform-tag rule "${rule}" in image-threshold. Rule must match at least one known platform-tag by substring. Known tags: ${KNOWN_PLATFORM_TAGS.join(', ')}`
            };
        }

        if (ruleMatchesPlatformTag(rule, platformTag)) {
            lastMatch = {rule, value: typedRule.threshold};
        }
    }

    return lastMatch ? {match: lastMatch} : {};
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
