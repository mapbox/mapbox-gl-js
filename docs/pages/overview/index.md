---
title: Introduction
description: Introduction to Mapbox Vision AR for iOS.
prependJs:
  - "import OverviewHeader from '@mapbox/dr-ui/overview-header';"
  - "import Quickstart from '../../components/quickstart';"
---

{{
<div className="mb24">
    <OverviewHeader 
    features={[
        "Custom map styles",
        "Fast vector maps",
        "Compatible with other Mapbox tools"
    ]}
    title="Mapbox GL JS"
    version="0.48.0"
    changelogLink="https://github.com/mapbox/mapbox-gl-js/blob/master/CHANGELOG.md"
    ghLink="https://github.com/mapbox/mapbox-gl-js"
    installLink="https://www.mapbox.com/install/js/"
    image={<div />}
    />
</div>
}}

Mapbox GL JS is a JavaScript library that uses WebGL to render interactive maps from [vector tiles](https://www.mapbox.com/help/define-vector-tiles) and [Mapbox styles]({{prefixUrl('/style-spec')}}). It is part of the Mapbox GL ecosystem, which includes [Mapbox Mobile](https://www.mapbox.com/mobile/), a compatible renderer written in C++ with bindings for desktop and mobile platforms. To see what new features our team is working on, take a look at our [roadmap]({{prefixUrl('/roadmap')}}).

## Quickstart

To get started, you need to obtain an [access token](https://www.mapbox.com/help/create-api-access-token/) and a [style URL](https://www.mapbox.com/help/define-style-url/). You can choose from one of our [professionally designed styles](https://www.mapbox.com/api-documentation/#styles) or create your own using [Mapbox Studio](https://www.mapbox.com/studio).

<!-- {{

    {this.state.tab === 'cdn' && <QuickstartCDN token={this.state.userAccessToken}/>}
    {this.state.tab !== 'cdn' && <QuickstartBundler token={this.state.userAccessToken}/>}
}} -->


## CSP Directives

As a mitigation for Cross-Site Scripting and other types of web security vulnerabilities, you may use a <a href='https://developer.mozilla.org/en-US/docs/Web/Security/CSP'>Content Security Policy (CSP)</a> to specify security policies for your website. If you do, Mapbox GL JS requires the following CSP directives:

```
worker-src blob: ;\nchild-src blob: ;\nimg-src data: blob: ;
```

Requesting styles from Mapbox or other services will require additional directives. For Mapbox, you can use this `connect-src` directive:

```
connect-src https://*.tiles.mapbox.com https://api.mapbox.com
```
