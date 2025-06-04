/* eslint-disable */
// @ts-nocheck

import {LRUCache} from '../../util/lru';

function readTileHeader(pbf, end) {
  return pbf.readFields(readTileHeaderTag, {
    headerLength: 0,
    x: 0,
    y: 0,
    z: 0,
    layers: []
  }, end);
}
function readTileHeaderTag(tag, obj, pbf) {
  if (tag === 1) obj.headerLength = pbf.readFixed32();else if (tag === 2) obj.x = pbf.readVarint();else if (tag === 3) obj.y = pbf.readVarint();else if (tag === 4) obj.z = pbf.readVarint();else if (tag === 5) obj.layers.push(readLayer(pbf, pbf.readVarint() + pbf.pos));
}
function readFilter(pbf, end) {
  return pbf.readFields(readFilterTag, {}, end);
}
function readFilterTag(tag, obj, pbf) {
  if (tag === 1) {
    obj.delta_filter = readFilterDelta(pbf, pbf.readVarint() + pbf.pos);
    obj.filter = 'delta_filter';
  } else if (tag === 2) {
    pbf.readVarint();
    obj.filter = 'zigzag_filter';
  } else if (tag === 3) {
    pbf.readVarint();
    obj.filter = 'bitshuffle_filter';
  } else if (tag === 4) {
    pbf.readVarint();
    obj.filter = 'byteshuffle_filter';
  }
}
function readFilterDelta(pbf, end) {
  return pbf.readFields(readFilterDeltaTag, {
    blockSize: 0
  }, end);
}
function readFilterDeltaTag(tag, obj, pbf) {
  if (tag === 1) obj.blockSize = pbf.readVarint();
}
function readCodec(pbf, end) {
  return pbf.readFields(readCodecTag, {}, end);
}
function readCodecTag(tag, obj, pbf) {
  if (tag === 1) {
    pbf.readVarint();
    obj.codec = 'gzip_data';
  } else if (tag === 2) {
    pbf.readVarint();
    obj.codec = 'jpeg_image';
  } else if (tag === 3) {
    pbf.readVarint();
    obj.codec = 'webp_image';
  } else if (tag === 4) {
    pbf.readVarint();
    obj.codec = 'png_image';
  }
}
function readDataIndexEntry(pbf, end) {
  return pbf.readFields(readDataIndexEntryTag, {
    firstByte: 0,
    lastByte: 0,
    filters: [],
    codec: null,
    offset: 0,
    scale: 0,
    bands: []
  }, end);
}
function readDataIndexEntryTag(tag, obj, pbf) {
  let deprecated_scale = 0;
  let deprecated_offset = 0;
  if (tag === 1) obj.firstByte = pbf.readFixed64();else if (tag === 2) obj.lastByte = pbf.readFixed64();else if (tag === 3) obj.filters.push(readFilter(pbf, pbf.readVarint() + pbf.pos));else if (tag === 4) obj.codec = readCodec(pbf, pbf.readVarint() + pbf.pos);else if (tag === 5) deprecated_offset = pbf.readFloat();else if (tag === 6) deprecated_scale = pbf.readFloat();else if (tag === 7) obj.bands.push(pbf.readString());else if (tag === 8) obj.offset = pbf.readDouble();else if (tag === 9) obj.scale = pbf.readDouble();

  // Overwrite these values if they're zero. Scale can never be zero, so this could only
  // mean it's being overwritten with something that is potentially valid (or at least
  // not any more invalid). For offset, the same situation applies except that it could
  // technically have been affirmatively set to zero to begin with. However, it would then
  // be overwritten with the deprecated float32 value, which is identically zero whether
  // or not it was actually set. At the end of the day, it only achieves some increased
  // robustness for historical tilesets written during early beta, before the field type
  // was upgraded to double precision.
  if (obj.offset === 0) obj.offset = deprecated_offset;
  if (obj.scale === 0) obj.scale = deprecated_scale;
}
function readLayer(pbf, end) {
  return pbf.readFields(readLayerTag, {
    version: 0,
    name: '',
    units: '',
    tileSize: 0,
    buffer: 0,
    pixelFormat: 0,
    dataIndex: []
  }, end);
}
function readLayerTag(tag, obj, pbf) {
  if (tag === 1) obj.version = pbf.readVarint();else if (tag === 2) obj.name = pbf.readString();else if (tag === 3) obj.units = pbf.readString();else if (tag === 4) obj.tileSize = pbf.readVarint();else if (tag === 5) obj.buffer = pbf.readVarint();else if (tag === 6) obj.pixelFormat = pbf.readVarint();else if (tag === 7) obj.dataIndex.push(readDataIndexEntry(pbf, pbf.readVarint() + pbf.pos));
}
function readNumericData(pbf, values) {
  pbf.readFields(readNumericDataTag, values);
}
function readNumericDataTag(tag, values, pbf) {
  if (tag === 2) {
    readUint32Values(pbf, pbf.readVarint() + pbf.pos, values);
  } else if (tag === 3) {
    throw new Error('Not implemented');
  }
}
function readUint32Values(pbf, end, values) {
  return pbf.readFields(readUint32ValuesTag, values, end);
}
function readUint32ValuesTag(tag, values, pbf) {
  if (tag === 1) {
    let i = 0;
    const end = pbf.readVarint() + pbf.pos;
    while (pbf.pos < end) {
      values[i++] = pbf.readVarint();
    }
  }
}

