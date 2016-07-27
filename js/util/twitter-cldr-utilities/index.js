function Utilities() {}

Utilities.from_char_code = function(code_point) {
  if (code_point > 0xFFFF) {
    code_point -= 0x10000;
    return String.fromCharCode(0xD800 + (code_point >> 10), 0xDC00 + (code_point & 0x3FF));
  } else {
    return String.fromCharCode(code_point);
  }
};

Utilities.char_code_at = function(str, idx) {
  var code, end, hi, li, low, surrogatePairs;
  str += '';
  end = str.length;
  surrogatePairs = /[\uD800-\uDBFF][\uDC00-\uDFFF]/g;
  while (surrogatePairs.exec(str) !== null) {
    li = surrogatePairs.lastIndex;
    if (li - 2 < idx) {
      idx += 1;
    } else {
      break;
    }
  }
  if ((idx >= end) || (idx < 0)) {
    return NaN;
  }
  code = str.charCodeAt(idx);
  if ((0xD800 <= code) && (code <= 0xDBFF)) {
    hi = code;
    low = str.charCodeAt(idx + 1);
    return ((hi - 0xD800) * 0x400) + (low - 0xDC00) + 0x10000;
  }
  return code;
};

Utilities.unpack_string = function(str) {
  var code_point, idx, result, _i, _ref;
  result = [];
  for (idx = _i = 0, _ref = str.length; 0 <= _ref ? _i < _ref : _i > _ref; idx = 0 <= _ref ? ++_i : --_i) {
    code_point = this.char_code_at(str, idx);
    if (!code_point) {
      break;
    }
    result.push(code_point);
  }
  return result;
};

Utilities.pack_array = function(char_arr) {
  var cur_char;
  return ((function() {
    var _i, _len, _results;
    _results = [];
    for (_i = 0, _len = char_arr.length; _i < _len; _i++) {
      cur_char = char_arr[_i];
      _results.push(this.from_char_code(cur_char));
    }
    return _results;
  }).call(this)).join("");
};

Utilities.arraycopy = function(orig, orig_index, dest, dest_index, length) {
  var count, elem, _i, _len, _ref;
  _ref = orig.slice(orig_index, orig_index + length);
  for (count = _i = 0, _len = _ref.length; _i < _len; count = ++_i) {
    elem = _ref[count];
    dest[dest_index + count] = elem;
  }
};

Utilities.max = function(arr) {
  var elem, i, max, start_index, _i, _j, _len, _ref;
  max = null;
  for (start_index = _i = 0, _len = arr.length; _i < _len; start_index = ++_i) {
    elem = arr[start_index];
    if (elem != null) {
      max = elem;
      break;
    }
  }
  for (i = _j = start_index, _ref = arr.length; start_index <= _ref ? _j <= _ref : _j >= _ref; i = start_index <= _ref ? ++_j : --_j) {
    if (arr[i] > max) {
      max = arr[i];
    }
  }
  return max;
};

Utilities.min = function(arr) {
  var elem, i, min, start_index, _i, _j, _len, _ref;
  min = null;
  for (start_index = _i = 0, _len = arr.length; _i < _len; start_index = ++_i) {
    elem = arr[start_index];
    if (elem != null) {
      min = elem;
      break;
    }
  }
  for (i = _j = start_index, _ref = arr.length; start_index <= _ref ? _j <= _ref : _j >= _ref; i = start_index <= _ref ? ++_j : --_j) {
    if (arr[i] < min) {
      min = arr[i];
    }
  }
  return min;
};

Utilities.is_even = function(num) {
  return num % 2 === 0;
};

Utilities.is_odd = function(num) {
  return num % 2 === 1;
};

Utilities.remove_duplicates = function(arr) {
  return arr.reduce((function(u, elem) {
    if (u.indexOf(elem) < 0) {
      u.push(elem);
    }
    return u;
  }), []);
};

Utilities.regex_escape = function(s) {
  return s.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1");
};

Utilities.trim_string = function(s) {
  return s.replace(/^\s+|\s+$/g, '');
};

Utilities.clone = function(obj) {
  var flags, key, newInstance;
  if ((obj == null) || typeof obj !== 'object') {
    return obj;
  }
  if (obj instanceof Date) {
    return new Date(obj.getTime());
  }
  if (obj instanceof RegExp) {
    flags = '';
    if (obj.global != null) {
      flags += 'g';
    }
    if (obj.ignoreCase != null) {
      flags += 'i';
    }
    if (obj.multiline != null) {
      flags += 'm';
    }
    if (obj.sticky != null) {
      flags += 'y';
    }
    return new RegExp(obj.source, flags);
  }
  newInstance = new obj.constructor();
  for (key in obj) {
    newInstance[key] = this.clone(obj[key]);
  }
  return newInstance;
};

Utilities.compute_cache_key = function(pieces) {
  if ((pieces != null) && pieces.length > 0) {
    return pieces.join("|");
  }
  return null;
};

Utilities.traverse_object = function(obj, path) {
  var key, value, _i, _len;
  value = obj;
  if (path.length === 0) {
    return null;
  }
  for (_i = 0, _len = path.length; _i < _len; _i++) {
    key = path[_i];
    if ((value != null) && value.hasOwnProperty(key)) {
      value = value[key];
    } else {
      return null;
    }
  }
  return value;
};

module.exports = Utilities;
