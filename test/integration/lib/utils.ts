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

const suiteStartTime = Date.now();

export function sendBrowserDiagnostics() {
    const ua = navigator.userAgent;
    const payload = {
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