/**
 * Decode difference-encoded data using a cumulative sum operation along
 * the last two (raster row and column) axes.
 *
 * @param {TArrayLike} data - flat array of input data
 * @param {number[]} shape - array dimensions, *including* the pixel dimension,
 *                           i.e. 1, 2, or 4 reflecting whether the data is
 *                           uint32, uint16, or uint8, respectively.
 * @return {TArrayLike} - differenced ndarray
 */
function deltaDecode(data, shape) {
  if (shape.length !== 4) {
    throw new Error(`Expected data of dimension 4 but got ${shape.length}.`);
  }

  // Sum over dimensions 1 and 2 of 0, 1, 2, 3
  let axisOffset = shape[3];
  for (let axis = 2; axis >= 1; axis--) {
    const start1 = axis === 1 ? 1 : 0;
    const start2 = axis === 2 ? 1 : 0;
    for (let i0 = 0; i0 < shape[0]; i0++) {
      const offset0 = shape[1] * i0;
      for (let i1 = start1; i1 < shape[1]; i1++) {
        const offset1 = shape[2] * (i1 + offset0);
        for (let i2 = start2; i2 < shape[2]; i2++) {
          const offset2 = shape[3] * (i2 + offset1);
          for (let i3 = 0; i3 < shape[3]; i3++) {
            const offset3 = offset2 + i3;
            data[offset3] += data[offset3 - axisOffset];
          }
        }
      }
    }
    axisOffset *= shape[axis];
  }
  return data;
}

/**
 * Perform zigzag decoding.
 *
 * The purpose of this operation is to turn two's complement signed 32-bit
 * integers into small positive integers. It does this by performing a
 * circular shift and rotating the sign bit all the way over to the least
 * significant bit. At the same time, it inverts the bits of negative numbers
 * so that all those two's complement ones turn into zeros.
 *
 * This operation is a bitwise equivalent of the mathematical operation
 *
 *     x % 2 === 1
 *       ? (x + 1) / -2
 *       : x / 2
 *
 * Unlike the bitwise version though, it works throughout the entire 32-bit
 * unsigned range without overflow.
 *
 * Note that this imlementation works on Uint32Array, Uint16Array, and
 * Uint8Array input without needing to specially handle the different types.
 *
 * @param {TArrayLike} data - flat array of input data
 * @return {TArrayLike} - zigzag-decoded array
 */
function zigzagDecode(data) {
  for (let i = 0, n = data.length; i < n; i++) {
    data[i] = data[i] >>> 1 ^ -(data[i] & 1);
  }
  return data;
}

/**
 * Perform bitshuffle decoding.
 *
 * @param {TArrayLike} data - flat array of input data
 * @param {TPixelFormat} pixelFormat - pixel format of data
 * @return {TArrayLike} - zigzag-decoded array
 */
function bitshuffleDecode(data, pixelFormat) {
  switch (pixelFormat) {
    case 'uint32':
      return data;
    case 'uint16':
      for (let i = 0; i < data.length; i += 2) {
        const a = data[i];
        const b = data[i + 1];
        data[i] = (a & 0xf0) >> 4 | (a & 0xf000) >> 8 | (b & 0xf0) << 4 | b & 0xf000;
        data[i + 1] = a & 0xf | (a & 0xf00) >> 4 | (b & 0xf) << 8 | (b & 0xf00) << 4;
      }
      return data;
    case 'uint8':
      for (let i = 0; i < data.length; i += 4) {
        const a = data[i];
        const b = data[i + 1];
        const c = data[i + 2];
        const d = data[i + 3];
        data[i + 0] = (a & 0xc0) >> 6 | (b & 0xc0) >> 4 | (c & 0xc0) >> 2 | (d & 0xc0) >> 0;
        data[i + 1] = (a & 0x30) >> 4 | (b & 0x30) >> 2 | (c & 0x30) >> 0 | (d & 0x30) << 2;
        data[i + 2] = (a & 0x0c) >> 2 | (b & 0x0c) >> 0 | (c & 0x0c) << 2 | (d & 0x0c) << 4;
        data[i + 3] = (a & 0x03) >> 0 | (b & 0x03) << 2 | (c & 0x03) << 4 | (d & 0x03) << 6;
      }
      return data;
    default:
      throw new Error(`Invalid pixel format, "${pixelFormat}"`);
  }
}

// DEFLATE is a complex format; to read this code, you should probably check the RFC first:

