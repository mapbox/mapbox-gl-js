/*---
title: Use locally generated ideographs
description: >-
  Rendering Chinese/Japanese/Korean (CJK) ideographs and precomposed Hangul
  Syllables requires downloading large amounts of font data, which can
  significantly slow map load times. Use the 'localIdeographFontFamily' setting
  to speed up map load times by using locally available fonts instead of font
  data fetched from the server. This setting defines a CSS 'font-family' for
  locally overriding generation of glyphs in the 'CJK Unified Ideographs' and
  'Hangul Syllables' Unicode ranges. In these ranges, font settings from the
  map's style will be ignored in favor of the locally available font. Keywords
  in the fontstack defined in the map's style (light/regular/medium/bold) will
  be translated into a CSS 'font-weight'. When using this setting, keep in mind
  that the fonts you select may not be available on all users' devices. It is
  best to specify at least one broadly available fallback font class such as
  'sans-serif'.
tags:
  - internationalization
pathname: /mapbox-gl-js/example/local-ideographs/
---*/
import Example from '../../components/example';
import html from './local-ideographs.html';
export default Example(html);
