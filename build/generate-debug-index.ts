// Builds the catalog of debug pages from the `description` and `mapbox:*` meta tags each page declares.
// A page with no `description`/`mapbox:role` is listed as unreviewed rather than skipped,
// so the catalog always accounts for every file under debug/.

import fs from 'fs';
import path from 'path';
import {pathToFileURL} from 'url';

const DEBUG_DIR = 'debug';
const OUT = path.join(DEBUG_DIR, 'index.html');

type Role = 'tool' | 'feature' | 'env' | 'perf' | 'repro';

type Page = {
    href: string;
    name: string;
    description?: string;
    role?: Role;
    issue?: string;
    inReleaseTesting: boolean;
};

// Order matters: it is the order sections appear in the catalog.
const ROLES: Record<Role, [string, string]> = {
    tool: ['Tools', 'General-purpose debugging surfaces, not tied to one feature.'],
    feature: ['Features', 'Live coverage of a single feature or style property.'],
    env: ['Environment & build', 'Build artifacts and host-environment integration: CSP, UMD, iframes, tokens, caching, gestures.'],
    perf: ['Performance', 'Throughput and stress pages, read by eye.'],
    repro: ['Issue repros', 'Tied to a GitHub issue.'],
};

const listPages = (dir: string, prefix = ''): string[] => {
    return fs.readdirSync(path.join(DEBUG_DIR, dir), {withFileTypes: true}).flatMap((entry) => {
        if (entry.isDirectory()) return listPages(path.join(dir, entry.name), path.join(prefix, entry.name));
        if (!entry.name.endsWith('.html') || path.join(prefix, entry.name) === 'index.html') return [];
        return [path.join(prefix, entry.name)];
    });
};

const readMeta = (href: string): Page => {
    const html = fs.readFileSync(path.join(DEBUG_DIR, href), 'utf8');
    const meta: Record<string, string> = {};
    for (const [, name, content] of html.matchAll(/<meta\s+name="([^"]+)"\s+content="([^"]*)"/g)) {
        meta[name] = content;
    }
    return {
        href,
        name: href.replace(/\.html$/, ''),
        description: meta['description'],
        role: meta['mapbox:role'] as Role | undefined,
        issue: meta['mapbox:issue'],
        inReleaseTesting: meta['mapbox:in-release-testing'] === 'true',
    };
};

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Renders `code` spans so descriptions can reference properties and API names.
const md = (s: string) => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>');

const renderPage = (page: Page): string => {
    const tags = [
        page.inReleaseTesting ? ' <span class="badge rt">release testing</span>' : '',
        page.issue ? ` <a class="badge" href="${esc(page.issue)}">#${esc(page.issue.split('/').pop() ?? '')}</a>` : '',
    ].join('');
    return `      <li>
        <a href="${esc(page.href)}">${esc(page.name)}</a>${tags}
        <p>${md(page.description ?? '')}</p>
      </li>`;
};

// Pages are listed by filename. The existing names already cluster related pages
// (raster-*, line-*, globe-*, text*), which is why there is no subject taxonomy.
const renderSection = (role: Role, pages: Page[]): string => {
    const [title, blurb] = ROLES[role];
    return `  <section>
    <h2>${esc(title)} <span class="count">${pages.length}</span></h2>
    <p class="blurb">${esc(blurb)}</p>
    <ul class="pages">
${pages.map(renderPage).join('\n')}
    </ul>
  </section>`;
};

export const renderCatalog = (): string => {
    const pages = listPages('.').map(readMeta).sort((a, b) => a.name.localeCompare(b.name));
    const described = pages.filter((p) => p.description && p.role);
    const unreviewed = pages.filter((p) => !p.description || !p.role);

    const sections = (Object.keys(ROLES) as Role[])
        .map((role) => [role, described.filter((p) => p.role === role)] as const)
        .filter(([, group]) => group.length > 0)
        .map(([role, group]) => renderSection(role, group));

    const unreviewedSection = `  <section class="unreviewed">
    <h2>Unreviewed <span class="count">${unreviewed.length}</span></h2>
    <p class="blurb">No <code>description</code>/<code>mapbox:role</code> yet.</p>
    <ul class="bare">
${unreviewed.map((p) => `      <li><a href="${esc(p.href)}">${esc(p.name)}</a></li>`).join('\n')}
    </ul>
  </section>`;

    return `<!DOCTYPE html>
<!-- Generated on request by the debug server; not committed. Add meta tags to the debug page itself. -->
<html lang="en">
<head>
<title>Mapbox GL JS debug pages</title>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="description" content="Catalog of the debug pages, generated from the meta tags each page declares.">
<style>
  :root { color-scheme: light dark; --fg: #21313d; --dim: #6b7b8a; --line: #dfe6ec; --bg: #fff; --accent: #4264fb; }
  @media (prefers-color-scheme: dark) {
    :root { --fg: #e4ebf2; --dim: #94a3b1; --line: #2b3844; --bg: #16202a; }
  }
  body { margin: 0 auto; padding: 32px 24px 64px; max-width: 900px; background: var(--bg); color: var(--fg);
         font: 15px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  h2 { font-size: 17px; margin: 40px 0 2px; padding-bottom: 6px; border-bottom: 1px solid var(--line); }
  p { margin: 2px 0; }
  code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: .9em; }
  .lede, .blurb { color: var(--dim); }
  .blurb { margin-bottom: 4px; font-size: 13px; }
  .count { color: var(--dim); font-weight: 400; font-size: 13px; }
  ul { list-style: none; padding: 0; margin: 0; }
  .pages > li { padding: 7px 0; border-bottom: 1px solid var(--line); }
  .pages a { color: var(--accent); text-decoration: none; font-weight: 600; }
  .pages a:hover { text-decoration: underline; }
  .pages p { color: var(--dim); font-size: 13px; }
  .bare { columns: 3; column-gap: 24px; font-size: 13px; padding-top: 6px; }
  .bare a { color: var(--dim); text-decoration: none; }
  .bare a:hover { color: var(--accent); }
  .badge { display: inline-block; padding: 0 6px; border-radius: 3px; font-size: 11px; font-weight: 600;
           vertical-align: 1px; text-decoration: none; background: var(--line); color: var(--dim); }
  .badge.rt { background: #d6f0e0; color: #14663a; }
  @media (prefers-color-scheme: dark) { .badge.rt { background: #1d4a33; color: #a8e6c4; } }
</style>
</head>
<body>
<h1>Debug pages <span class="count">${pages.length}</span></h1>
<p class="lede">Generated from the <code>description</code> and <code>mapbox:*</code> meta tags in each page — edit a page and reload this one.</p>
${sections.join('\n')}
${unreviewedSection}
</body>
</html>
`;
};

// Writing the file is only for CI and for serving debug/ outside `npm start`;
// the dev server renders the catalog per request instead.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    fs.writeFileSync(OUT, renderCatalog());
    console.log(`wrote ${OUT}`);
}
