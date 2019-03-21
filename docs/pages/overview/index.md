---
title: Introduction
description: Introduction to Mapbox GL JS, a JavaScript library that uses WebGL to render interactive maps from vector tiles and Mapbox styles.
prependJs:
  - "import OverviewHeader from '@mapbox/dr-ui/overview-header';"
  - "import Quickstart from '../../components/quickstart';"
  - "import Copyable from '../../components/copyable';"
  - "import urls from '../../components/urls';"
  - "import {version} from '../../../package.json';"
pathname: /mapbox-gl-js/overview/
---

{{
    <OverviewHeader
    features={[
        "Custom map styles",
        "Fast vector maps",
        "Compatible with other Mapbox tools"
    ]}
    title="Mapbox GL JS"
    version={version}
    changelogLink="https://github.com/mapbox/mapbox-gl-js/blob/master/CHANGELOG.md"
    ghLink="https://github.com/mapbox/mapbox-gl-js"
    installLink="https://www.mapbox.com/install/js/"
    image={<div />}
    />
}}

Mapbox GL JS is a JavaScript library that uses WebGL to render interactive maps from [vector tiles](https://docs.mapbox.com/help/glossary/vector-tiles/) and [Mapbox styles]({{prefixUrl('/style-spec')}}). It is part of the Mapbox GL ecosystem, which includes [Mapbox Mobile](https://www.mapbox.com/mobile/), a compatible renderer written in C++ with bindings for desktop and mobile platforms.

## Quickstart

To get started, you need to obtain an [access token](https://docs.mapbox.com/help/how-mapbox-works/access-tokens/) and a [style URL](https://docs.mapbox.com/help/glossary/style-url/). You can choose from one of our [professionally designed styles](https://docs.mapbox.com/api/maps/#styles) or create your own using [Mapbox Studio](https://www.mapbox.com/studio/).

{{
<Quickstart />
}}


## CSP Directives

As a mitigation for Cross-Site Scripting and other types of web security vulnerabilities, you may use a [Content Security Policy (CSP)](https://developer.mozilla.org/en-US/docs/Web/Security/CSP) to specify security policies for your website. If you do, Mapbox GL JS requires the following CSP directives:

```
worker-src blob: ;
child-src blob: ;
img-src data: blob: ;
```

Requesting styles from Mapbox or other services will require additional directives. For Mapbox, you can use this `connect-src` directive:

```
connect-src https://*.tiles.mapbox.com https://api.mapbox.com https://events.mapbox.com
```

For strict CSP environments without <code>worker-src blob: ; child-src blob:</code> enabled, there's a separate Mapbox GL JS bundle (`mapbox-gl-csp.js` and `mapbox-gl-csp-worker.js`) which requires setting the path to the worker manually:

{{
<Copyable lang="html">{`<script src='${urls.js().replace('.js', '-csp.js')}'></script>
<script>
mapboxgl.workerUrl = "${urls.js().replace('.js', '-csp-worker.js')}";
...
</script>`}</Copyable>
}}

## Mapbox CSS

The CSS referenced in the Quickstart is used to style DOM elements created by Mapbox code. Without the CSS, elements like Popups and Markers won't work.

Including it with a `<link>` in the head of the document via the Mapbox CDN is the simplest and easiest way to provide the CSS, but it is also bundled in the Mapbox module, meaning that if you have a bundler that can handle CSS, you can import the CSS from `mapbox-gl/dist/mapbox-gl.css`.

Note too that if the CSS isn't available by the first render, as soon as the CSS is provided, the DOM elements that depend on this CSS should recover.
