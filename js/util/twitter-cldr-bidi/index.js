var Utilities = require('../twitter-cldr-utilities');
var bidi_classes = require('./bidi_classes.json');
var MAX_DEPTH = 62;

function Bidi(options) {
  if (options == null) {
    options = {};
  }
  this.string_arr = options.string_arr || options.types;
  this.types = options.types || [];
  this.levels = [];
  this.runs = [];
  this.direction = options.direction;
  this.default_direction = options.default_direction || "LTR";
  this.length = this.types.length;
  this.run_bidi();
}

Bidi._binarySearch = function(value, start, end) {
  var mid = Math.floor((start + end) / 2);

  var midRange = bidi_classes[mid];

  if (midRange.min <= value && midRange.max >= value) {
    return midRange.bidiClass; // Equal
  } else if (end - start < 2) {
    return null; // Does not exist
  } else if (midRange.min < value) {
    return this._binarySearch(value, mid, end); // Check upper
  } else {
    return this._binarySearch(value, start, mid); // Check lower
  }
};

Bidi.bidi_class_for = function(code_point) {
  return this._binarySearch(code_point, 0, bidi_classes.length);
};

Bidi.from_string = function(str, options) {
  var string_arr;
  if (options == null) {
    options = {};
  }
  string_arr = Utilities.unpack_string(str);
  options.types || (options.types = this.compute_types(string_arr));
  options.string_arr || (options.string_arr = string_arr);
  return new Bidi(options);
};

Bidi.from_type_array = function(types, options) {
  if (options == null) {
    options = {};
  }
  options.types || (options.types = types);
  return new Bidi(options);
};

Bidi.compute_types = function(arr) {
  var code_point, _i, _len, _results;
  _results = [];
  for (_i = 0, _len = arr.length; _i < _len; _i++) {
    code_point = arr[_i];
    _results.push(Bidi.bidi_class_for(code_point));
  }
  return _results;
};

Bidi.prototype.toString = function() {
  return Utilities.pack_array(this.string_arr);
};

Bidi.prototype.reorder_visually = function() {
  var depth, finish, i, level, lowest_odd, max, start, tmpb, tmpo, _i, _j, _k, _len, _ref, _ref1;
  if (!this.string_arr) {
    throw "No string given!";
  }
  max = 0;
  lowest_odd = MAX_DEPTH + 1;
  _ref = this.levels;
  for (_i = 0, _len = _ref.length; _i < _len; _i++) {
    level = _ref[_i];
    max = Utilities.max([level, max]);
    if (!Utilities.is_even(level)) {
      lowest_odd = Utilities.min([lowest_odd, level]);
    }
  }
  for (depth = _j = max; max <= 0 ? _j < 0 : _j > 0; depth = max <= 0 ? ++_j : --_j) {
    start = 0;
    while (start < this.levels.length) {
      while (start < this.levels.length && this.levels[start] < depth) {
        start += 1;
      }
      if (start === this.levels.length) {
        break;
      }
      finish = start + 1;
      while (finish < this.levels.length && this.levels[finish] >= depth) {
        finish += 1;
      }
      for (i = _k = 0, _ref1 = (finish - start) / 2; 0 <= _ref1 ? _k < _ref1 : _k > _ref1; i = 0 <= _ref1 ? ++_k : --_k) {
        tmpb = this.levels[finish - i - 1];
        this.levels[finish - i - 1] = this.levels[start + i];
        this.levels[start + i] = tmpb;
        tmpo = this.string_arr[finish - i - 1];
        this.string_arr[finish - i - 1] = this.string_arr[start + i];
        this.string_arr[start + i] = tmpo;
      }
      start = finish + 1;
    }
  }
  return this;
};

Bidi.prototype.compute_paragraph_embedding_level = function() {
  var type, _i, _len, _ref;
  if (["LTR", "RTL"].indexOf(this.direction) > -1) {
    if (this.direction === "LTR") {
      return 0;
    } else {
      return 1;
    }
  } else {
    _ref = this.types;
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      type = _ref[_i];
      if (type === "L") {
        return 0;
      }
      if (type === "R") {
        return 1;
      }
    }
    if (this.default_direction === "LTR") {
      return 0;
    } else {
      return 1;
    }
  }
};

