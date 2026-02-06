"use strict";
var pmtiles = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
  var __async = (__this, __arguments, generator) => {
    return new Promise((resolve, reject) => {
      var fulfilled = (value) => {
        try {
          step(generator.next(value));
        } catch (e) {
          reject(e);
        }
      };
      var rejected = (value) => {
        try {
          step(generator.throw(value));
        } catch (e) {
          reject(e);
        }
      };
      var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
      step((generator = generator.apply(__this, __arguments)).next());
    });
  };

  // index.ts
  var js_exports = {};
  __export(js_exports, {
    Compression: () => Compression,
    EtagMismatch: () => EtagMismatch,
    FetchSource: () => FetchSource,
    FileAPISource: () => FileAPISource,
    PMTiles: () => PMTiles,
    Protocol: () => Protocol,
    ResolvedValueCache: () => ResolvedValueCache,
    SharedPromiseCache: () => SharedPromiseCache,
    TileType: () => TileType,
    bytesToHeader: () => bytesToHeader,
    findTile: () => findTile,
    getUint64: () => getUint64,
    leafletRasterLayer: () => leafletRasterLayer,
    readVarint: () => readVarint,
    tileIdToZxy: () => tileIdToZxy,
    zxyToTileId: () => zxyToTileId
  });

  // node_modules/fflate/esm/browser.js
  var u8 = Uint8Array;
  var u16 = Uint16Array;
  var i32 = Int32Array;
  var fleb = new u8([0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0, 0, 0, 0]);
  var fdeb = new u8([0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13, 0, 0]);
  var clim = new u8([16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]);
  var freb = function(eb, start) {
    var b = new u16(31);
    for (var i = 0; i < 31; ++i) {
      b[i] = start += 1 << eb[i - 1];
    }
    var r = new i32(b[30]);
    for (var i = 1; i < 30; ++i) {
      for (var j = b[i]; j < b[i + 1]; ++j) {
        r[j] = j - b[i] << 5 | i;
      }
    }
    return { b, r };
  };
  var _a = freb(fleb, 2);
  var fl = _a.b;
  var revfl = _a.r;
  fl[28] = 258, revfl[258] = 28;
  var _b = freb(fdeb, 0);
  var fd = _b.b;
  var revfd = _b.r;
  var rev = new u16(32768);
  for (i = 0; i < 32768; ++i) {
    x = (i & 43690) >> 1 | (i & 21845) << 1;
    x = (x & 52428) >> 2 | (x & 13107) << 2;
    x = (x & 61680) >> 4 | (x & 3855) << 4;
    rev[i] = ((x & 65280) >> 8 | (x & 255) << 8) >> 1;
  }
  var x;
  var i;
  var hMap = function(cd, mb, r) {
    var s = cd.length;
    var i = 0;
    var l = new u16(mb);
    for (; i < s; ++i) {
      if (cd[i])
        ++l[cd[i] - 1];
    }
    var le = new u16(mb);
    for (i = 1; i < mb; ++i) {
      le[i] = le[i - 1] + l[i - 1] << 1;
    }
    var co;
    if (r) {
      co = new u16(1 << mb);
      var rvb = 15 - mb;
      for (i = 0; i < s; ++i) {
        if (cd[i]) {
          var sv = i << 4 | cd[i];
          var r_1 = mb - cd[i];
          var v = le[cd[i] - 1]++ << r_1;
          for (var m = v | (1 << r_1) - 1; v <= m; ++v) {
            co[rev[v] >> rvb] = sv;
          }
        }
      }
    } else {
      co = new u16(s);
      for (i = 0; i < s; ++i) {
        if (cd[i]) {
          co[i] = rev[le[cd[i] - 1]++] >> 15 - cd[i];
        }
      }
    }
    return co;
  };
  var flt = new u8(288);
  for (i = 0; i < 144; ++i)
    flt[i] = 8;
  var i;
  for (i = 144; i < 256; ++i)
    flt[i] = 9;
  var i;
  for (i = 256; i < 280; ++i)
    flt[i] = 7;
  var i;
  for (i = 280; i < 288; ++i)
    flt[i] = 8;
  var i;
  var fdt = new u8(32);
  for (i = 0; i < 32; ++i)
    fdt[i] = 5;
  var i;
  var flrm = /* @__PURE__ */ hMap(flt, 9, 1);
  var fdrm = /* @__PURE__ */ hMap(fdt, 5, 1);
  var max = function(a) {
    var m = a[0];
    for (var i = 1; i < a.length; ++i) {
      if (a[i] > m)
        m = a[i];
    }
    return m;
  };
  var bits = function(d, p, m) {
    var o = p / 8 | 0;
    return (d[o] | d[o + 1] << 8) >> (p & 7) & m;
  };
  var bits16 = function(d, p) {
    var o = p / 8 | 0;
    return (d[o] | d[o + 1] << 8 | d[o + 2] << 16) >> (p & 7);
  };
  var shft = function(p) {
    return (p + 7) / 8 | 0;
  };
  var slc = function(v, s, e) {
    if (s == null || s < 0)
      s = 0;
    if (e == null || e > v.length)
      e = v.length;
    var n = new u8(e - s);
    n.set(v.subarray(s, e));
    return n;
  };
  var ec = [
    "unexpected EOF",
    "invalid block type",
    "invalid length/literal",
    "invalid distance",
    "stream finished",
    "no stream handler",
    ,
    "no callback",
    "invalid UTF-8 data",
    "extra field too long",
    "date not in range 1980-2099",
    "filename too long",
    "stream finishing",
    "invalid zip data"
  ];
  var err = function(ind, msg, nt) {
    var e = new Error(msg || ec[ind]);
    e.code = ind;
    if (Error.captureStackTrace)
      Error.captureStackTrace(e, err);
    if (!nt)
      throw e;
    return e;
  };
  var inflt = function(dat, st, buf, dict) {
    var sl = dat.length, dl = dict ? dict.length : 0;
    if (!sl || st.f && !st.l)
      return buf || new u8(0);
    var noBuf = !buf || st.i != 2;
    var noSt = st.i;
    if (!buf)
      buf = new u8(sl * 3);
    var cbuf = function(l2) {
      var bl = buf.length;
      if (l2 > bl) {
        var nbuf = new u8(Math.max(bl * 2, l2));
        nbuf.set(buf);
        buf = nbuf;
      }
    };
    var final = st.f || 0, pos = st.p || 0, bt = st.b || 0, lm = st.l, dm = st.d, lbt = st.m, dbt = st.n;
    var tbts = sl * 8;
    do {
      if (!lm) {
        final = bits(dat, pos, 1);
        var type = bits(dat, pos + 1, 3);
        pos += 3;
        if (!type) {
          var s = shft(pos) + 4, l = dat[s - 4] | dat[s - 3] << 8, t = s + l;
          if (t > sl) {
            if (noSt)
              err(0);
            break;
          }
          if (noBuf)
            cbuf(bt + l);
          buf.set(dat.subarray(s, t), bt);
          st.b = bt += l, st.p = pos = t * 8, st.f = final;
          continue;
        } else if (type == 1)
          lm = flrm, dm = fdrm, lbt = 9, dbt = 5;
        else if (type == 2) {
          var hLit = bits(dat, pos, 31) + 257, hcLen = bits(dat, pos + 10, 15) + 4;
          var tl = hLit + bits(dat, pos + 5, 31) + 1;
          pos += 14;
          var ldt = new u8(tl);
          var clt = new u8(19);
          for (var i = 0; i < hcLen; ++i) {
            clt[clim[i]] = bits(dat, pos + i * 3, 7);
          }
          pos += hcLen * 3;
          var clb = max(clt), clbmsk = (1 << clb) - 1;
          var clm = hMap(clt, clb, 1);
          for (var i = 0; i < tl; ) {
            var r = clm[bits(dat, pos, clbmsk)];
            pos += r & 15;
            var s = r >> 4;
            if (s < 16) {
              ldt[i++] = s;
            } else {
              var c = 0, n = 0;
              if (s == 16)
                n = 3 + bits(dat, pos, 3), pos += 2, c = ldt[i - 1];
              else if (s == 17)
                n = 3 + bits(dat, pos, 7), pos += 3;
              else if (s == 18)
                n = 11 + bits(dat, pos, 127), pos += 7;
              while (n--)
                ldt[i++] = c;
            }
          }
          var lt = ldt.subarray(0, hLit), dt = ldt.subarray(hLit);
          lbt = max(lt);
          dbt = max(dt);
          lm = hMap(lt, lbt, 1);
          dm = hMap(dt, dbt, 1);
        } else
          err(1);
        if (pos > tbts) {
          if (noSt)
            err(0);
          break;
        }
      }
      if (noBuf)
        cbuf(bt + 131072);
      var lms = (1 << lbt) - 1, dms = (1 << dbt) - 1;
      var lpos = pos;
      for (; ; lpos = pos) {
        var c = lm[bits16(dat, pos) & lms], sym = c >> 4;
        pos += c & 15;
        if (pos > tbts) {
          if (noSt)
            err(0);
          break;
        }
        if (!c)
          err(2);
        if (sym < 256)
          buf[bt++] = sym;
        else if (sym == 256) {
          lpos = pos, lm = null;
          break;
        } else {
          var add = sym - 254;
          if (sym > 264) {
            var i = sym - 257, b = fleb[i];
            add = bits(dat, pos, (1 << b) - 1) + fl[i];
            pos += b;
          }
          var d = dm[bits16(dat, pos) & dms], dsym = d >> 4;
          if (!d)
            err(3);
          pos += d & 15;
          var dt = fd[dsym];
          if (dsym > 3) {
            var b = fdeb[dsym];
            dt += bits16(dat, pos) & (1 << b) - 1, pos += b;
          }
          if (pos > tbts) {
            if (noSt)
              err(0);
            break;
          }
          if (noBuf)
            cbuf(bt + 131072);
          var end = bt + add;
          if (bt < dt) {
            var shift2 = dl - dt, dend = Math.min(dt, end);
            if (shift2 + bt < 0)
              err(3);
            for (; bt < dend; ++bt)
              buf[bt] = dict[shift2 + bt];
          }
          for (; bt < end; bt += 4) {
            buf[bt] = buf[bt - dt];
            buf[bt + 1] = buf[bt + 1 - dt];
            buf[bt + 2] = buf[bt + 2 - dt];
            buf[bt + 3] = buf[bt + 3 - dt];
          }
          bt = end;
        }
      }
      st.l = lm, st.p = lpos, st.b = bt, st.f = final;
      if (lm)
        final = 1, st.m = lbt, st.d = dm, st.n = dbt;
    } while (!final);
    return bt == buf.length ? buf : slc(buf, 0, bt);
  };
  var et = /* @__PURE__ */ new u8(0);
  var gzs = function(d) {
    if (d[0] != 31 || d[1] != 139 || d[2] != 8)
      err(6, "invalid gzip data");
    var flg = d[3];
    var st = 10;
    if (flg & 4)
      st += (d[10] | d[11] << 8) + 2;
    for (var zs = (flg >> 3 & 1) + (flg >> 4 & 1); zs > 0; zs -= !d[st++])
      ;
    return st + (flg & 2);
  };
  var gzl = function(d) {
    var l = d.length;
    return (d[l - 4] | d[l - 3] << 8 | d[l - 2] << 16 | d[l - 1] << 24) >>> 0;
  };
  var zls = function(d, dict) {
    if ((d[0] & 15) != 8 || d[0] >> 4 > 7 || (d[0] << 8 | d[1]) % 31)
      err(6, "invalid zlib data");
    if ((d[1] >> 5 & 1) == +!dict)
      err(6, "invalid zlib data: " + (d[1] & 32 ? "need" : "unexpected") + " dictionary");
    return (d[1] >> 3 & 4) + 2;
  };
  function inflateSync(data, opts) {
    return inflt(data, { i: 2 }, opts && opts.out, opts && opts.dictionary);
  }
  function gunzipSync(data, opts) {
    var st = gzs(data);
    if (st + 8 > data.length)
      err(6, "invalid gzip data");
    return inflt(data.subarray(st, -8), { i: 2 }, opts && opts.out || new u8(gzl(data)), opts && opts.dictionary);
  }
  function unzlibSync(data, opts) {
    return inflt(data.subarray(zls(data, opts && opts.dictionary), -4), { i: 2 }, opts && opts.out, opts && opts.dictionary);
  }
  function decompressSync(data, opts) {
    return data[0] == 31 && data[1] == 139 && data[2] == 8 ? gunzipSync(data, opts) : (data[0] & 15) != 8 || data[0] >> 4 > 7 || (data[0] << 8 | data[1]) % 31 ? inflateSync(data, opts) : unzlibSync(data, opts);
  }
  var td = typeof TextDecoder != "undefined" && /* @__PURE__ */ new TextDecoder();
  var tds = 0;
  try {
    td.decode(et, { stream: true });
    tds = 1;
  } catch (e) {
  }

  // v2.ts
  var shift = (n, shift2) => {
    return n * Math.pow(2, shift2);
  };
  var unshift = (n, shift2) => {
    return Math.floor(n / Math.pow(2, shift2));
  };
  var getUint24 = (view, pos) => {
    return shift(view.getUint16(pos + 1, true), 8) + view.getUint8(pos);
  };
  var getUint48 = (view, pos) => {
    return shift(view.getUint32(pos + 2, true), 16) + view.getUint16(pos, true);
  };
  var compare = (tz, tx, ty, view, i) => {
    if (tz != view.getUint8(i))
      return tz - view.getUint8(i);
    const x = getUint24(view, i + 1);
    if (tx != x)
      return tx - x;
    const y = getUint24(view, i + 4);
    if (ty != y)
      return ty - y;
    return 0;
  };
  var queryLeafdir = (view, z, x, y) => {
    const offset_len = queryView(view, z | 128, x, y);
    if (offset_len) {
      return {
        z,
        x,
        y,
        offset: offset_len[0],
        length: offset_len[1],
        is_dir: true
      };
    }
    return null;
  };
  var queryTile = (view, z, x, y) => {
    const offset_len = queryView(view, z, x, y);
    if (offset_len) {
      return {
        z,
        x,
        y,
        offset: offset_len[0],
        length: offset_len[1],
        is_dir: false
      };
    }
    return null;
  };
  var queryView = (view, z, x, y) => {
    let m = 0;
    let n = view.byteLength / 17 - 1;
    while (m <= n) {
      const k = n + m >> 1;
      const cmp = compare(z, x, y, view, k * 17);
      if (cmp > 0) {
        m = k + 1;
      } else if (cmp < 0) {
        n = k - 1;
      } else {
        return [getUint48(view, k * 17 + 7), view.getUint32(k * 17 + 13, true)];
      }
    }
    return null;
  };
  var entrySort = (a, b) => {
    if (a.is_dir && !b.is_dir) {
      return 1;
    }
    if (!a.is_dir && b.is_dir) {
      return -1;
    }
    if (a.z !== b.z) {
      return a.z - b.z;
    }
    if (a.x !== b.x) {
      return a.x - b.x;
    }
    return a.y - b.y;
  };
  var parseEntry = (dataview, i) => {
    const z_raw = dataview.getUint8(i * 17);
    const z = z_raw & 127;
    return {
      z,
      x: getUint24(dataview, i * 17 + 1),
      y: getUint24(dataview, i * 17 + 4),
      offset: getUint48(dataview, i * 17 + 7),
      length: dataview.getUint32(i * 17 + 13, true),
      is_dir: z_raw >> 7 === 1
    };
  };
  var sortDir = (a) => {
    const entries = [];
    const view = new DataView(a);
    for (let i = 0; i < view.byteLength / 17; i++) {
      entries.push(parseEntry(view, i));
    }
    return createDirectory(entries);
  };
  var createDirectory = (entries) => {
    entries.sort(entrySort);
    const buffer = new ArrayBuffer(17 * entries.length);
    const arr = new Uint8Array(buffer);
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      let z = entry.z;
      if (entry.is_dir)
        z = z | 128;
      arr[i * 17] = z;
      arr[i * 17 + 1] = entry.x & 255;
      arr[i * 17 + 2] = entry.x >> 8 & 255;
      arr[i * 17 + 3] = entry.x >> 16 & 255;
      arr[i * 17 + 4] = entry.y & 255;
      arr[i * 17 + 5] = entry.y >> 8 & 255;
      arr[i * 17 + 6] = entry.y >> 16 & 255;
      arr[i * 17 + 7] = entry.offset & 255;
      arr[i * 17 + 8] = unshift(entry.offset, 8) & 255;
      arr[i * 17 + 9] = unshift(entry.offset, 16) & 255;
      arr[i * 17 + 10] = unshift(entry.offset, 24) & 255;
      arr[i * 17 + 11] = unshift(entry.offset, 32) & 255;
      arr[i * 17 + 12] = unshift(entry.offset, 48) & 255;
      arr[i * 17 + 13] = entry.length & 255;
      arr[i * 17 + 14] = entry.length >> 8 & 255;
      arr[i * 17 + 15] = entry.length >> 16 & 255;
      arr[i * 17 + 16] = entry.length >> 24 & 255;
    }
    return buffer;
  };
  var deriveLeaf = (view, tile) => {
    if (view.byteLength < 17)
      return null;
    const numEntries = view.byteLength / 17;
    const entry = parseEntry(view, numEntries - 1);
    if (entry.is_dir) {
      const leaf_level = entry.z;
      const level_diff = tile.z - leaf_level;
      const leaf_x = Math.trunc(tile.x / (1 << level_diff));
      const leaf_y = Math.trunc(tile.y / (1 << level_diff));
      return { z: leaf_level, x: leaf_x, y: leaf_y };
    }
    return null;
  };
  function getHeader(source) {
    return __async(this, null, function* () {
      const resp = yield source.getBytes(0, 512e3);
      const dataview = new DataView(resp.data);
      const json_size = dataview.getUint32(4, true);
      const root_entries = dataview.getUint16(8, true);
      const dec = new TextDecoder("utf-8");
      const json_metadata = JSON.parse(
        dec.decode(new DataView(resp.data, 10, json_size))
      );
      let tile_compression = 0 /* Unknown */;
      if (json_metadata.compression === "gzip") {
        tile_compression = 2 /* Gzip */;
      }
      let minzoom = 0;
      if ("minzoom" in json_metadata) {
        minzoom = +json_metadata.minzoom;
      }
      let maxzoom = 0;
      if ("maxzoom" in json_metadata) {
        maxzoom = +json_metadata.maxzoom;
      }
      let center_lon = 0;
      let center_lat = 0;
      let center_zoom = 0;
      let min_lon = -180;
      let min_lat = -85;
      let max_lon = 180;
      let max_lat = 85;
      if (json_metadata.bounds) {
        const split = json_metadata.bounds.split(",");
        min_lon = +split[0];
        min_lat = +split[1];
        max_lon = +split[2];
        max_lat = +split[3];
      }
      if (json_metadata.center) {
        const split = json_metadata.center.split(",");
        center_lon = +split[0];
        center_lat = +split[1];
        center_zoom = +split[2];
      }
      const header = {
        specVersion: dataview.getUint16(2, true),
        rootDirectoryOffset: 10 + json_size,
        rootDirectoryLength: root_entries * 17,
        jsonMetadataOffset: 10,
        jsonMetadataLength: json_size,
        leafDirectoryOffset: 0,
        leafDirectoryLength: void 0,
        tileDataOffset: 0,
        tileDataLength: void 0,
        numAddressedTiles: 0,
        numTileEntries: 0,
        numTileContents: 0,
        clustered: false,
        internalCompression: 1 /* None */,
        tileCompression: tile_compression,
        tileType: 1 /* Mvt */,
        minZoom: minzoom,
        maxZoom: maxzoom,
        minLon: min_lon,
        minLat: min_lat,
        maxLon: max_lon,
        maxLat: max_lat,
        centerZoom: center_zoom,
        centerLon: center_lon,
        centerLat: center_lat,
        etag: resp.etag
      };
      return header;
    });
  }
  function getZxy(header, source, cache, z, x, y, signal) {
    return __async(this, null, function* () {
      let root_dir = yield cache.getArrayBuffer(
        source,
        header.rootDirectoryOffset,
        header.rootDirectoryLength,
        header
      );
      if (header.specVersion === 1) {
        root_dir = sortDir(root_dir);
      }
      const entry = queryTile(new DataView(root_dir), z, x, y);
      if (entry) {
        const resp = yield source.getBytes(entry.offset, entry.length, signal);
        let tile_data = resp.data;
        const view = new DataView(tile_data);
        if (view.getUint8(0) == 31 && view.getUint8(1) == 139) {
          tile_data = decompressSync(new Uint8Array(tile_data));
        }
        return {
          data: tile_data
        };
      }
      const leafcoords = deriveLeaf(new DataView(root_dir), { z, x, y });
      if (leafcoords) {
        const leafdir_entry = queryLeafdir(
          new DataView(root_dir),
          leafcoords.z,
          leafcoords.x,
          leafcoords.y
        );
        if (leafdir_entry) {
          let leaf_dir = yield cache.getArrayBuffer(
            source,
            leafdir_entry.offset,
            leafdir_entry.length,
            header
          );
          if (header.specVersion === 1) {
            leaf_dir = sortDir(leaf_dir);
          }
          const tile_entry = queryTile(new DataView(leaf_dir), z, x, y);
          if (tile_entry) {
            const resp = yield source.getBytes(
              tile_entry.offset,
              tile_entry.length,
              signal
            );
            let tile_data = resp.data;
            const view = new DataView(tile_data);
            if (view.getUint8(0) == 31 && view.getUint8(1) == 139) {
              tile_data = decompressSync(new Uint8Array(tile_data));
            }
            return {
              data: tile_data
            };
          }
        }
      }
      return void 0;
    });
  }
  var v2_default = {
    getHeader,
    getZxy
  };

  // adapters.ts
  var leafletRasterLayer = (source, options) => {
    let loaded = false;
    let mimeType = "";
    const cls = L.GridLayer.extend({
      createTile: function(coord, done) {
        const el = document.createElement("img");
        const controller = new AbortController();
        const signal = controller.signal;
        el.cancel = () => {
          controller.abort();
        };
        if (!loaded) {
          source.getHeader().then((header) => {
            if (header.tileType == 1 /* Mvt */) {
              console.error(
                "Error: archive contains MVT vector tiles, but leafletRasterLayer is for displaying raster tiles. See https://github.com/protomaps/PMTiles/tree/main/js for details."
              );
            } else if (header.tileType == 2) {
              mimeType = "image/png";
            } else if (header.tileType == 3) {
              mimeType = "image/jpeg";
            } else if (header.tileType == 4) {
              mimeType = "image/webp";
            } else if (header.tileType == 5) {
              mimeType = "image/avif";
            }
          });
          loaded = true;
        }
        source.getZxy(coord.z, coord.x, coord.y, signal).then((arr) => {
          if (arr) {
            const blob = new Blob([arr.data], { type: mimeType });
            const imageUrl = window.URL.createObjectURL(blob);
            el.src = imageUrl;
            el.cancel = null;
            done(null, el);
          }
        }).catch((e) => {
          if (e.name !== "AbortError") {
            throw e;
          }
        });
        return el;
      },
      _removeTile: function(key) {
        const tile = this._tiles[key];
        if (!tile) {
          return;
        }
        if (tile.el.cancel)
          tile.el.cancel();
        tile.el.width = 0;
        tile.el.height = 0;
        tile.el.deleted = true;
        L.DomUtil.remove(tile.el);
        delete this._tiles[key];
        this.fire("tileunload", {
          tile: tile.el,
          coords: this._keyToTileCoords(key)
        });
      }
    });
    return new cls(options);
  };
  var Protocol = class {
    constructor() {
      this.tile = (params, callback) => {
        if (params.type == "json") {
          const pmtiles_url = params.url.substr(10);
          let instance = this.tiles.get(pmtiles_url);
          if (!instance) {
            instance = new PMTiles(pmtiles_url);
            this.tiles.set(pmtiles_url, instance);
          }
          instance.getHeader().then((h) => {
            const tilejson = {
              tiles: [params.url + "/{z}/{x}/{y}"],
              minzoom: h.minZoom,
              maxzoom: h.maxZoom,
              bounds: [h.minLon, h.minLat, h.maxLon, h.maxLat]
            };
            callback(null, tilejson, null, null);
          }).catch((e) => {
            callback(e, null, null, null);
          });
          return {
            cancel: () => {
            }
          };
        } else {
          const re = new RegExp(/pmtiles:\/\/(.+)\/(\d+)\/(\d+)\/(\d+)/);
          const result = params.url.match(re);
          if (!result) {
            throw new Error("Invalid PMTiles protocol URL");
            return {
              cancel: () => {
              }
            };
          }
          const pmtiles_url = result[1];
          let instance = this.tiles.get(pmtiles_url);
          if (!instance) {
            instance = new PMTiles(pmtiles_url);
            this.tiles.set(pmtiles_url, instance);
          }
          const z = result[2];
          const x = result[3];
          const y = result[4];
          const controller = new AbortController();
          const signal = controller.signal;
          let cancel = () => {
            controller.abort();
          };
          instance.getHeader().then((header) => {
            instance.getZxy(+z, +x, +y, signal).then((resp) => {
              if (resp) {
                callback(
                  null,
                  new Uint8Array(resp.data),
                  resp.cacheControl,
                  resp.expires
                );
              } else {
                if (header.tileType == 1 /* Mvt */) {
                  callback(null, new Uint8Array(), null, null);
                } else {
                  callback(null, null, null, null);
                }
              }
            }).catch((e) => {
              if (e.name !== "AbortError") {
                callback(e, null, null, null);
              }
            });
          });
          return {
            cancel
          };
        }
      };
      this.tiles = /* @__PURE__ */ new Map();
    }
    add(p) {
      this.tiles.set(p.source.getKey(), p);
    }
    get(url) {
      return this.tiles.get(url);
    }
  };

  // index.ts
  function toNum(low, high) {
    return (high >>> 0) * 4294967296 + (low >>> 0);
  }
  function readVarintRemainder(l, p) {
    const buf = p.buf;
    let h, b;
    b = buf[p.pos++];
    h = (b & 112) >> 4;
    if (b < 128)
      return toNum(l, h);
    b = buf[p.pos++];
    h |= (b & 127) << 3;
    if (b < 128)
      return toNum(l, h);
    b = buf[p.pos++];
    h |= (b & 127) << 10;
    if (b < 128)
      return toNum(l, h);
    b = buf[p.pos++];
    h |= (b & 127) << 17;
    if (b < 128)
      return toNum(l, h);
    b = buf[p.pos++];
    h |= (b & 127) << 24;
    if (b < 128)
      return toNum(l, h);
    b = buf[p.pos++];
    h |= (b & 1) << 31;
    if (b < 128)
      return toNum(l, h);
    throw new Error("Expected varint not more than 10 bytes");
  }
  function readVarint(p) {
    const buf = p.buf;
    let val, b;
    b = buf[p.pos++];
    val = b & 127;
    if (b < 128)
      return val;
    b = buf[p.pos++];
    val |= (b & 127) << 7;
    if (b < 128)
      return val;
    b = buf[p.pos++];
    val |= (b & 127) << 14;
    if (b < 128)
      return val;
    b = buf[p.pos++];
    val |= (b & 127) << 21;
    if (b < 128)
      return val;
    b = buf[p.pos];
    val |= (b & 15) << 28;
    return readVarintRemainder(val, p);
  }
  function rotate(n, xy, rx, ry) {
    if (ry == 0) {
      if (rx == 1) {
        xy[0] = n - 1 - xy[0];
        xy[1] = n - 1 - xy[1];
      }
      const t = xy[0];
      xy[0] = xy[1];
      xy[1] = t;
    }
  }
  function idOnLevel(z, pos) {
    const n = Math.pow(2, z);
    let rx = pos;
    let ry = pos;
    let t = pos;
    const xy = [0, 0];
    let s = 1;
    while (s < n) {
      rx = 1 & t / 2;
      ry = 1 & (t ^ rx);
      rotate(s, xy, rx, ry);
      xy[0] += s * rx;
      xy[1] += s * ry;
      t = t / 4;
      s *= 2;
    }
    return [z, xy[0], xy[1]];
  }
  var tzValues = [
    0,
    1,
    5,
    21,
    85,
    341,
    1365,
    5461,
    21845,
    87381,
    349525,
    1398101,
    5592405,
    22369621,
    89478485,
    357913941,
    1431655765,
    5726623061,
    22906492245,
    91625968981,
    366503875925,
    1466015503701,
    5864062014805,
    23456248059221,
    93824992236885,
    375299968947541,
    1501199875790165
  ];
  function zxyToTileId(z, x, y) {
    if (z > 26) {
      throw Error("Tile zoom level exceeds max safe number limit (26)");
    }
    if (x > Math.pow(2, z) - 1 || y > Math.pow(2, z) - 1) {
      throw Error("tile x/y outside zoom level bounds");
    }
    const acc = tzValues[z];
    const n = Math.pow(2, z);
    let rx = 0;
    let ry = 0;
    let d = 0;
    const xy = [x, y];
    let s = n / 2;
    while (s > 0) {
      rx = (xy[0] & s) > 0 ? 1 : 0;
      ry = (xy[1] & s) > 0 ? 1 : 0;
      d += s * s * (3 * rx ^ ry);
      rotate(s, xy, rx, ry);
      s = s / 2;
    }
    return acc + d;
  }
  function tileIdToZxy(i) {
    let acc = 0;
    let z = 0;
    for (let z2 = 0; z2 < 27; z2++) {
      const num_tiles = (1 << z2) * (1 << z2);
      if (acc + num_tiles > i) {
        return idOnLevel(z2, i - acc);
      }
      acc += num_tiles;
    }
    throw Error("Tile zoom level exceeds max safe number limit (26)");
  }
  var Compression = /* @__PURE__ */ ((Compression2) => {
    Compression2[Compression2["Unknown"] = 0] = "Unknown";
    Compression2[Compression2["None"] = 1] = "None";
    Compression2[Compression2["Gzip"] = 2] = "Gzip";
    Compression2[Compression2["Brotli"] = 3] = "Brotli";
    Compression2[Compression2["Zstd"] = 4] = "Zstd";
    return Compression2;
  })(Compression || {});
  function defaultDecompress(buf, compression) {
    return __async(this, null, function* () {
      if (compression === 1 /* None */ || compression === 0 /* Unknown */) {
        return buf;
      } else if (compression === 2 /* Gzip */) {
        if (typeof globalThis.DecompressionStream == "undefined") {
          return decompressSync(new Uint8Array(buf));
        } else {
          let stream = new Response(buf).body;
          let result = stream.pipeThrough(
            new globalThis.DecompressionStream("gzip")
          );
          return new Response(result).arrayBuffer();
        }
      } else {
        throw Error("Compression method not supported");
      }
    });
  }
  var TileType = /* @__PURE__ */ ((TileType2) => {
    TileType2[TileType2["Unknown"] = 0] = "Unknown";
    TileType2[TileType2["Mvt"] = 1] = "Mvt";
    TileType2[TileType2["Png"] = 2] = "Png";
    TileType2[TileType2["Jpeg"] = 3] = "Jpeg";
    TileType2[TileType2["Webp"] = 4] = "Webp";
    TileType2[TileType2["Avif"] = 5] = "Avif";
    return TileType2;
  })(TileType || {});
  var HEADER_SIZE_BYTES = 127;
  function findTile(entries, tileId) {
    let m = 0;
    let n = entries.length - 1;
    while (m <= n) {
      const k = n + m >> 1;
      const cmp = tileId - entries[k].tileId;
      if (cmp > 0) {
        m = k + 1;
      } else if (cmp < 0) {
        n = k - 1;
      } else {
        return entries[k];
      }
    }
    if (n >= 0) {
      if (entries[n].runLength === 0) {
        return entries[n];
      }
      if (tileId - entries[n].tileId < entries[n].runLength) {
        return entries[n];
      }
    }
    return null;
  }
  var FileAPISource = class {
    constructor(file) {
      this.file = file;
    }
    getKey() {
      return this.file.name;
    }
    getBytes(offset, length) {
      return __async(this, null, function* () {
        const blob = this.file.slice(offset, offset + length);
        const a = yield blob.arrayBuffer();
        return { data: a };
      });
    }
  };
  var FetchSource = class {
    constructor(url, customHeaders = new Headers()) {
      this.url = url;
      this.customHeaders = customHeaders;
    }
    getKey() {
      return this.url;
    }
    setHeaders(customHeaders) {
      this.customHeaders = customHeaders;
    }
    getBytes(offset, length, signal) {
      return __async(this, null, function* () {
        let controller;
        if (!signal) {
          controller = new AbortController();
          signal = controller.signal;
        }
        const requestHeaders = new Headers(this.customHeaders);
        requestHeaders.set(
          "Range",
          "bytes=" + offset + "-" + (offset + length - 1)
        );
        let resp = yield fetch(this.url, {
          signal,
          headers: requestHeaders
        });
        if (resp.status === 416 && offset === 0) {
          const content_range = resp.headers.get("Content-Range");
          if (!content_range || !content_range.startsWith("bytes */")) {
            throw Error("Missing content-length on 416 response");
          }
          const actual_length = +content_range.substr(8);
          resp = yield fetch(this.url, {
            signal,
            headers: { Range: "bytes=0-" + (actual_length - 1) }
          });
        }
        if (resp.status >= 300) {
          throw Error("Bad response code: " + resp.status);
        }
        const content_length = resp.headers.get("Content-Length");
        if (resp.status === 200 && (!content_length || +content_length > length)) {
          if (controller)
            controller.abort();
          throw Error(
            "Server returned no content-length header or content-length exceeding request. Check that your storage backend supports HTTP Byte Serving."
          );
        }
        const a = yield resp.arrayBuffer();
        return {
          data: a,
          etag: resp.headers.get("ETag") || void 0,
          cacheControl: resp.headers.get("Cache-Control") || void 0,
          expires: resp.headers.get("Expires") || void 0
        };
      });
    }
  };
  function getUint64(v, offset) {
    const wh = v.getUint32(offset + 4, true);
    const wl = v.getUint32(offset + 0, true);
    return wh * Math.pow(2, 32) + wl;
  }
  function bytesToHeader(bytes, etag) {
    const v = new DataView(bytes);
    const spec_version = v.getUint8(7);
    if (spec_version > 3) {
      throw Error(
        `Archive is spec version ${spec_version} but this library supports up to spec version 3`
      );
    }
    return {
      specVersion: spec_version,
      rootDirectoryOffset: getUint64(v, 8),
      rootDirectoryLength: getUint64(v, 16),
      jsonMetadataOffset: getUint64(v, 24),
      jsonMetadataLength: getUint64(v, 32),
      leafDirectoryOffset: getUint64(v, 40),
      leafDirectoryLength: getUint64(v, 48),
      tileDataOffset: getUint64(v, 56),
      tileDataLength: getUint64(v, 64),
      numAddressedTiles: getUint64(v, 72),
      numTileEntries: getUint64(v, 80),
      numTileContents: getUint64(v, 88),
      clustered: v.getUint8(96) === 1,
      internalCompression: v.getUint8(97),
      tileCompression: v.getUint8(98),
      tileType: v.getUint8(99),
      minZoom: v.getUint8(100),
      maxZoom: v.getUint8(101),
      minLon: v.getInt32(102, true) / 1e7,
      minLat: v.getInt32(106, true) / 1e7,
      maxLon: v.getInt32(110, true) / 1e7,
      maxLat: v.getInt32(114, true) / 1e7,
      centerZoom: v.getUint8(118),
      centerLon: v.getInt32(119, true) / 1e7,
      centerLat: v.getInt32(123, true) / 1e7,
      etag
    };
  }
  function deserializeIndex(buffer) {
    const p = { buf: new Uint8Array(buffer), pos: 0 };
    const numEntries = readVarint(p);
    const entries = [];
    let lastId = 0;
    for (let i = 0; i < numEntries; i++) {
      const v = readVarint(p);
      entries.push({ tileId: lastId + v, offset: 0, length: 0, runLength: 1 });
      lastId += v;
    }
    for (let i = 0; i < numEntries; i++) {
      entries[i].runLength = readVarint(p);
    }
    for (let i = 0; i < numEntries; i++) {
      entries[i].length = readVarint(p);
    }
    for (let i = 0; i < numEntries; i++) {
      const v = readVarint(p);
      if (v === 0 && i > 0) {
        entries[i].offset = entries[i - 1].offset + entries[i - 1].length;
      } else {
        entries[i].offset = v - 1;
      }
    }
    return entries;
  }
  function detectVersion(a) {
    const v = new DataView(a);
    if (v.getUint16(2, true) === 2) {
      console.warn(
        "PMTiles spec version 2 has been deprecated; please see github.com/protomaps/PMTiles for tools to upgrade"
      );
      return 2;
    } else if (v.getUint16(2, true) === 1) {
      console.warn(
        "PMTiles spec version 1 has been deprecated; please see github.com/protomaps/PMTiles for tools to upgrade"
      );
      return 1;
    }
    return 3;
  }
  var EtagMismatch = class extends Error {
  };
  function getHeaderAndRoot(source, decompress, prefetch, current_etag) {
    return __async(this, null, function* () {
      const resp = yield source.getBytes(0, 16384);
      const v = new DataView(resp.data);
      if (v.getUint16(0, true) !== 19792) {
        throw new Error("Wrong magic number for PMTiles archive");
      }
      if (detectVersion(resp.data) < 3) {
        return [yield v2_default.getHeader(source)];
      }
      const headerData = resp.data.slice(0, HEADER_SIZE_BYTES);
      let resp_etag = resp.etag;
      if (current_etag && resp.etag != current_etag) {
        console.warn(
          "ETag conflict detected; your HTTP server might not support content-based ETag headers. ETags disabled for " + source.getKey()
        );
        resp_etag = void 0;
      }
      const header = bytesToHeader(headerData, resp_etag);
      if (prefetch) {
        const rootDirData = resp.data.slice(
          header.rootDirectoryOffset,
          header.rootDirectoryOffset + header.rootDirectoryLength
        );
        const dirKey = source.getKey() + "|" + (header.etag || "") + "|" + header.rootDirectoryOffset + "|" + header.rootDirectoryLength;
        const rootDir = deserializeIndex(
          yield decompress(rootDirData, header.internalCompression)
        );
        return [header, [dirKey, rootDir.length, rootDir]];
      }
      return [header, void 0];
    });
  }
  function getDirectory(source, decompress, offset, length, header) {
    return __async(this, null, function* () {
      const resp = yield source.getBytes(offset, length);
      if (header.etag && header.etag !== resp.etag) {
        throw new EtagMismatch(resp.etag);
      }
      const data = yield decompress(resp.data, header.internalCompression);
      const directory = deserializeIndex(data);
      if (directory.length === 0) {
        throw new Error("Empty directory is invalid");
      }
      return directory;
    });
  }
  var ResolvedValueCache = class {
    constructor(maxCacheEntries = 100, prefetch = true, decompress = defaultDecompress) {
      this.cache = /* @__PURE__ */ new Map();
      this.maxCacheEntries = maxCacheEntries;
      this.counter = 1;
      this.prefetch = prefetch;
      this.decompress = decompress;
    }
    getHeader(source, current_etag) {
      return __async(this, null, function* () {
        const cacheKey = source.getKey();
        if (this.cache.has(cacheKey)) {
          this.cache.get(cacheKey).lastUsed = this.counter++;
          const data = this.cache.get(cacheKey).data;
          return data;
        }
        const res = yield getHeaderAndRoot(
          source,
          this.decompress,
          this.prefetch,
          current_etag
        );
        if (res[1]) {
          this.cache.set(res[1][0], {
            lastUsed: this.counter++,
            data: res[1][2]
          });
        }
        this.cache.set(cacheKey, {
          lastUsed: this.counter++,
          data: res[0]
        });
        this.prune();
        return res[0];
      });
    }
    getDirectory(source, offset, length, header) {
      return __async(this, null, function* () {
        const cacheKey = source.getKey() + "|" + (header.etag || "") + "|" + offset + "|" + length;
        if (this.cache.has(cacheKey)) {
          this.cache.get(cacheKey).lastUsed = this.counter++;
          const data = this.cache.get(cacheKey).data;
          return data;
        }
        const directory = yield getDirectory(
          source,
          this.decompress,
          offset,
          length,
          header
        );
        this.cache.set(cacheKey, {
          lastUsed: this.counter++,
          data: directory
        });
        this.prune();
        return directory;
      });
    }
    getArrayBuffer(source, offset, length, header) {
      return __async(this, null, function* () {
        const cacheKey = source.getKey() + "|" + (header.etag || "") + "|" + offset + "|" + length;
        if (this.cache.has(cacheKey)) {
          this.cache.get(cacheKey).lastUsed = this.counter++;
          const data = yield this.cache.get(cacheKey).data;
          return data;
        }
        const resp = yield source.getBytes(offset, length);
        if (header.etag && header.etag !== resp.etag) {
          throw new EtagMismatch(header.etag);
        }
        this.cache.set(cacheKey, {
          lastUsed: this.counter++,
          data: resp.data
        });
        this.prune();
        return resp.data;
      });
    }
    prune() {
      if (this.cache.size > this.maxCacheEntries) {
        let minUsed = Infinity;
        let minKey = void 0;
        this.cache.forEach((cache_value, key) => {
          if (cache_value.lastUsed < minUsed) {
            minUsed = cache_value.lastUsed;
            minKey = key;
          }
        });
        if (minKey) {
          this.cache.delete(minKey);
        }
      }
    }
    invalidate(source, current_etag) {
      return __async(this, null, function* () {
        this.cache.delete(source.getKey());
        yield this.getHeader(source, current_etag);
      });
    }
  };
  var SharedPromiseCache = class {
    constructor(maxCacheEntries = 100, prefetch = true, decompress = defaultDecompress) {
      this.cache = /* @__PURE__ */ new Map();
      this.maxCacheEntries = maxCacheEntries;
      this.counter = 1;
      this.prefetch = prefetch;
      this.decompress = decompress;
    }
    getHeader(source, current_etag) {
      return __async(this, null, function* () {
        const cacheKey = source.getKey();
        if (this.cache.has(cacheKey)) {
          this.cache.get(cacheKey).lastUsed = this.counter++;
          const data = yield this.cache.get(cacheKey).data;
          return data;
        }
        const p = new Promise((resolve, reject) => {
          getHeaderAndRoot(source, this.decompress, this.prefetch, current_etag).then((res) => {
            if (res[1]) {
              this.cache.set(res[1][0], {
                lastUsed: this.counter++,
                data: Promise.resolve(res[1][2])
              });
            }
            resolve(res[0]);
            this.prune();
          }).catch((e) => {
            reject(e);
          });
        });
        this.cache.set(cacheKey, { lastUsed: this.counter++, data: p });
        return p;
      });
    }
    getDirectory(source, offset, length, header) {
      return __async(this, null, function* () {
        const cacheKey = source.getKey() + "|" + (header.etag || "") + "|" + offset + "|" + length;
        if (this.cache.has(cacheKey)) {
          this.cache.get(cacheKey).lastUsed = this.counter++;
          const data = yield this.cache.get(cacheKey).data;
          return data;
        }
        const p = new Promise((resolve, reject) => {
          getDirectory(source, this.decompress, offset, length, header).then((directory) => {
            resolve(directory);
            this.prune();
          }).catch((e) => {
            reject(e);
          });
        });
        this.cache.set(cacheKey, { lastUsed: this.counter++, data: p });
        return p;
      });
    }
    getArrayBuffer(source, offset, length, header) {
      return __async(this, null, function* () {
        const cacheKey = source.getKey() + "|" + (header.etag || "") + "|" + offset + "|" + length;
        if (this.cache.has(cacheKey)) {
          this.cache.get(cacheKey).lastUsed = this.counter++;
          const data = yield this.cache.get(cacheKey).data;
          return data;
        }
        const p = new Promise((resolve, reject) => {
          source.getBytes(offset, length).then((resp) => {
            if (header.etag && header.etag !== resp.etag) {
              throw new EtagMismatch(resp.etag);
            }
            resolve(resp.data);
            if (this.cache.has(cacheKey)) {
            }
            this.prune();
          }).catch((e) => {
            reject(e);
          });
        });
        this.cache.set(cacheKey, { lastUsed: this.counter++, data: p });
        return p;
      });
    }
    prune() {
      if (this.cache.size >= this.maxCacheEntries) {
        let minUsed = Infinity;
        let minKey = void 0;
        this.cache.forEach(
          (cache_value, key) => {
            if (cache_value.lastUsed < minUsed) {
              minUsed = cache_value.lastUsed;
              minKey = key;
            }
          }
        );
        if (minKey) {
          this.cache.delete(minKey);
        }
      }
    }
    invalidate(source, current_etag) {
      return __async(this, null, function* () {
        this.cache.delete(source.getKey());
        yield this.getHeader(source, current_etag);
      });
    }
  };
  var PMTiles = class {
    constructor(source, cache, decompress) {
      if (typeof source === "string") {
        this.source = new FetchSource(source);
      } else {
        this.source = source;
      }
      if (decompress) {
        this.decompress = decompress;
      } else {
        this.decompress = defaultDecompress;
      }
      if (cache) {
        this.cache = cache;
      } else {
        this.cache = new SharedPromiseCache();
      }
    }
    getHeader() {
      return __async(this, null, function* () {
        return yield this.cache.getHeader(this.source);
      });
    }
    getZxyAttempt(z, x, y, signal) {
      return __async(this, null, function* () {
        const tile_id = zxyToTileId(z, x, y);
        const header = yield this.cache.getHeader(this.source);
        if (header.specVersion < 3) {
          return v2_default.getZxy(header, this.source, this.cache, z, x, y, signal);
        }
        if (z < header.minZoom || z > header.maxZoom) {
          return void 0;
        }
        let d_o = header.rootDirectoryOffset;
        let d_l = header.rootDirectoryLength;
        for (let depth = 0; depth <= 3; depth++) {
          const directory = yield this.cache.getDirectory(
            this.source,
            d_o,
            d_l,
            header
          );
          const entry = findTile(directory, tile_id);
          if (entry) {
            if (entry.runLength > 0) {
              const resp = yield this.source.getBytes(
                header.tileDataOffset + entry.offset,
                entry.length,
                signal
              );
              if (header.etag && header.etag !== resp.etag) {
                throw new EtagMismatch(resp.etag);
              }
              return {
                data: yield this.decompress(resp.data, header.tileCompression),
                cacheControl: resp.cacheControl,
                expires: resp.expires
              };
            } else {
              d_o = header.leafDirectoryOffset + entry.offset;
              d_l = entry.length;
            }
          } else {
            return void 0;
          }
        }
        throw Error("Maximum directory depth exceeded");
      });
    }
    getZxy(z, x, y, signal) {
      return __async(this, null, function* () {
        try {
          return yield this.getZxyAttempt(z, x, y, signal);
        } catch (e) {
          if (e instanceof EtagMismatch) {
            this.cache.invalidate(this.source, e.message);
            return yield this.getZxyAttempt(z, x, y, signal);
          } else {
            throw e;
          }
        }
      });
    }
    getMetadataAttempt() {
      return __async(this, null, function* () {
        const header = yield this.cache.getHeader(this.source);
        const resp = yield this.source.getBytes(
          header.jsonMetadataOffset,
          header.jsonMetadataLength
        );
        if (header.etag && header.etag !== resp.etag) {
          throw new EtagMismatch(resp.etag);
        }
        const decompressed = yield this.decompress(
          resp.data,
          header.internalCompression
        );
        const dec = new TextDecoder("utf-8");
        return JSON.parse(dec.decode(decompressed));
      });
    }
    getMetadata() {
      return __async(this, null, function* () {
        try {
          return yield this.getMetadataAttempt();
        } catch (e) {
          if (e instanceof EtagMismatch) {
            this.cache.invalidate(this.source, e.message);
            return yield this.getMetadataAttempt();
          } else {
            throw e;
          }
        }
      });
    }
  };
  return __toCommonJS(js_exports);
})();
// Assign to window for global access
window.pmtilesLib = pmtiles;
