/**
 * Sanitizes HTML by allowing only safe anchor tags with http/https/mailto hrefs.
 * All other elements are converted to text nodes.
 *
 * @param html - The HTML string to sanitize
 * @returns Sanitized HTML string containing only text and safe anchor tags
 * @private
 */
const SAFE_LINK_PROTOCOL_RE = /^(https?:|mailto:)/i;

export function sanitizeLinks(html: string): string {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const elements = Array.from(doc.body.querySelectorAll('*'));

    elements.reverse().forEach(el => {
        const text = el.textContent || '';

        if (el.tagName !== 'A') {
            el.replaceWith(...el.childNodes);
            return;
        }

        const href = (el as HTMLAnchorElement).getAttribute('href');
        if (!href || !SAFE_LINK_PROTOCOL_RE.test(href)) {
            el.replaceWith(doc.createTextNode(text));
            return;
        }

        const a = doc.createElement('a');
        a.href = href;
        a.textContent = text;
        a.rel = 'noopener nofollow';
        const className = el.getAttribute('class');
        if (className) a.className = className;
        el.replaceWith(a);
    });

    return doc.body.innerHTML;
}