Bidi.prototype.compute_explicit_levels = function() {
  var current_embedding, directional_override, embedding_stack, i, input, is_ltr, is_special, len, new_embedding, next_fmt, output, size, sp, _i, _j, _ref, _ref1;
  current_embedding = this.base_embedding;
  directional_override = -1;
  embedding_stack = [];
  this.formatter_indices || (this.formatter_indices = []);
  sp = 0;
  for (i = _i = 0, _ref = this.length; 0 <= _ref ? _i < _ref : _i > _ref; i = 0 <= _ref ? ++_i : --_i) {
    is_ltr = false;
    is_special = true;
    is_ltr = this.types[i] === "LRE" || this.types[i] === "LRO";
    switch (this.types[i]) {
      case "RLE":
      case "RLO":
      case "LRE":
      case "LRO":
        new_embedding = is_ltr ? (current_embedding & ~1) + 2 : (current_embedding + 1) | 1;
        if (new_embedding < MAX_DEPTH) {
          if (directional_override !== -1) {
            current_embedding |= -0x80;
          }
          embedding_stack[sp] = current_embedding;
          current_embedding = new_embedding;
          sp += 1;
          directional_override = this.types[i] === "LRO" ? "L" : this.types[i] === "RLO" ? "R" : -1;
        }
        break;
      case "PDF":
        if (sp > 0) {
          sp -= 1;
          new_embedding = embedding_stack[sp];
          current_embedding = new_embedding & 0x7f;
          directional_override = new_embedding < 0 ? (_ref1 = (new_embedding & 1) === 0) != null ? _ref1 : {
            "L": "R"
          } : -1;
        }
        break;
      default:
        is_special = false;
    }
    this.levels[i] = current_embedding;
    if (is_special) {
      this.formatter_indices.push(i);
    } else if (directional_override !== -1) {
      this.types[i] = directional_override;
    }
  }
  output = 0;
  input = 0;
  size = this.formatter_indices.length;
  for (i = _j = 0; 0 <= size ? _j <= size : _j >= size; i = 0 <= size ? ++_j : --_j) {
    next_fmt = i === size ? this.length : this.formatter_indices[i];
    len = next_fmt - input;
    Utilities.arraycopy(this.levels, input, this.levels, output, len);
    Utilities.arraycopy(this.types, input, this.types, output, len);
    output += len;
    input = next_fmt + 1;
  }
  return this.length -= this.formatter_indices.length;
};

Bidi.prototype.compute_runs = function() {
  var current_embedding, i, last_run_start, run_count, where, _i, _j, _ref, _ref1;
  run_count = 0;
  current_embedding = this.base_embedding;
  for (i = _i = 0, _ref = this.length; 0 <= _ref ? _i < _ref : _i > _ref; i = 0 <= _ref ? ++_i : --_i) {
    if (this.levels[i] !== current_embedding) {
      current_embedding = this.levels[i];
      run_count += 1;
    }
  }
  where = 0;
  last_run_start = 0;
  current_embedding = this.base_embedding;
  for (i = _j = 0, _ref1 = this.length; 0 <= _ref1 ? _j < _ref1 : _j > _ref1; i = 0 <= _ref1 ? ++_j : --_j) {
    if (this.levels[i] !== current_embedding) {
      this.runs[where] = last_run_start;
      where += 1;
      last_run_start = i;
      current_embedding = this.levels[i];
    }
  }
  return this.runs[where] = last_run_start;
};

Bidi.prototype.resolve_weak_types = function() {
  var eor, finish, i, j, k, level, next_level, next_type, prev_strong_type, prev_type, previous_level, run_count, run_idx, sor, start, _i, _j, _k;
  run_count = this.runs.length;
  previous_level = this.base_embedding;
  for (run_idx = _i = 0; 0 <= run_count ? _i < run_count : _i > run_count; run_idx = 0 <= run_count ? ++_i : --_i) {
    start = this.get_run_start(run_idx);
    finish = this.get_run_limit(run_idx);
    level = this.get_run_level(run_idx) || 0;
    sor = Utilities.is_even(Utilities.max([previous_level, level])) ? "L" : "R";
    next_level = run_idx === (run_count - 1) ? this.base_embedding : this.get_run_level(run_idx + 1) || 0;
    eor = Utilities.is_even(Utilities.max([level, next_level])) ? "L" : "R";
    prev_type = sor;
    prev_strong_type = sor;
    for (i = _j = start; start <= finish ? _j < finish : _j > finish; i = start <= finish ? ++_j : --_j) {
      next_type = i === (finish - 1) ? eor : this.types[i + 1];
      if (this.types[i] === "NSM") {
        this.types[i] = prev_type;
      } else {
        prev_type = this.types[i];
      }
      if (this.types[i] === "EN") {
        if (prev_strong_type === "AL") {
          this.types[i] = "AN";
        }
      } else if (this.types[i] === "L" || this.types[i] === "R" || this.types[i] === "AL") {
        prev_strong_type = this.types[i];
      }
      if (this.types[i] === "AL") {
        this.types[i] = "R";
      }
      if (prev_type === "EN" && next_type === "EN") {
        if (this.types[i] === "ES" || this.types[i] === "CS") {
          this.types[i] = nextType;
        }
      } else if (prev_type === "AN" && next_type === "AN" && this.types[i] === "CS") {
        this.types[i] = next_type;
      }
      if (this.types[i] === "ET" || this.types[i] === "BN") {
        if (prev_type === "EN") {
          this.types[i] = prev_type;
        } else {
          j = i + 1;
          while (j < finish && this.types[j] === "ET" || this.types[j] === "BN") {
            j += 1;
          }
          if (j < finish && this.types[j] === "EN") {
            for (k = _k = i; i <= j ? _k < j : _k > j; k = i <= j ? ++_k : --_k) {
              this.types[k] = "EN";
            }
          }
        }
      }
      if (this.types[i] === "ET" || this.types[i] === "CS" || this.types[i] === "BN") {
        this.types[i] = "ON";
      }
      if (prev_strong_type === "L" && this.types[i] === "EN") {
        this.types[i] = prev_strong_type;
      }
    }
    previous_level = level;
  }
};