// aliases for shorter compressed code (most minifers don't do this)
var u8 = Uint8Array,
  u16 = Uint16Array,
  i32 = Int32Array;
// fixed length extra bits
var fleb = new u8([0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0, /* unused */0, 0, /* impossible */0]);
// fixed distance extra bits
var fdeb = new u8([0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13, /* unused */0, 0]);
// code length index map
var clim = new u8([16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]);
// get base, reverse index map from extra bits
var freb = function (eb, start) {
  var b = new u16(31);
  for (var i = 0; i < 31; ++i) {
    b[i] = start += 1 << eb[i - 1];
  }
  // numbers here are at max 18 bits
  var r = new i32(b[30]);
  for (var i = 1; i < 30; ++i) {
    for (var j = b[i]; j < b[i + 1]; ++j) {
      r[j] = j - b[i] << 5 | i;
    }
  }
  return {
    b: b,
    r: r
  };
};
var _a = freb(fleb, 2),
  fl = _a.b,
  revfl = _a.r;
// we can ignore the fact that the other numbers are wrong; they never happen anyway
fl[28] = 258, revfl[258] = 28;
var _b = freb(fdeb, 0),
  fd = _b.b;
// map of value to reverse (assuming 16 bits)
var rev = new u16(32768);
for (var i = 0; i < 32768; ++i) {
  // reverse table algorithm from SO
  var x = (i & 0xAAAA) >> 1 | (i & 0x5555) << 1;
  x = (x & 0xCCCC) >> 2 | (x & 0x3333) << 2;
  x = (x & 0xF0F0) >> 4 | (x & 0x0F0F) << 4;
  rev[i] = ((x & 0xFF00) >> 8 | (x & 0x00FF) << 8) >> 1;
}
// create huffman tree from u8 "map": index -> code length for code index
// mb (max bits) must be at most 15
// TODO: optimize/split up?
var hMap = function (cd, mb, r) {
  var s = cd.length;
  // index
  var i = 0;
  // u16 "map": index -> # of codes with bit length = index
  var l = new u16(mb);
  // length of cd must be 288 (total # of codes)
  for (; i < s; ++i) {
    if (cd[i]) ++l[cd[i] - 1];
  }
  // u16 "map": index -> minimum code for bit length = index
  var le = new u16(mb);
  for (i = 1; i < mb; ++i) {
    le[i] = le[i - 1] + l[i - 1] << 1;
  }
  var co;
  if (r) {
    // u16 "map": index -> number of actual bits, symbol for code
    co = new u16(1 << mb);
    // bits to remove for reverser
    var rvb = 15 - mb;
    for (i = 0; i < s; ++i) {
      // ignore 0 lengths
      if (cd[i]) {
        // num encoding both symbol and bits read
        var sv = i << 4 | cd[i];
        // free bits
        var r_1 = mb - cd[i];
        // start value
        var v = le[cd[i] - 1]++ << r_1;
        // m is end value
        for (var m = v | (1 << r_1) - 1; v <= m; ++v) {
          // every 16 bit value starting with the code yields the same result
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
// fixed length tree
var flt = new u8(288);
for (var i = 0; i < 144; ++i) flt[i] = 8;
for (var i = 144; i < 256; ++i) flt[i] = 9;
for (var i = 256; i < 280; ++i) flt[i] = 7;
for (var i = 280; i < 288; ++i) flt[i] = 8;
// fixed distance tree
var fdt = new u8(32);
for (var i = 0; i < 32; ++i) fdt[i] = 5;
// fixed length map
var flrm = /*#__PURE__*/hMap(flt, 9, 1);
// fixed distance map
var fdrm = /*#__PURE__*/hMap(fdt, 5, 1);
// find max of array
var max = function (a) {
  var m = a[0];
  for (var i = 1; i < a.length; ++i) {
    if (a[i] > m) m = a[i];
  }
  return m;
};
// read d, starting at bit p and mask with m
var bits = function (d, p, m) {
  var o = p / 8 | 0;
  return (d[o] | d[o + 1] << 8) >> (p & 7) & m;
};
// read d, starting at bit p continuing for at least 16 bits
var bits16 = function (d, p) {
  var o = p / 8 | 0;
  return (d[o] | d[o + 1] << 8 | d[o + 2] << 16) >> (p & 7);
};
// get end of byte
var shft = function (p) {
  return (p + 7) / 8 | 0;
};
// typed array slice - allows garbage collector to free original reference,
// while being more compatible than .slice
var slc = function (v, s, e) {
  if (s == null || s < 0) s = 0;
  if (e == null || e > v.length) e = v.length;
  // can't use .constructor in case user-supplied
  return new u8(v.subarray(s, e));
};
// error codes
var ec = ['unexpected EOF', 'invalid block type', 'invalid length/literal', 'invalid distance', 'stream finished', 'no stream handler',, 'no callback', 'invalid UTF-8 data', 'extra field too long', 'date not in range 1980-2099', 'filename too long', 'stream finishing', 'invalid zip data'
// determined by unknown compression method
];
var err = function (ind, msg, nt) {
  var e = new Error(msg || ec[ind]);
  e.code = ind;
  if (Error.captureStackTrace) Error.captureStackTrace(e, err);
  if (!nt) throw e;
  return e;
};
// expands raw DEFLATE data
var inflt = function (dat, st, buf, dict) {
  // source length       dict length
  var sl = dat.length,
    dl = dict ? dict.length : 0;
  if (!sl || st.f && !st.l) return buf || new u8(0);
  var noBuf = !buf;
  // have to estimate size
  var resize = noBuf || st.i != 2;
  // no state
  var noSt = st.i;
  // Assumes roughly 33% compression ratio average
  if (noBuf) buf = new u8(sl * 3);
  // ensure buffer can fit at least l elements
  var cbuf = function (l) {
    var bl = buf.length;
    // need to increase size to fit
    if (l > bl) {
      // Double or set to necessary, whichever is greater
      var nbuf = new u8(Math.max(bl * 2, l));
      nbuf.set(buf);
      buf = nbuf;
    }
  };
  //  last chunk         bitpos           bytes
  var final = st.f || 0,
    pos = st.p || 0,
    bt = st.b || 0,
    lm = st.l,
    dm = st.d,
    lbt = st.m,
    dbt = st.n;
  // total bits
  var tbts = sl * 8;
  do {
    if (!lm) {
      // BFINAL - this is only 1 when last chunk is next
      final = bits(dat, pos, 1);
      // type: 0 = no compression, 1 = fixed huffman, 2 = dynamic huffman
      var type = bits(dat, pos + 1, 3);
      pos += 3;
      if (!type) {
        // go to end of byte boundary
        var s = shft(pos) + 4,
          l = dat[s - 4] | dat[s - 3] << 8,
          t = s + l;
        if (t > sl) {
          if (noSt) err(0);
          break;
        }
        // ensure size
        if (resize) cbuf(bt + l);
        // Copy over uncompressed data
        buf.set(dat.subarray(s, t), bt);
        // Get new bitpos, update byte count
        st.b = bt += l, st.p = pos = t * 8, st.f = final;
        continue;
      } else if (type == 1) lm = flrm, dm = fdrm, lbt = 9, dbt = 5;else if (type == 2) {
        //  literal                            lengths
        var hLit = bits(dat, pos, 31) + 257,
          hcLen = bits(dat, pos + 10, 15) + 4;
        var tl = hLit + bits(dat, pos + 5, 31) + 1;
        pos += 14;
        // length+distance tree
        var ldt = new u8(tl);
        // code length tree
        var clt = new u8(19);
        for (var i = 0; i < hcLen; ++i) {
          // use index map to get real code
          clt[clim[i]] = bits(dat, pos + i * 3, 7);
        }
        pos += hcLen * 3;
        // code lengths bits
        var clb = max(clt),
          clbmsk = (1 << clb) - 1;
        // code lengths map
        var clm = hMap(clt, clb, 1);
        for (var i = 0; i < tl;) {
          var r = clm[bits(dat, pos, clbmsk)];
          // bits read
          pos += r & 15;
          // symbol
          var s = r >> 4;
          // code length to copy
          if (s < 16) {
            ldt[i++] = s;
          } else {
            //  copy   count
            var c = 0,
              n = 0;
            if (s == 16) n = 3 + bits(dat, pos, 3), pos += 2, c = ldt[i - 1];else if (s == 17) n = 3 + bits(dat, pos, 7), pos += 3;else if (s == 18) n = 11 + bits(dat, pos, 127), pos += 7;
            while (n--) ldt[i++] = c;
          }
        }
        //    length tree                 distance tree
        var lt = ldt.subarray(0, hLit),
          dt = ldt.subarray(hLit);
        // max length bits
        lbt = max(lt);
        // max dist bits
        dbt = max(dt);
        lm = hMap(lt, lbt, 1);
        dm = hMap(dt, dbt, 1);
      } else err(1);
      if (pos > tbts) {
        if (noSt) err(0);
        break;
      }
    }
    // Make sure the buffer can hold this + the largest possible addition
    // Maximum chunk size (practically, theoretically infinite) is 2^17
    if (resize) cbuf(bt + 131072);
    var lms = (1 << lbt) - 1,
      dms = (1 << dbt) - 1;
    var lpos = pos;
    for (;; lpos = pos) {
      // bits read, code
      var c = lm[bits16(dat, pos) & lms],
        sym = c >> 4;
      pos += c & 15;
      if (pos > tbts) {
        if (noSt) err(0);
        break;
      }
      if (!c) err(2);
      if (sym < 256) buf[bt++] = sym;else if (sym == 256) {
        lpos = pos, lm = null;
        break;
      } else {
        var add = sym - 254;
        // no extra bits needed if less
        if (sym > 264) {
          // index
          var i = sym - 257,
            b = fleb[i];
          add = bits(dat, pos, (1 << b) - 1) + fl[i];
          pos += b;
        }
        // dist
        var d = dm[bits16(dat, pos) & dms],
          dsym = d >> 4;
        if (!d) err(3);
        pos += d & 15;
        var dt = fd[dsym];
        if (dsym > 3) {
          var b = fdeb[dsym];
          dt += bits16(dat, pos) & (1 << b) - 1, pos += b;
        }
        if (pos > tbts) {
          if (noSt) err(0);
          break;
        }
        if (resize) cbuf(bt + 131072);
        var end = bt + add;
        if (bt < dt) {
          var shift = dl - dt,
            dend = Math.min(dt, end);
          if (shift + bt < 0) err(3);
          for (; bt < dend; ++bt) buf[bt] = dict[shift + bt];
        }
        for (; bt < end; ++bt) buf[bt] = buf[bt - dt];
      }
    }
    st.l = lm, st.p = lpos, st.b = bt, st.f = final;
    if (lm) final = 1, st.m = lbt, st.d = dm, st.n = dbt;
  } while (!final);
  // don't reallocate for streams or user buffers
  return bt != buf.length && noBuf ? slc(buf, 0, bt) : buf.subarray(0, bt);
};
// empty
var et = /*#__PURE__*/new u8(0);
// gzip footer: -8 to -4 = CRC, -4 to -0 is length
// gzip start
var gzs = function (d) {
  if (d[0] != 31 || d[1] != 139 || d[2] != 8) err(6, 'invalid gzip data');
  var flg = d[3];
  var st = 10;
  if (flg & 4) st += (d[10] | d[11] << 8) + 2;
  for (var zs = (flg >> 3 & 1) + (flg >> 4 & 1); zs > 0; zs -= !d[st++]);
  return st + (flg & 2);
};
// gzip length
var gzl = function (d) {
  var l = d.length;
  return (d[l - 4] | d[l - 3] << 8 | d[l - 2] << 16 | d[l - 1] << 24) >>> 0;
};
/**
 * Expands GZIP data
 * @param data The data to decompress
 * @param opts The decompression options
 * @returns The decompressed version of the data
 */
function gunzipSync(data, opts) {
  var st = gzs(data);
  if (st + 8 > data.length) err(6, 'invalid gzip data');
  return inflt(data.subarray(st, -8), {
    i: 2
  }, opts && opts.out || new u8(gzl(data)), opts && opts.dictionary);
}
// text decoder
var td = typeof TextDecoder != 'undefined' && /*#__PURE__*/new TextDecoder();
// text decoder stream
var tds = 0;
try {
  td.decode(et, {
    stream: true
  });
  tds = 1;
} catch (e) {}

/* global Response */

/** @type { { [key: string]: string } } */
const DS_TYPES = {
  gzip_data: 'gzip'
};

/**
 * Decompress a n array of bytes
 *
 * @param {Buffer | Uint8Array} bytes - input bytes
 * @param {TCodec} codec - codec with which data is compressed
 * @return {Promise<Uint8Array | ArrayBuffer>} Promise which resolves with unzipped data
 */
function decompress(bytes, codec) {
  // @ts-ignore
  if (!globalThis.DecompressionStream) {
    switch (codec) {
      case 'gzip_data':
        return Promise.resolve(gunzipSync(bytes));
    }
  }
  const decompressionStreamType = DS_TYPES[codec];
  if (!decompressionStreamType) {
    throw new Error(`Unhandled codec: ${codec}`);
  }

  /** @ts-ignore */
  const ds = new globalThis.DecompressionStream(decompressionStreamType);
  return new Response(new Blob([bytes]).stream().pipeThrough(ds)).arrayBuffer().then(buf => new Uint8Array(buf));
}

/**
 * An error class for MRT modules.
 *
 * MRTError should be thrown only for user input errors and not for
 * internal inconsistencies or assertions. The class is designed to
 * facilitate catching and responding to the end user with meaningful
 * error messages.
 */
class MRTError extends Error {
  /**
   * @param {string} message - error message
   */
  constructor(message) {
    super(message);
    this.name = 'MRTError';
  }
}

const VERSION = '2.0.1';

/** @typedef { import("pbf").default } Pbf; */
/** @typedef { import("./types").TCodec } TCodec */
/** @typedef { import("./types").TArrayLike } TArrayLike; */
/** @typedef { import("./types").TDataRange } TDataRange; */
/** @typedef { import("./types").TBlockReference } TBlockReference; */
/** @typedef { import("./types").TRasterLayerConfig } TRasterLayerConfig; */
/** @typedef { import("./types").TBandViewRGBA } TBandViewRGBA; */
/** @typedef { import("./types").TPbfRasterTileData } TPbfRasterTileData */
/** @typedef { import("./types").TProcessingTask } TProcessingTask */
/** @typedef { import("./types").TProcessingBatch } TProcessingBatch */
/** @typedef { import("./types").TDecodingResult } TDecodingResult */
/** @typedef { import("./types").TPbfDataIndexEntry } TPbfDataIndexEntry */
/** @typedef { import("./types").TPixelFormat } TPixelFormat */

const MRT_VERSION = 1;

/** @type { { [key: number]: TPixelFormat } } */
const PIXEL_FORMAT = {
  0: 'uint32',
  1: 'uint32',
  2: 'uint16',
  3: 'uint8'
};
const PIXEL_FORMAT_TO_DIM_LEN = {
  uint32: 1,
  uint16: 2,
  uint8: 4
};
const PIXEL_FORMAT_TO_CTOR = {
  uint32: Uint32Array,
  uint16: Uint16Array,
  uint8: Uint8Array
};

/** @type {Pbf} */
let Pbf;
class MapboxRasterTile {
  /**
   * @param {number} cacheSize - number of decoded data chunks cached
   */
  constructor(cacheSize = 5) {
    this.x = NaN;
    this.y = NaN;
    this.z = NaN;

    /** @type { { [key: string]: MapboxRasterLayer } } */
    this.layers = {};
    this._cacheSize = cacheSize;
  }

  /**
   * Get a layer instance by name
   * @param {string} layerName - name of requested layer
   * @return {MapboxRasterLayer} layer instance
   */
  getLayer(layerName) {
    const layer = this.layers[layerName];
    if (!layer) throw new MRTError(`Layer '${layerName}' not found`);
    return layer;
  }

  /**
   * Get the length of the header from MRT bytes
   * @param {ArrayBuffer} buf - data buffer
   * @return {number} - length of header, in bytes
   */
  getHeaderLength(buf) {
    const bytes = new Uint8Array(buf);
    const view = new DataView(buf);
    if (bytes[0] !== 0x0d) throw new MRTError('File is not a valid MRT.');
    return view.getUint32(1, true);
  }

  /**
   * @param {ArrayBuffer} buf - data buffer
   * @return {MapboxRasterTile} raster tile instance
   */
  parseHeader(buf) {
    // Validate the magic number
    const bytes = new Uint8Array(buf);
    const headerLength = this.getHeaderLength(buf);
    if (bytes.length < headerLength) {
      throw new MRTError(`Expected header with length >= ${headerLength} but got buffer of length ${bytes.length}`);
    }

    /** @type {Pbf} */
    const pbf = new Pbf(bytes.subarray(0, headerLength));

    /** @type {TPbfRasterTileData} */
    const meta = readTileHeader(pbf);

    // Validate the incoming tile z/x/y matches, if already initialized
    if (!isNaN(this.x) && (this.x !== meta.x || this.y !== meta.y || this.z !== meta.z)) {
      throw new MRTError(`Invalid attempt to parse header ${meta.z}/${meta.x}/${meta.y} for tile ${this.z}/${this.x}/${this.y}`);
    }
    this.x = meta.x;
    this.y = meta.y;
    this.z = meta.z;
    for (const layer of meta.layers) {
      this.layers[layer.name] = new MapboxRasterLayer(layer, {cacheSize: this._cacheSize});
    }
    return this;
  }

  /**
   * Create a serializable representation of a data parsing task
   * @param {TDataRange} range - range of fetched data
   * @return {MRTDecodingBatch} processing task description
   */
  createDecodingTask(range) {
    /** @type {TProcessingTask[]} */
    const tasks = [];
    const layer = this.getLayer(range.layerName);
    for (let blockIndex of range.blockIndices) {
      const block = layer.dataIndex[blockIndex];
      const firstByte = block.firstByte - range.firstByte;
      const lastByte = block.lastByte - range.firstByte;
      if (layer._blocksInProgress.has(blockIndex)) continue;
      const task = {
        layerName: layer.name,
        firstByte,
        lastByte,
        pixelFormat: layer.pixelFormat,
        blockIndex,
        blockShape: [block.bands.length].concat(layer.bandShape),
        buffer: layer.buffer,
        codec: block.codec.codec,
        filters: block.filters.map(f => f.filter)
      };
      layer._blocksInProgress.add(blockIndex);
      tasks.push(task);
    }
    const onCancel = () => {
      tasks.forEach(task => layer._blocksInProgress.delete(task.blockIndex));
    };

    /** @type {(err: Error, results: TDecodingResult[]) => void} */
    const onComplete = (err, results) => {
      tasks.forEach(task => layer._blocksInProgress.delete(task.blockIndex));
      if (err) throw err;
      results.forEach(result => {
        this.getLayer(result.layerName).processDecodedData(result);
      });
    };
    return new MRTDecodingBatch(tasks, onCancel, onComplete);
  }
}
class MapboxRasterLayer {
  /**
   * @param {object} pbf - layer configuration
   * @param {number} pbf.version - major version of MRT specification with which tile was encoded
   * @param {string} pbf.name - layer name
   * @param {string} pbf.units - layer units
   * @param {number} pbf.tileSize - number of rows and columns in raster data
   * @param {number} pbf.buffer - number of pixels around the edge of each tile
   * @param {number} pbf.pixelFormat - encoded pixel format enum indicating uint32, uint16, or uint8
   * @param {TPbfDataIndexEntry[]} pbf.dataIndex - index of data chunk byte offsets
   * @param {TRasterLayerConfig} [config] - Additional configuration parameters
   */
  constructor({
    version,
    name,
    units,
    tileSize,
    pixelFormat,
    buffer,
    dataIndex
  }, config) {
    // Take these directly from decoded Pbf
    this.version = version;
    if (this.version !== MRT_VERSION) {
      throw new MRTError(`Cannot parse raster layer encoded with MRT version ${version}`);
    }
    this.name = name;
    this.units = units;
    this.tileSize = tileSize;
    this.buffer = buffer;
    this.pixelFormat = PIXEL_FORMAT[pixelFormat];
    this.dataIndex = dataIndex;
    this.bandShape = [tileSize + 2 * buffer, tileSize + 2 * buffer, PIXEL_FORMAT_TO_DIM_LEN[this.pixelFormat]];

    // Type script is creating more problems than it solves here:
    const cacheSize = config ? config.cacheSize : 5;
    this._decodedBlocks = new LRUCache(cacheSize);
    this._blocksInProgress = new Set();
  }

  /**
   * Get the dimensionality of data based on pixelFormat
   * @return {number} length of vector dimension
   */
  get dimension() {
    return PIXEL_FORMAT_TO_DIM_LEN[this.pixelFormat];
  }

  /**
   * Return the layer cache size (readonly)
   * @return {number} cache size
   */
  get cacheSize() {
    return this._decodedBlocks.capacity;
  }

  /**
   * List all bands
   * @return {Array<string>} - list of bands
   */
  getBandList() {
    return this.dataIndex.map(({
      bands
    }) => bands).flat();
  }

  /**
   * Assimilate results of data loading task
   * @param {TDecodingResult} result - result of processing task
   */
  processDecodedData(result) {
    const key = result.blockIndex.toString();
    if (this._decodedBlocks.get(key)) return;
    this._decodedBlocks.put(key, result.data);
  }

  /**
   * Find block for a band sequence index
   * @param {string|number} band - label or integer index of desired band
   * @return {TBlockReference} - index of block and index of band within block
   */
  getBlockForBand(band) {
    let blockBandStart = 0;
    switch (typeof band) {
      case 'string':
        for (const [blockIndex, block] of this.dataIndex.entries()) {
          for (const [blockBandIndex, bandName] of block.bands.entries()) {
            if (bandName !== band) continue;
            return {
              bandIndex: blockBandStart + blockBandIndex,
              blockIndex,
              blockBandIndex
            };
          }
          blockBandStart += block.bands.length;
        }
        break;
      case 'number':
        for (const [blockIndex, block] of this.dataIndex.entries()) {
          if (band >= blockBandStart && band < blockBandStart + block.bands.length) {
            return {
              bandIndex: band,
              blockIndex,
              blockBandIndex: band - blockBandStart
            };
          }
          blockBandStart += block.bands.length;
        }
        break;
      default:
        throw new MRTError(`Invalid band \`${JSON.stringify(band)}\`. Expected string or integer.`);
    }

    // If we reach here, the band was not found
    return {blockIndex: -1, blockBandIndex: -1};
  }

  /**
   * Get the byte range of a data slice, for performing a HTTP Range fetch
   * @param {Array<number | string>} bandList - list of slices to be covered
   * @return {TDataRange} range of data
   */
  getDataRange(bandList) {
    let firstByte = Infinity;
    let lastByte = -Infinity;
    /** @type {Array<number>} */
    const blockIndices = [];
    const allBlocks = new Set();
    for (const band of bandList) {
      const {
        blockIndex
      } = this.getBlockForBand(band);
      if (blockIndex < 0) {
        throw new MRTError(`Invalid band: ${JSON.stringify(band)}`);
      }
      const block = this.dataIndex[blockIndex];
      if (!blockIndices.includes(blockIndex)) {
        blockIndices.push(blockIndex);
      }
      allBlocks.add(blockIndex);
      firstByte = Math.min(firstByte, block.firstByte);
      lastByte = Math.max(lastByte, block.lastByte);
    }
    if (allBlocks.size > this.cacheSize) {
      throw new MRTError(`Number of blocks to decode (${allBlocks.size}) exceeds cache size (${this.cacheSize}).`);
    }
    return {
      layerName: this.name,
      firstByte,
      lastByte,
      blockIndices
    };
  }

  /**
   * Check if the specified band is valid
   * @param {number | string} band - sequence band
   * @return {boolean} - true if band exists in layer
   */
  hasBand(band) {
    const {
      blockIndex
    } = this.getBlockForBand(band);
    return blockIndex >= 0;
  }

  /**
   * Check if the layer has data for a given sequence band
   * @param {number | string} band - sequence band
   * @return {boolean} true if data is already available
   */
  hasDataForBand(band) {
    const {
      blockIndex
    } = this.getBlockForBand(band);
    return blockIndex >= 0 && !!this._decodedBlocks.get(blockIndex.toString());
  }

  /**
   * Get a typed array view of data
   * @param {number | string} band - sequence band
   * @return {TBandViewRGBA} view of raster layer
   */
  getBandView(band) {
    const {
      blockIndex,
      blockBandIndex
    } = this.getBlockForBand(band);

    if (blockIndex < 0) {
        throw new MRTError(`Band not found: ${JSON.stringify(band)}`);
    }

    /** @type {Uint8Array} */
    const blockData = this._decodedBlocks.get(blockIndex.toString());
    if (!blockData) {
      throw new MRTError(`Data for band ${JSON.stringify(band)} of layer "${this.name}" not decoded.`);
    }
    const block = this.dataIndex[blockIndex];
    const bandDataLength = this.bandShape.reduce((a, b) => a * b, 1);
    const start = blockBandIndex * bandDataLength;
    const data = blockData.subarray(start, start + bandDataLength);
    const bytes = new Uint8Array(data.buffer).subarray(data.byteOffset, data.byteOffset + data.byteLength);
    return {
      data,
      bytes,
      tileSize: this.tileSize,
      buffer: this.buffer,
      pixelFormat: this.pixelFormat,
      dimension: this.dimension,
      offset: block.offset,
      scale: block.scale
    };
  }
}

/**
 * Set library for decoding protobuf content
 * @param {typeof Pbf} _Pbf - 'pbf' libaray
 */
MapboxRasterTile.setPbf = function (_Pbf) {
  Pbf = _Pbf;
};
class MRTDecodingBatch {
  /**
   * @param {TProcessingTask[]} tasks - processing tasks
   * @param {() => void} onCancel - callback invoked on cancel
   * @param {(err: Error, results: TDecodingResult[]) => void} onComplete - callback invoked on completion
   */
  constructor(tasks, onCancel, onComplete) {
    this.tasks = tasks;
    this._onCancel = onCancel;
    this._onComplete = onComplete;
    this._finalized = false;
  }

  /**
   * Cancel a processing task
   * return {void}
   */
  cancel() {
    if (this._finalized) return;
    this._onCancel();
    this._finalized = true;
  }

  /**
   * Complete a processing task
   * @param {Error} err - processing error, if encountered
   * @param {TDecodingResult[]} result - result of processing
   * return {void}
   */
  complete(err, result) {
    if (this._finalized) return;
    this._onComplete(err, result);
    this._finalized = true;
  }
}

/**
 * Process a data parsing task
 * @param {ArrayBufferLike} buf - data buffer
 * @param {TProcessingBatch} decodingBatch - data processing task
 * @return {Promise<TDecodingResult[]>} output of processing task
 */
MapboxRasterTile.performDecoding = function (buf, decodingBatch) {
  const bytes = new Uint8Array(buf);
  return Promise.all(decodingBatch.tasks.map(task => {
    const {
      layerName,
      firstByte,
      lastByte,
      pixelFormat,
      blockShape,
      blockIndex,
      filters,
      codec
    } = task;
    const taskBuf = bytes.subarray(firstByte, lastByte + 1);
    const dataLength = blockShape[0] * blockShape[1] * blockShape[2];
    const values = new Uint32Array(dataLength);
    let decoded;
    switch (codec) {
      case 'gzip_data':
        {
          decoded = decompress(taskBuf, codec).then(bytes => {
            readNumericData(new Pbf(bytes), values);
            const Ctor = PIXEL_FORMAT_TO_CTOR[pixelFormat];
            return new Ctor(values.buffer);
          });
          break;
        }
      default:
        throw new MRTError(`Unhandled codec: ${codec}`);
    }
    return decoded.then(data => {
      // Decode filters, one at a time, in reverse order
      for (let i = filters.length - 1; i >= 0; i--) {
        switch (filters[i]) {
          case 'delta_filter':
            deltaDecode(data, blockShape);
            break;
          case 'zigzag_filter':
            zigzagDecode(data);
            break;
          case 'bitshuffle_filter':
            bitshuffleDecode(data, pixelFormat);
            break;
          default:
            throw new MRTError(`Unhandled filter "${filters[i]}"`);
        }
      }
      return {
        layerName,
        blockIndex,
        data
      };
    }).catch(err => {
      throw err;
    });
  }));
};

export { MRTDecodingBatch, MRTError, MapboxRasterTile, MapboxRasterLayer, VERSION, deltaDecode };
