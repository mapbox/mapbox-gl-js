import {describe, test, expect, beforeEach, afterEach} from '../../util/vitest';
import {sanitizeLinks} from '../../../src/util/sanitize';

describe('sanitize', () => {
    let container: HTMLElement;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    afterEach(() => {
        document.body.removeChild(container);
    });

    describe('XSS Protection', () => {
        test('blocks script tags', () => {
            const malicious = '© 2025 <script>alert("XSS")</script> Mapbox';
            const result = sanitizeLinks(malicious);

            expect(result).not.toContain('<script');
            expect(result).toContain('© 2025');
            expect(result).toContain('Mapbox');
            expect(result).toContain('alert("XSS")');
        });

        test('blocks javascript: URLs in links', () => {
            const malicious = '<a href="javascript:alert(1)">Click me</a>';
            const result = sanitizeLinks(malicious);

            expect(result).not.toContain('javascript:');
            expect(result).not.toContain('<a');
            expect(result).toContain('Click me');
        });

        test('blocks data: URLs in links', () => {
            const malicious = '<a href="data:text/html,<script>alert(1)</script>">Click</a>';
            const result = sanitizeLinks(malicious);

            expect(result).not.toContain('data:');
            expect(result).not.toContain('<a');
            expect(result).toContain('Click');
        });

        test('blocks file: URLs in links', () => {
            const malicious = '<a href="file:///etc/passwd">System file</a>';
            const result = sanitizeLinks(malicious);

            expect(result).not.toContain('file:');
            expect(result).not.toContain('<a');
            expect(result).toContain('System file');
        });

        test('blocks img tags with onerror', () => {
            const malicious = '<img src=x onerror="alert(1)">';
            const result = sanitizeLinks(malicious);

            expect(result).not.toContain('<img');
            expect(result).not.toContain('onerror');
        });

        test('blocks img onerror attack from evil.json example', () => {
            const malicious = 'XSS: <img src=x onerror="alert(\'XSS: \' + document.domain)">';
            const result = sanitizeLinks(malicious);

            expect(result).not.toContain('<img');
            expect(result).not.toContain('onerror');
            expect(result).toContain('XSS:'); // Text preserved
            expect(result).not.toContain('alert');
            expect(result).not.toContain('document.domain');
        });

        test('blocks iframe tags', () => {
            const malicious = '<iframe src="https://evil.com"></iframe>';
            const result = sanitizeLinks(malicious);

            expect(result).not.toContain('<iframe');
        });

        test('blocks onclick handlers', () => {
            const malicious = '<a href="http://example.com" onclick="alert(1)">Link</a>';
            const result = sanitizeLinks(malicious);

            expect(result).not.toContain('onclick');
        });

        test('blocks style attributes with expression()', () => {
            const malicious = '<a href="http://example.com" style="expression(alert(1))">Link</a>';
            const result = sanitizeLinks(malicious);

            expect(result).not.toContain('style=');
            expect(result).not.toContain('expression');
        });

        test('blocks nested scripts', () => {
            const malicious = '<a href="http://example.com">Click <script>alert(1)</script> here</a>';
            const result = sanitizeLinks(malicious);

            expect(result).not.toContain('<script');
            expect(result).toContain('Click');
            expect(result).toContain('here');
        });
    });

    describe('Safe Content', () => {
        test('allows http URLs', () => {
            const safe = '<a href="http://mapbox.com">Mapbox</a>';
            const result = sanitizeLinks(safe);

            expect(result).toContain('<a');
            expect(result).toContain('href="http://mapbox.com"');
            expect(result).toContain('>Mapbox</a>');
        });

        test('allows https URLs', () => {
            const safe = '<a href="https://mapbox.com">Mapbox</a>';
            const result = sanitizeLinks(safe);

            expect(result).toContain('<a');
            expect(result).toContain('href="https://mapbox.com"');
            expect(result).toContain('>Mapbox</a>');
        });

        test('allows mailto URLs', () => {
            const safe = '<a href="mailto:support@mapbox.com">Email us</a>';
            const result = sanitizeLinks(safe);

            expect(result).toContain('<a');
            expect(result).toContain('href="mailto:support@mapbox.com"');
            expect(result).toContain('>Email us</a>');
        });

        test('adds rel="noopener nofollow" to links', () => {
            const safe = '<a href="https://example.com">Link</a>';
            const result = sanitizeLinks(safe);

            expect(result).toContain('rel="noopener nofollow"');
        });

        test('preserves class attribute', () => {
            const withClass = '<a href="https://example.com" class="mapbox-improve-map">Improve</a>';
            const result = sanitizeLinks(withClass);

            expect(result).toContain('class="mapbox-improve-map"');
            expect(result).toContain('href="https://example.com"');
            expect(result).toContain('rel="noopener nofollow"');
        });

        test('preserves plain text', () => {
            const text = '© 2025 Mapbox | OpenStreetMap contributors';
            const result = sanitizeLinks(text);

            expect(result).toBe(text);
        });

        test('preserves links nested in other elements', () => {
            const nested = '<div>Please click <a href="https://google.com">here</a></div>';
            const result = sanitizeLinks(nested);

            expect(result).toContain('<a');
            expect(result).toContain('href="https://google.com"');
            expect(result).toContain('>here</a>');
        });
    });
});