Bidi.prototype.get_run_count = function() {
  return this.runs.length;
};

Bidi.prototype.get_run_level = function(which) {
  return this.levels[this.runs[which]];
};

Bidi.prototype.get_run_limit = function(which) {
  if (which === (this.runs.length - 1)) {
    return this.length;
  } else {
    return this.runs[which + 1];
  }
};

Bidi.prototype.get_run_start = function(which) {
  return this.runs[which];
};

Bidi.prototype.resolve_implicit_levels = function() {
  var i, _i, _ref;
  for (i = _i = 0, _ref = this.length; 0 <= _ref ? _i < _ref : _i > _ref; i = 0 <= _ref ? ++_i : --_i) {
    if ((this.levels[i] & 1) === 0) {
      if (this.types[i] === "R") {
        this.levels[i] += 1;
      } else if (this.types[i] === "AN" || this.types[i] === "EN") {
        this.levels[i] += 2;
      }
    } else {
      if (this.types[i] === "L" || this.types[i] === "AN" || this.types[i] === "EN") {
        this.levels[i] += 1;
      }
    }
  }
};

Bidi.prototype.resolve_neutral_types = function() {
  var embedding_direction, eor, finish, i, j, level, neutral_start, new_strong, next_level, override, prev_strong, previous_level, run, run_count, sor, start, this_type, _i, _j, _k;
  run_count = this.get_run_count();
  previous_level = this.base_embedding;
  for (run = _i = 0; 0 <= run_count ? _i < run_count : _i > run_count; run = 0 <= run_count ? ++_i : --_i) {
    start = this.get_run_start(run);
    finish = this.get_run_limit(run);
    level = this.get_run_level(run);
    if (level == null) {
      continue;
    }
    embedding_direction = Utilities.is_even(level) ? "L" : "R";
    sor = Utilities.is_even(Utilities.max([previous_level, level])) ? "L" : "R";
    next_level = run === (run_count - 1) ? this.base_embedding : this.get_run_level(run + 1);
    eor = Utilities.is_even(Utilities.max([level, next_level])) ? "L" : "R";
    prev_strong = sor;
    neutral_start = -1;
    for (i = _j = start; start <= finish ? _j <= finish : _j >= finish; i = start <= finish ? ++_j : --_j) {
      new_strong = -1;
      this_type = i === finish ? eor : this.types[i];
      switch (this_type) {
        case "L":
          new_strong = "L";
          break;
        case "R":
        case "AN":
        case "EN":
          new_strong = "R";
          break;
        case "BN":
        case "ON":
        case "S":
        case "B":
        case "WS":
          if (neutral_start === -1) {
            neutral_start = i;
          }
      }
      if (new_strong !== -1) {
        if (neutral_start !== -1) {
          override = prev_strong === new_strong ? prev_strong : embedding_direction;
          for (j = _k = neutral_start; neutral_start <= i ? _k < i : _k > i; j = neutral_start <= i ? ++_k : --_k) {
            this.types[j] = override;
          }
        }
        prev_strong = new_strong;
        neutral_start = -1;
      }
    }
    previous_level = level;
  }
};

Bidi.prototype.reinsert_formatting_codes = function() {
  var index, input, left_level, len, next_fmt, output, right_level, _i, _ref;
  if ((this.formatter_indices != null) && this.formatter_indices.length > 0) {
    input = this.length;
    output = this.levels.length;
    for (index = _i = _ref = this.formatter_indices.length - 1; _ref <= 0 ? _i <= 0 : _i >= 0; index = _ref <= 0 ? ++_i : --_i) {
      next_fmt = this.formatter_indices[index];
      len = output - next_fmt - 1;
      output = next_fmt;
      input -= len;
      if (next_fmt + 1 < this.levels.length) {
        Utilities.arraycopy(this.levels, input, this.levels, next_fmt + 1, len);
      }
      right_level = output === this.levels.length - 1 ? this.base_embedding : this.levels[output + 1] != null ? this.levels[output + 1] : 0;
      left_level = input === 0 ? this.base_embedding : this.levels[input] != null ? this.levels[input] : 0;
      this.levels[output] = Utilities.max([left_level, right_level]);
    }
  }
  return this.length = this.levels.length;
};

Bidi.prototype.run_bidi = function() {
  this.base_embedding = this.compute_paragraph_embedding_level();
  this.compute_explicit_levels();
  this.compute_runs();
  this.resolve_weak_types();
  this.resolve_neutral_types();
  this.resolve_implicit_levels();
  this.reinsert_formatting_codes();
  this.compute_runs();
};

module.exports = Bidi;
