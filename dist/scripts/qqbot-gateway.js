#!/usr/bin/env node
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});
var __commonJS = (cb, mod) => function __require2() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// node_modules/ws/lib/constants.js
var require_constants = __commonJS({
  "node_modules/ws/lib/constants.js"(exports, module) {
    "use strict";
    var BINARY_TYPES = ["nodebuffer", "arraybuffer", "fragments"];
    var hasBlob = typeof Blob !== "undefined";
    if (hasBlob) BINARY_TYPES.push("blob");
    module.exports = {
      BINARY_TYPES,
      CLOSE_TIMEOUT: 3e4,
      EMPTY_BUFFER: Buffer.alloc(0),
      GUID: "258EAFA5-E914-47DA-95CA-C5AB0DC85B11",
      hasBlob,
      kForOnEventAttribute: /* @__PURE__ */ Symbol("kIsForOnEventAttribute"),
      kListener: /* @__PURE__ */ Symbol("kListener"),
      kStatusCode: /* @__PURE__ */ Symbol("status-code"),
      kWebSocket: /* @__PURE__ */ Symbol("websocket"),
      NOOP: () => {
      }
    };
  }
});

// node_modules/ws/lib/buffer-util.js
var require_buffer_util = __commonJS({
  "node_modules/ws/lib/buffer-util.js"(exports, module) {
    "use strict";
    var { EMPTY_BUFFER } = require_constants();
    var FastBuffer = Buffer[Symbol.species];
    function concat(list, totalLength) {
      if (list.length === 0) return EMPTY_BUFFER;
      if (list.length === 1) return list[0];
      const target = Buffer.allocUnsafe(totalLength);
      let offset = 0;
      for (let i = 0; i < list.length; i++) {
        const buf = list[i];
        target.set(buf, offset);
        offset += buf.length;
      }
      if (offset < totalLength) {
        return new FastBuffer(target.buffer, target.byteOffset, offset);
      }
      return target;
    }
    function _mask(source, mask, output, offset, length) {
      for (let i = 0; i < length; i++) {
        output[offset + i] = source[i] ^ mask[i & 3];
      }
    }
    function _unmask(buffer, mask) {
      for (let i = 0; i < buffer.length; i++) {
        buffer[i] ^= mask[i & 3];
      }
    }
    function toArrayBuffer(buf) {
      if (buf.length === buf.buffer.byteLength) {
        return buf.buffer;
      }
      return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length);
    }
    function toBuffer(data) {
      toBuffer.readOnly = true;
      if (Buffer.isBuffer(data)) return data;
      let buf;
      if (data instanceof ArrayBuffer) {
        buf = new FastBuffer(data);
      } else if (ArrayBuffer.isView(data)) {
        buf = new FastBuffer(data.buffer, data.byteOffset, data.byteLength);
      } else {
        buf = Buffer.from(data);
        toBuffer.readOnly = false;
      }
      return buf;
    }
    module.exports = {
      concat,
      mask: _mask,
      toArrayBuffer,
      toBuffer,
      unmask: _unmask
    };
    if (!process.env.WS_NO_BUFFER_UTIL) {
      try {
        const bufferUtil = __require("bufferutil");
        module.exports.mask = function(source, mask, output, offset, length) {
          if (length < 48) _mask(source, mask, output, offset, length);
          else bufferUtil.mask(source, mask, output, offset, length);
        };
        module.exports.unmask = function(buffer, mask) {
          if (buffer.length < 32) _unmask(buffer, mask);
          else bufferUtil.unmask(buffer, mask);
        };
      } catch (e) {
      }
    }
  }
});

// node_modules/ws/lib/limiter.js
var require_limiter = __commonJS({
  "node_modules/ws/lib/limiter.js"(exports, module) {
    "use strict";
    var kDone = /* @__PURE__ */ Symbol("kDone");
    var kRun = /* @__PURE__ */ Symbol("kRun");
    var Limiter = class {
      /**
       * Creates a new `Limiter`.
       *
       * @param {Number} [concurrency=Infinity] The maximum number of jobs allowed
       *     to run concurrently
       */
      constructor(concurrency) {
        this[kDone] = () => {
          this.pending--;
          this[kRun]();
        };
        this.concurrency = concurrency || Infinity;
        this.jobs = [];
        this.pending = 0;
      }
      /**
       * Adds a job to the queue.
       *
       * @param {Function} job The job to run
       * @public
       */
      add(job) {
        this.jobs.push(job);
        this[kRun]();
      }
      /**
       * Removes a job from the queue and runs it if possible.
       *
       * @private
       */
      [kRun]() {
        if (this.pending === this.concurrency) return;
        if (this.jobs.length) {
          const job = this.jobs.shift();
          this.pending++;
          job(this[kDone]);
        }
      }
    };
    module.exports = Limiter;
  }
});

// node_modules/ws/lib/permessage-deflate.js
var require_permessage_deflate = __commonJS({
  "node_modules/ws/lib/permessage-deflate.js"(exports, module) {
    "use strict";
    var zlib = __require("zlib");
    var bufferUtil = require_buffer_util();
    var Limiter = require_limiter();
    var { kStatusCode } = require_constants();
    var FastBuffer = Buffer[Symbol.species];
    var TRAILER = Buffer.from([0, 0, 255, 255]);
    var kPerMessageDeflate = /* @__PURE__ */ Symbol("permessage-deflate");
    var kTotalLength = /* @__PURE__ */ Symbol("total-length");
    var kCallback = /* @__PURE__ */ Symbol("callback");
    var kBuffers = /* @__PURE__ */ Symbol("buffers");
    var kError = /* @__PURE__ */ Symbol("error");
    var zlibLimiter;
    var PerMessageDeflate = class {
      /**
       * Creates a PerMessageDeflate instance.
       *
       * @param {Object} [options] Configuration options
       * @param {(Boolean|Number)} [options.clientMaxWindowBits] Advertise support
       *     for, or request, a custom client window size
       * @param {Boolean} [options.clientNoContextTakeover=false] Advertise/
       *     acknowledge disabling of client context takeover
       * @param {Number} [options.concurrencyLimit=10] The number of concurrent
       *     calls to zlib
       * @param {(Boolean|Number)} [options.serverMaxWindowBits] Request/confirm the
       *     use of a custom server window size
       * @param {Boolean} [options.serverNoContextTakeover=false] Request/accept
       *     disabling of server context takeover
       * @param {Number} [options.threshold=1024] Size (in bytes) below which
       *     messages should not be compressed if context takeover is disabled
       * @param {Object} [options.zlibDeflateOptions] Options to pass to zlib on
       *     deflate
       * @param {Object} [options.zlibInflateOptions] Options to pass to zlib on
       *     inflate
       * @param {Boolean} [isServer=false] Create the instance in either server or
       *     client mode
       * @param {Number} [maxPayload=0] The maximum allowed message length
       */
      constructor(options, isServer, maxPayload) {
        this._maxPayload = maxPayload | 0;
        this._options = options || {};
        this._threshold = this._options.threshold !== void 0 ? this._options.threshold : 1024;
        this._isServer = !!isServer;
        this._deflate = null;
        this._inflate = null;
        this.params = null;
        if (!zlibLimiter) {
          const concurrency = this._options.concurrencyLimit !== void 0 ? this._options.concurrencyLimit : 10;
          zlibLimiter = new Limiter(concurrency);
        }
      }
      /**
       * @type {String}
       */
      static get extensionName() {
        return "permessage-deflate";
      }
      /**
       * Create an extension negotiation offer.
       *
       * @return {Object} Extension parameters
       * @public
       */
      offer() {
        const params = {};
        if (this._options.serverNoContextTakeover) {
          params.server_no_context_takeover = true;
        }
        if (this._options.clientNoContextTakeover) {
          params.client_no_context_takeover = true;
        }
        if (this._options.serverMaxWindowBits) {
          params.server_max_window_bits = this._options.serverMaxWindowBits;
        }
        if (this._options.clientMaxWindowBits) {
          params.client_max_window_bits = this._options.clientMaxWindowBits;
        } else if (this._options.clientMaxWindowBits == null) {
          params.client_max_window_bits = true;
        }
        return params;
      }
      /**
       * Accept an extension negotiation offer/response.
       *
       * @param {Array} configurations The extension negotiation offers/reponse
       * @return {Object} Accepted configuration
       * @public
       */
      accept(configurations) {
        configurations = this.normalizeParams(configurations);
        this.params = this._isServer ? this.acceptAsServer(configurations) : this.acceptAsClient(configurations);
        return this.params;
      }
      /**
       * Releases all resources used by the extension.
       *
       * @public
       */
      cleanup() {
        if (this._inflate) {
          this._inflate.close();
          this._inflate = null;
        }
        if (this._deflate) {
          const callback = this._deflate[kCallback];
          this._deflate.close();
          this._deflate = null;
          if (callback) {
            callback(
              new Error(
                "The deflate stream was closed while data was being processed"
              )
            );
          }
        }
      }
      /**
       *  Accept an extension negotiation offer.
       *
       * @param {Array} offers The extension negotiation offers
       * @return {Object} Accepted configuration
       * @private
       */
      acceptAsServer(offers) {
        const opts = this._options;
        const accepted = offers.find((params) => {
          if (opts.serverNoContextTakeover === false && params.server_no_context_takeover || params.server_max_window_bits && (opts.serverMaxWindowBits === false || typeof opts.serverMaxWindowBits === "number" && opts.serverMaxWindowBits > params.server_max_window_bits) || typeof opts.clientMaxWindowBits === "number" && !params.client_max_window_bits) {
            return false;
          }
          return true;
        });
        if (!accepted) {
          throw new Error("None of the extension offers can be accepted");
        }
        if (opts.serverNoContextTakeover) {
          accepted.server_no_context_takeover = true;
        }
        if (opts.clientNoContextTakeover) {
          accepted.client_no_context_takeover = true;
        }
        if (typeof opts.serverMaxWindowBits === "number") {
          accepted.server_max_window_bits = opts.serverMaxWindowBits;
        }
        if (typeof opts.clientMaxWindowBits === "number") {
          accepted.client_max_window_bits = opts.clientMaxWindowBits;
        } else if (accepted.client_max_window_bits === true || opts.clientMaxWindowBits === false) {
          delete accepted.client_max_window_bits;
        }
        return accepted;
      }
      /**
       * Accept the extension negotiation response.
       *
       * @param {Array} response The extension negotiation response
       * @return {Object} Accepted configuration
       * @private
       */
      acceptAsClient(response) {
        const params = response[0];
        if (this._options.clientNoContextTakeover === false && params.client_no_context_takeover) {
          throw new Error('Unexpected parameter "client_no_context_takeover"');
        }
        if (!params.client_max_window_bits) {
          if (typeof this._options.clientMaxWindowBits === "number") {
            params.client_max_window_bits = this._options.clientMaxWindowBits;
          }
        } else if (this._options.clientMaxWindowBits === false || typeof this._options.clientMaxWindowBits === "number" && params.client_max_window_bits > this._options.clientMaxWindowBits) {
          throw new Error(
            'Unexpected or invalid parameter "client_max_window_bits"'
          );
        }
        return params;
      }
      /**
       * Normalize parameters.
       *
       * @param {Array} configurations The extension negotiation offers/reponse
       * @return {Array} The offers/response with normalized parameters
       * @private
       */
      normalizeParams(configurations) {
        configurations.forEach((params) => {
          Object.keys(params).forEach((key) => {
            let value = params[key];
            if (value.length > 1) {
              throw new Error(`Parameter "${key}" must have only a single value`);
            }
            value = value[0];
            if (key === "client_max_window_bits") {
              if (value !== true) {
                const num = +value;
                if (!Number.isInteger(num) || num < 8 || num > 15) {
                  throw new TypeError(
                    `Invalid value for parameter "${key}": ${value}`
                  );
                }
                value = num;
              } else if (!this._isServer) {
                throw new TypeError(
                  `Invalid value for parameter "${key}": ${value}`
                );
              }
            } else if (key === "server_max_window_bits") {
              const num = +value;
              if (!Number.isInteger(num) || num < 8 || num > 15) {
                throw new TypeError(
                  `Invalid value for parameter "${key}": ${value}`
                );
              }
              value = num;
            } else if (key === "client_no_context_takeover" || key === "server_no_context_takeover") {
              if (value !== true) {
                throw new TypeError(
                  `Invalid value for parameter "${key}": ${value}`
                );
              }
            } else {
              throw new Error(`Unknown parameter "${key}"`);
            }
            params[key] = value;
          });
        });
        return configurations;
      }
      /**
       * Decompress data. Concurrency limited.
       *
       * @param {Buffer} data Compressed data
       * @param {Boolean} fin Specifies whether or not this is the last fragment
       * @param {Function} callback Callback
       * @public
       */
      decompress(data, fin, callback) {
        zlibLimiter.add((done) => {
          this._decompress(data, fin, (err, result) => {
            done();
            callback(err, result);
          });
        });
      }
      /**
       * Compress data. Concurrency limited.
       *
       * @param {(Buffer|String)} data Data to compress
       * @param {Boolean} fin Specifies whether or not this is the last fragment
       * @param {Function} callback Callback
       * @public
       */
      compress(data, fin, callback) {
        zlibLimiter.add((done) => {
          this._compress(data, fin, (err, result) => {
            done();
            callback(err, result);
          });
        });
      }
      /**
       * Decompress data.
       *
       * @param {Buffer} data Compressed data
       * @param {Boolean} fin Specifies whether or not this is the last fragment
       * @param {Function} callback Callback
       * @private
       */
      _decompress(data, fin, callback) {
        const endpoint = this._isServer ? "client" : "server";
        if (!this._inflate) {
          const key = `${endpoint}_max_window_bits`;
          const windowBits = typeof this.params[key] !== "number" ? zlib.Z_DEFAULT_WINDOWBITS : this.params[key];
          this._inflate = zlib.createInflateRaw({
            ...this._options.zlibInflateOptions,
            windowBits
          });
          this._inflate[kPerMessageDeflate] = this;
          this._inflate[kTotalLength] = 0;
          this._inflate[kBuffers] = [];
          this._inflate.on("error", inflateOnError);
          this._inflate.on("data", inflateOnData);
        }
        this._inflate[kCallback] = callback;
        this._inflate.write(data);
        if (fin) this._inflate.write(TRAILER);
        this._inflate.flush(() => {
          const err = this._inflate[kError];
          if (err) {
            this._inflate.close();
            this._inflate = null;
            callback(err);
            return;
          }
          const data2 = bufferUtil.concat(
            this._inflate[kBuffers],
            this._inflate[kTotalLength]
          );
          if (this._inflate._readableState.endEmitted) {
            this._inflate.close();
            this._inflate = null;
          } else {
            this._inflate[kTotalLength] = 0;
            this._inflate[kBuffers] = [];
            if (fin && this.params[`${endpoint}_no_context_takeover`]) {
              this._inflate.reset();
            }
          }
          callback(null, data2);
        });
      }
      /**
       * Compress data.
       *
       * @param {(Buffer|String)} data Data to compress
       * @param {Boolean} fin Specifies whether or not this is the last fragment
       * @param {Function} callback Callback
       * @private
       */
      _compress(data, fin, callback) {
        const endpoint = this._isServer ? "server" : "client";
        if (!this._deflate) {
          const key = `${endpoint}_max_window_bits`;
          const windowBits = typeof this.params[key] !== "number" ? zlib.Z_DEFAULT_WINDOWBITS : this.params[key];
          this._deflate = zlib.createDeflateRaw({
            ...this._options.zlibDeflateOptions,
            windowBits
          });
          this._deflate[kTotalLength] = 0;
          this._deflate[kBuffers] = [];
          this._deflate.on("data", deflateOnData);
        }
        this._deflate[kCallback] = callback;
        this._deflate.write(data);
        this._deflate.flush(zlib.Z_SYNC_FLUSH, () => {
          if (!this._deflate) {
            return;
          }
          let data2 = bufferUtil.concat(
            this._deflate[kBuffers],
            this._deflate[kTotalLength]
          );
          if (fin) {
            data2 = new FastBuffer(data2.buffer, data2.byteOffset, data2.length - 4);
          }
          this._deflate[kCallback] = null;
          this._deflate[kTotalLength] = 0;
          this._deflate[kBuffers] = [];
          if (fin && this.params[`${endpoint}_no_context_takeover`]) {
            this._deflate.reset();
          }
          callback(null, data2);
        });
      }
    };
    module.exports = PerMessageDeflate;
    function deflateOnData(chunk) {
      this[kBuffers].push(chunk);
      this[kTotalLength] += chunk.length;
    }
    function inflateOnData(chunk) {
      this[kTotalLength] += chunk.length;
      if (this[kPerMessageDeflate]._maxPayload < 1 || this[kTotalLength] <= this[kPerMessageDeflate]._maxPayload) {
        this[kBuffers].push(chunk);
        return;
      }
      this[kError] = new RangeError("Max payload size exceeded");
      this[kError].code = "WS_ERR_UNSUPPORTED_MESSAGE_LENGTH";
      this[kError][kStatusCode] = 1009;
      this.removeListener("data", inflateOnData);
      this.reset();
    }
    function inflateOnError(err) {
      this[kPerMessageDeflate]._inflate = null;
      if (this[kError]) {
        this[kCallback](this[kError]);
        return;
      }
      err[kStatusCode] = 1007;
      this[kCallback](err);
    }
  }
});

// node_modules/ws/lib/validation.js
var require_validation = __commonJS({
  "node_modules/ws/lib/validation.js"(exports, module) {
    "use strict";
    var { isUtf8 } = __require("buffer");
    var { hasBlob } = require_constants();
    var tokenChars = [
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      // 0 - 15
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      // 16 - 31
      0,
      1,
      0,
      1,
      1,
      1,
      1,
      1,
      0,
      0,
      1,
      1,
      0,
      1,
      1,
      0,
      // 32 - 47
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      0,
      0,
      0,
      0,
      0,
      0,
      // 48 - 63
      0,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      // 64 - 79
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      0,
      0,
      0,
      1,
      1,
      // 80 - 95
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      // 96 - 111
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      0,
      1,
      0,
      1,
      0
      // 112 - 127
    ];
    function isValidStatusCode(code) {
      return code >= 1e3 && code <= 1014 && code !== 1004 && code !== 1005 && code !== 1006 || code >= 3e3 && code <= 4999;
    }
    function _isValidUTF8(buf) {
      const len = buf.length;
      let i = 0;
      while (i < len) {
        if ((buf[i] & 128) === 0) {
          i++;
        } else if ((buf[i] & 224) === 192) {
          if (i + 1 === len || (buf[i + 1] & 192) !== 128 || (buf[i] & 254) === 192) {
            return false;
          }
          i += 2;
        } else if ((buf[i] & 240) === 224) {
          if (i + 2 >= len || (buf[i + 1] & 192) !== 128 || (buf[i + 2] & 192) !== 128 || buf[i] === 224 && (buf[i + 1] & 224) === 128 || // Overlong
          buf[i] === 237 && (buf[i + 1] & 224) === 160) {
            return false;
          }
          i += 3;
        } else if ((buf[i] & 248) === 240) {
          if (i + 3 >= len || (buf[i + 1] & 192) !== 128 || (buf[i + 2] & 192) !== 128 || (buf[i + 3] & 192) !== 128 || buf[i] === 240 && (buf[i + 1] & 240) === 128 || // Overlong
          buf[i] === 244 && buf[i + 1] > 143 || buf[i] > 244) {
            return false;
          }
          i += 4;
        } else {
          return false;
        }
      }
      return true;
    }
    function isBlob(value) {
      return hasBlob && typeof value === "object" && typeof value.arrayBuffer === "function" && typeof value.type === "string" && typeof value.stream === "function" && (value[Symbol.toStringTag] === "Blob" || value[Symbol.toStringTag] === "File");
    }
    module.exports = {
      isBlob,
      isValidStatusCode,
      isValidUTF8: _isValidUTF8,
      tokenChars
    };
    if (isUtf8) {
      module.exports.isValidUTF8 = function(buf) {
        return buf.length < 24 ? _isValidUTF8(buf) : isUtf8(buf);
      };
    } else if (!process.env.WS_NO_UTF_8_VALIDATE) {
      try {
        const isValidUTF8 = __require("utf-8-validate");
        module.exports.isValidUTF8 = function(buf) {
          return buf.length < 32 ? _isValidUTF8(buf) : isValidUTF8(buf);
        };
      } catch (e) {
      }
    }
  }
});

// node_modules/ws/lib/receiver.js
var require_receiver = __commonJS({
  "node_modules/ws/lib/receiver.js"(exports, module) {
    "use strict";
    var { Writable } = __require("stream");
    var PerMessageDeflate = require_permessage_deflate();
    var {
      BINARY_TYPES,
      EMPTY_BUFFER,
      kStatusCode,
      kWebSocket
    } = require_constants();
    var { concat, toArrayBuffer, unmask } = require_buffer_util();
    var { isValidStatusCode, isValidUTF8 } = require_validation();
    var FastBuffer = Buffer[Symbol.species];
    var GET_INFO = 0;
    var GET_PAYLOAD_LENGTH_16 = 1;
    var GET_PAYLOAD_LENGTH_64 = 2;
    var GET_MASK = 3;
    var GET_DATA = 4;
    var INFLATING = 5;
    var DEFER_EVENT = 6;
    var Receiver2 = class extends Writable {
      /**
       * Creates a Receiver instance.
       *
       * @param {Object} [options] Options object
       * @param {Boolean} [options.allowSynchronousEvents=true] Specifies whether
       *     any of the `'message'`, `'ping'`, and `'pong'` events can be emitted
       *     multiple times in the same tick
       * @param {String} [options.binaryType=nodebuffer] The type for binary data
       * @param {Object} [options.extensions] An object containing the negotiated
       *     extensions
       * @param {Boolean} [options.isServer=false] Specifies whether to operate in
       *     client or server mode
       * @param {Number} [options.maxPayload=0] The maximum allowed message length
       * @param {Boolean} [options.skipUTF8Validation=false] Specifies whether or
       *     not to skip UTF-8 validation for text and close messages
       */
      constructor(options = {}) {
        super();
        this._allowSynchronousEvents = options.allowSynchronousEvents !== void 0 ? options.allowSynchronousEvents : true;
        this._binaryType = options.binaryType || BINARY_TYPES[0];
        this._extensions = options.extensions || {};
        this._isServer = !!options.isServer;
        this._maxPayload = options.maxPayload | 0;
        this._skipUTF8Validation = !!options.skipUTF8Validation;
        this[kWebSocket] = void 0;
        this._bufferedBytes = 0;
        this._buffers = [];
        this._compressed = false;
        this._payloadLength = 0;
        this._mask = void 0;
        this._fragmented = 0;
        this._masked = false;
        this._fin = false;
        this._opcode = 0;
        this._totalPayloadLength = 0;
        this._messageLength = 0;
        this._fragments = [];
        this._errored = false;
        this._loop = false;
        this._state = GET_INFO;
      }
      /**
       * Implements `Writable.prototype._write()`.
       *
       * @param {Buffer} chunk The chunk of data to write
       * @param {String} encoding The character encoding of `chunk`
       * @param {Function} cb Callback
       * @private
       */
      _write(chunk, encoding, cb) {
        if (this._opcode === 8 && this._state == GET_INFO) return cb();
        this._bufferedBytes += chunk.length;
        this._buffers.push(chunk);
        this.startLoop(cb);
      }
      /**
       * Consumes `n` bytes from the buffered data.
       *
       * @param {Number} n The number of bytes to consume
       * @return {Buffer} The consumed bytes
       * @private
       */
      consume(n) {
        this._bufferedBytes -= n;
        if (n === this._buffers[0].length) return this._buffers.shift();
        if (n < this._buffers[0].length) {
          const buf = this._buffers[0];
          this._buffers[0] = new FastBuffer(
            buf.buffer,
            buf.byteOffset + n,
            buf.length - n
          );
          return new FastBuffer(buf.buffer, buf.byteOffset, n);
        }
        const dst = Buffer.allocUnsafe(n);
        do {
          const buf = this._buffers[0];
          const offset = dst.length - n;
          if (n >= buf.length) {
            dst.set(this._buffers.shift(), offset);
          } else {
            dst.set(new Uint8Array(buf.buffer, buf.byteOffset, n), offset);
            this._buffers[0] = new FastBuffer(
              buf.buffer,
              buf.byteOffset + n,
              buf.length - n
            );
          }
          n -= buf.length;
        } while (n > 0);
        return dst;
      }
      /**
       * Starts the parsing loop.
       *
       * @param {Function} cb Callback
       * @private
       */
      startLoop(cb) {
        this._loop = true;
        do {
          switch (this._state) {
            case GET_INFO:
              this.getInfo(cb);
              break;
            case GET_PAYLOAD_LENGTH_16:
              this.getPayloadLength16(cb);
              break;
            case GET_PAYLOAD_LENGTH_64:
              this.getPayloadLength64(cb);
              break;
            case GET_MASK:
              this.getMask();
              break;
            case GET_DATA:
              this.getData(cb);
              break;
            case INFLATING:
            case DEFER_EVENT:
              this._loop = false;
              return;
          }
        } while (this._loop);
        if (!this._errored) cb();
      }
      /**
       * Reads the first two bytes of a frame.
       *
       * @param {Function} cb Callback
       * @private
       */
      getInfo(cb) {
        if (this._bufferedBytes < 2) {
          this._loop = false;
          return;
        }
        const buf = this.consume(2);
        if ((buf[0] & 48) !== 0) {
          const error = this.createError(
            RangeError,
            "RSV2 and RSV3 must be clear",
            true,
            1002,
            "WS_ERR_UNEXPECTED_RSV_2_3"
          );
          cb(error);
          return;
        }
        const compressed = (buf[0] & 64) === 64;
        if (compressed && !this._extensions[PerMessageDeflate.extensionName]) {
          const error = this.createError(
            RangeError,
            "RSV1 must be clear",
            true,
            1002,
            "WS_ERR_UNEXPECTED_RSV_1"
          );
          cb(error);
          return;
        }
        this._fin = (buf[0] & 128) === 128;
        this._opcode = buf[0] & 15;
        this._payloadLength = buf[1] & 127;
        if (this._opcode === 0) {
          if (compressed) {
            const error = this.createError(
              RangeError,
              "RSV1 must be clear",
              true,
              1002,
              "WS_ERR_UNEXPECTED_RSV_1"
            );
            cb(error);
            return;
          }
          if (!this._fragmented) {
            const error = this.createError(
              RangeError,
              "invalid opcode 0",
              true,
              1002,
              "WS_ERR_INVALID_OPCODE"
            );
            cb(error);
            return;
          }
          this._opcode = this._fragmented;
        } else if (this._opcode === 1 || this._opcode === 2) {
          if (this._fragmented) {
            const error = this.createError(
              RangeError,
              `invalid opcode ${this._opcode}`,
              true,
              1002,
              "WS_ERR_INVALID_OPCODE"
            );
            cb(error);
            return;
          }
          this._compressed = compressed;
        } else if (this._opcode > 7 && this._opcode < 11) {
          if (!this._fin) {
            const error = this.createError(
              RangeError,
              "FIN must be set",
              true,
              1002,
              "WS_ERR_EXPECTED_FIN"
            );
            cb(error);
            return;
          }
          if (compressed) {
            const error = this.createError(
              RangeError,
              "RSV1 must be clear",
              true,
              1002,
              "WS_ERR_UNEXPECTED_RSV_1"
            );
            cb(error);
            return;
          }
          if (this._payloadLength > 125 || this._opcode === 8 && this._payloadLength === 1) {
            const error = this.createError(
              RangeError,
              `invalid payload length ${this._payloadLength}`,
              true,
              1002,
              "WS_ERR_INVALID_CONTROL_PAYLOAD_LENGTH"
            );
            cb(error);
            return;
          }
        } else {
          const error = this.createError(
            RangeError,
            `invalid opcode ${this._opcode}`,
            true,
            1002,
            "WS_ERR_INVALID_OPCODE"
          );
          cb(error);
          return;
        }
        if (!this._fin && !this._fragmented) this._fragmented = this._opcode;
        this._masked = (buf[1] & 128) === 128;
        if (this._isServer) {
          if (!this._masked) {
            const error = this.createError(
              RangeError,
              "MASK must be set",
              true,
              1002,
              "WS_ERR_EXPECTED_MASK"
            );
            cb(error);
            return;
          }
        } else if (this._masked) {
          const error = this.createError(
            RangeError,
            "MASK must be clear",
            true,
            1002,
            "WS_ERR_UNEXPECTED_MASK"
          );
          cb(error);
          return;
        }
        if (this._payloadLength === 126) this._state = GET_PAYLOAD_LENGTH_16;
        else if (this._payloadLength === 127) this._state = GET_PAYLOAD_LENGTH_64;
        else this.haveLength(cb);
      }
      /**
       * Gets extended payload length (7+16).
       *
       * @param {Function} cb Callback
       * @private
       */
      getPayloadLength16(cb) {
        if (this._bufferedBytes < 2) {
          this._loop = false;
          return;
        }
        this._payloadLength = this.consume(2).readUInt16BE(0);
        this.haveLength(cb);
      }
      /**
       * Gets extended payload length (7+64).
       *
       * @param {Function} cb Callback
       * @private
       */
      getPayloadLength64(cb) {
        if (this._bufferedBytes < 8) {
          this._loop = false;
          return;
        }
        const buf = this.consume(8);
        const num = buf.readUInt32BE(0);
        if (num > Math.pow(2, 53 - 32) - 1) {
          const error = this.createError(
            RangeError,
            "Unsupported WebSocket frame: payload length > 2^53 - 1",
            false,
            1009,
            "WS_ERR_UNSUPPORTED_DATA_PAYLOAD_LENGTH"
          );
          cb(error);
          return;
        }
        this._payloadLength = num * Math.pow(2, 32) + buf.readUInt32BE(4);
        this.haveLength(cb);
      }
      /**
       * Payload length has been read.
       *
       * @param {Function} cb Callback
       * @private
       */
      haveLength(cb) {
        if (this._payloadLength && this._opcode < 8) {
          this._totalPayloadLength += this._payloadLength;
          if (this._totalPayloadLength > this._maxPayload && this._maxPayload > 0) {
            const error = this.createError(
              RangeError,
              "Max payload size exceeded",
              false,
              1009,
              "WS_ERR_UNSUPPORTED_MESSAGE_LENGTH"
            );
            cb(error);
            return;
          }
        }
        if (this._masked) this._state = GET_MASK;
        else this._state = GET_DATA;
      }
      /**
       * Reads mask bytes.
       *
       * @private
       */
      getMask() {
        if (this._bufferedBytes < 4) {
          this._loop = false;
          return;
        }
        this._mask = this.consume(4);
        this._state = GET_DATA;
      }
      /**
       * Reads data bytes.
       *
       * @param {Function} cb Callback
       * @private
       */
      getData(cb) {
        let data = EMPTY_BUFFER;
        if (this._payloadLength) {
          if (this._bufferedBytes < this._payloadLength) {
            this._loop = false;
            return;
          }
          data = this.consume(this._payloadLength);
          if (this._masked && (this._mask[0] | this._mask[1] | this._mask[2] | this._mask[3]) !== 0) {
            unmask(data, this._mask);
          }
        }
        if (this._opcode > 7) {
          this.controlMessage(data, cb);
          return;
        }
        if (this._compressed) {
          this._state = INFLATING;
          this.decompress(data, cb);
          return;
        }
        if (data.length) {
          this._messageLength = this._totalPayloadLength;
          this._fragments.push(data);
        }
        this.dataMessage(cb);
      }
      /**
       * Decompresses data.
       *
       * @param {Buffer} data Compressed data
       * @param {Function} cb Callback
       * @private
       */
      decompress(data, cb) {
        const perMessageDeflate = this._extensions[PerMessageDeflate.extensionName];
        perMessageDeflate.decompress(data, this._fin, (err, buf) => {
          if (err) return cb(err);
          if (buf.length) {
            this._messageLength += buf.length;
            if (this._messageLength > this._maxPayload && this._maxPayload > 0) {
              const error = this.createError(
                RangeError,
                "Max payload size exceeded",
                false,
                1009,
                "WS_ERR_UNSUPPORTED_MESSAGE_LENGTH"
              );
              cb(error);
              return;
            }
            this._fragments.push(buf);
          }
          this.dataMessage(cb);
          if (this._state === GET_INFO) this.startLoop(cb);
        });
      }
      /**
       * Handles a data message.
       *
       * @param {Function} cb Callback
       * @private
       */
      dataMessage(cb) {
        if (!this._fin) {
          this._state = GET_INFO;
          return;
        }
        const messageLength = this._messageLength;
        const fragments = this._fragments;
        this._totalPayloadLength = 0;
        this._messageLength = 0;
        this._fragmented = 0;
        this._fragments = [];
        if (this._opcode === 2) {
          let data;
          if (this._binaryType === "nodebuffer") {
            data = concat(fragments, messageLength);
          } else if (this._binaryType === "arraybuffer") {
            data = toArrayBuffer(concat(fragments, messageLength));
          } else if (this._binaryType === "blob") {
            data = new Blob(fragments);
          } else {
            data = fragments;
          }
          if (this._allowSynchronousEvents) {
            this.emit("message", data, true);
            this._state = GET_INFO;
          } else {
            this._state = DEFER_EVENT;
            setImmediate(() => {
              this.emit("message", data, true);
              this._state = GET_INFO;
              this.startLoop(cb);
            });
          }
        } else {
          const buf = concat(fragments, messageLength);
          if (!this._skipUTF8Validation && !isValidUTF8(buf)) {
            const error = this.createError(
              Error,
              "invalid UTF-8 sequence",
              true,
              1007,
              "WS_ERR_INVALID_UTF8"
            );
            cb(error);
            return;
          }
          if (this._state === INFLATING || this._allowSynchronousEvents) {
            this.emit("message", buf, false);
            this._state = GET_INFO;
          } else {
            this._state = DEFER_EVENT;
            setImmediate(() => {
              this.emit("message", buf, false);
              this._state = GET_INFO;
              this.startLoop(cb);
            });
          }
        }
      }
      /**
       * Handles a control message.
       *
       * @param {Buffer} data Data to handle
       * @return {(Error|RangeError|undefined)} A possible error
       * @private
       */
      controlMessage(data, cb) {
        if (this._opcode === 8) {
          if (data.length === 0) {
            this._loop = false;
            this.emit("conclude", 1005, EMPTY_BUFFER);
            this.end();
          } else {
            const code = data.readUInt16BE(0);
            if (!isValidStatusCode(code)) {
              const error = this.createError(
                RangeError,
                `invalid status code ${code}`,
                true,
                1002,
                "WS_ERR_INVALID_CLOSE_CODE"
              );
              cb(error);
              return;
            }
            const buf = new FastBuffer(
              data.buffer,
              data.byteOffset + 2,
              data.length - 2
            );
            if (!this._skipUTF8Validation && !isValidUTF8(buf)) {
              const error = this.createError(
                Error,
                "invalid UTF-8 sequence",
                true,
                1007,
                "WS_ERR_INVALID_UTF8"
              );
              cb(error);
              return;
            }
            this._loop = false;
            this.emit("conclude", code, buf);
            this.end();
          }
          this._state = GET_INFO;
          return;
        }
        if (this._allowSynchronousEvents) {
          this.emit(this._opcode === 9 ? "ping" : "pong", data);
          this._state = GET_INFO;
        } else {
          this._state = DEFER_EVENT;
          setImmediate(() => {
            this.emit(this._opcode === 9 ? "ping" : "pong", data);
            this._state = GET_INFO;
            this.startLoop(cb);
          });
        }
      }
      /**
       * Builds an error object.
       *
       * @param {function(new:Error|RangeError)} ErrorCtor The error constructor
       * @param {String} message The error message
       * @param {Boolean} prefix Specifies whether or not to add a default prefix to
       *     `message`
       * @param {Number} statusCode The status code
       * @param {String} errorCode The exposed error code
       * @return {(Error|RangeError)} The error
       * @private
       */
      createError(ErrorCtor, message, prefix, statusCode, errorCode) {
        this._loop = false;
        this._errored = true;
        const err = new ErrorCtor(
          prefix ? `Invalid WebSocket frame: ${message}` : message
        );
        Error.captureStackTrace(err, this.createError);
        err.code = errorCode;
        err[kStatusCode] = statusCode;
        return err;
      }
    };
    module.exports = Receiver2;
  }
});

// node_modules/ws/lib/sender.js
var require_sender = __commonJS({
  "node_modules/ws/lib/sender.js"(exports, module) {
    "use strict";
    var { Duplex } = __require("stream");
    var { randomFillSync } = __require("crypto");
    var PerMessageDeflate = require_permessage_deflate();
    var { EMPTY_BUFFER, kWebSocket, NOOP } = require_constants();
    var { isBlob, isValidStatusCode } = require_validation();
    var { mask: applyMask, toBuffer } = require_buffer_util();
    var kByteLength = /* @__PURE__ */ Symbol("kByteLength");
    var maskBuffer = Buffer.alloc(4);
    var RANDOM_POOL_SIZE = 8 * 1024;
    var randomPool;
    var randomPoolPointer = RANDOM_POOL_SIZE;
    var DEFAULT = 0;
    var DEFLATING = 1;
    var GET_BLOB_DATA = 2;
    var Sender2 = class _Sender {
      /**
       * Creates a Sender instance.
       *
       * @param {Duplex} socket The connection socket
       * @param {Object} [extensions] An object containing the negotiated extensions
       * @param {Function} [generateMask] The function used to generate the masking
       *     key
       */
      constructor(socket, extensions, generateMask) {
        this._extensions = extensions || {};
        if (generateMask) {
          this._generateMask = generateMask;
          this._maskBuffer = Buffer.alloc(4);
        }
        this._socket = socket;
        this._firstFragment = true;
        this._compress = false;
        this._bufferedBytes = 0;
        this._queue = [];
        this._state = DEFAULT;
        this.onerror = NOOP;
        this[kWebSocket] = void 0;
      }
      /**
       * Frames a piece of data according to the HyBi WebSocket protocol.
       *
       * @param {(Buffer|String)} data The data to frame
       * @param {Object} options Options object
       * @param {Boolean} [options.fin=false] Specifies whether or not to set the
       *     FIN bit
       * @param {Function} [options.generateMask] The function used to generate the
       *     masking key
       * @param {Boolean} [options.mask=false] Specifies whether or not to mask
       *     `data`
       * @param {Buffer} [options.maskBuffer] The buffer used to store the masking
       *     key
       * @param {Number} options.opcode The opcode
       * @param {Boolean} [options.readOnly=false] Specifies whether `data` can be
       *     modified
       * @param {Boolean} [options.rsv1=false] Specifies whether or not to set the
       *     RSV1 bit
       * @return {(Buffer|String)[]} The framed data
       * @public
       */
      static frame(data, options) {
        let mask;
        let merge = false;
        let offset = 2;
        let skipMasking = false;
        if (options.mask) {
          mask = options.maskBuffer || maskBuffer;
          if (options.generateMask) {
            options.generateMask(mask);
          } else {
            if (randomPoolPointer === RANDOM_POOL_SIZE) {
              if (randomPool === void 0) {
                randomPool = Buffer.alloc(RANDOM_POOL_SIZE);
              }
              randomFillSync(randomPool, 0, RANDOM_POOL_SIZE);
              randomPoolPointer = 0;
            }
            mask[0] = randomPool[randomPoolPointer++];
            mask[1] = randomPool[randomPoolPointer++];
            mask[2] = randomPool[randomPoolPointer++];
            mask[3] = randomPool[randomPoolPointer++];
          }
          skipMasking = (mask[0] | mask[1] | mask[2] | mask[3]) === 0;
          offset = 6;
        }
        let dataLength;
        if (typeof data === "string") {
          if ((!options.mask || skipMasking) && options[kByteLength] !== void 0) {
            dataLength = options[kByteLength];
          } else {
            data = Buffer.from(data);
            dataLength = data.length;
          }
        } else {
          dataLength = data.length;
          merge = options.mask && options.readOnly && !skipMasking;
        }
        let payloadLength = dataLength;
        if (dataLength >= 65536) {
          offset += 8;
          payloadLength = 127;
        } else if (dataLength > 125) {
          offset += 2;
          payloadLength = 126;
        }
        const target = Buffer.allocUnsafe(merge ? dataLength + offset : offset);
        target[0] = options.fin ? options.opcode | 128 : options.opcode;
        if (options.rsv1) target[0] |= 64;
        target[1] = payloadLength;
        if (payloadLength === 126) {
          target.writeUInt16BE(dataLength, 2);
        } else if (payloadLength === 127) {
          target[2] = target[3] = 0;
          target.writeUIntBE(dataLength, 4, 6);
        }
        if (!options.mask) return [target, data];
        target[1] |= 128;
        target[offset - 4] = mask[0];
        target[offset - 3] = mask[1];
        target[offset - 2] = mask[2];
        target[offset - 1] = mask[3];
        if (skipMasking) return [target, data];
        if (merge) {
          applyMask(data, mask, target, offset, dataLength);
          return [target];
        }
        applyMask(data, mask, data, 0, dataLength);
        return [target, data];
      }
      /**
       * Sends a close message to the other peer.
       *
       * @param {Number} [code] The status code component of the body
       * @param {(String|Buffer)} [data] The message component of the body
       * @param {Boolean} [mask=false] Specifies whether or not to mask the message
       * @param {Function} [cb] Callback
       * @public
       */
      close(code, data, mask, cb) {
        let buf;
        if (code === void 0) {
          buf = EMPTY_BUFFER;
        } else if (typeof code !== "number" || !isValidStatusCode(code)) {
          throw new TypeError("First argument must be a valid error code number");
        } else if (data === void 0 || !data.length) {
          buf = Buffer.allocUnsafe(2);
          buf.writeUInt16BE(code, 0);
        } else {
          const length = Buffer.byteLength(data);
          if (length > 123) {
            throw new RangeError("The message must not be greater than 123 bytes");
          }
          buf = Buffer.allocUnsafe(2 + length);
          buf.writeUInt16BE(code, 0);
          if (typeof data === "string") {
            buf.write(data, 2);
          } else {
            buf.set(data, 2);
          }
        }
        const options = {
          [kByteLength]: buf.length,
          fin: true,
          generateMask: this._generateMask,
          mask,
          maskBuffer: this._maskBuffer,
          opcode: 8,
          readOnly: false,
          rsv1: false
        };
        if (this._state !== DEFAULT) {
          this.enqueue([this.dispatch, buf, false, options, cb]);
        } else {
          this.sendFrame(_Sender.frame(buf, options), cb);
        }
      }
      /**
       * Sends a ping message to the other peer.
       *
       * @param {*} data The message to send
       * @param {Boolean} [mask=false] Specifies whether or not to mask `data`
       * @param {Function} [cb] Callback
       * @public
       */
      ping(data, mask, cb) {
        let byteLength;
        let readOnly;
        if (typeof data === "string") {
          byteLength = Buffer.byteLength(data);
          readOnly = false;
        } else if (isBlob(data)) {
          byteLength = data.size;
          readOnly = false;
        } else {
          data = toBuffer(data);
          byteLength = data.length;
          readOnly = toBuffer.readOnly;
        }
        if (byteLength > 125) {
          throw new RangeError("The data size must not be greater than 125 bytes");
        }
        const options = {
          [kByteLength]: byteLength,
          fin: true,
          generateMask: this._generateMask,
          mask,
          maskBuffer: this._maskBuffer,
          opcode: 9,
          readOnly,
          rsv1: false
        };
        if (isBlob(data)) {
          if (this._state !== DEFAULT) {
            this.enqueue([this.getBlobData, data, false, options, cb]);
          } else {
            this.getBlobData(data, false, options, cb);
          }
        } else if (this._state !== DEFAULT) {
          this.enqueue([this.dispatch, data, false, options, cb]);
        } else {
          this.sendFrame(_Sender.frame(data, options), cb);
        }
      }
      /**
       * Sends a pong message to the other peer.
       *
       * @param {*} data The message to send
       * @param {Boolean} [mask=false] Specifies whether or not to mask `data`
       * @param {Function} [cb] Callback
       * @public
       */
      pong(data, mask, cb) {
        let byteLength;
        let readOnly;
        if (typeof data === "string") {
          byteLength = Buffer.byteLength(data);
          readOnly = false;
        } else if (isBlob(data)) {
          byteLength = data.size;
          readOnly = false;
        } else {
          data = toBuffer(data);
          byteLength = data.length;
          readOnly = toBuffer.readOnly;
        }
        if (byteLength > 125) {
          throw new RangeError("The data size must not be greater than 125 bytes");
        }
        const options = {
          [kByteLength]: byteLength,
          fin: true,
          generateMask: this._generateMask,
          mask,
          maskBuffer: this._maskBuffer,
          opcode: 10,
          readOnly,
          rsv1: false
        };
        if (isBlob(data)) {
          if (this._state !== DEFAULT) {
            this.enqueue([this.getBlobData, data, false, options, cb]);
          } else {
            this.getBlobData(data, false, options, cb);
          }
        } else if (this._state !== DEFAULT) {
          this.enqueue([this.dispatch, data, false, options, cb]);
        } else {
          this.sendFrame(_Sender.frame(data, options), cb);
        }
      }
      /**
       * Sends a data message to the other peer.
       *
       * @param {*} data The message to send
       * @param {Object} options Options object
       * @param {Boolean} [options.binary=false] Specifies whether `data` is binary
       *     or text
       * @param {Boolean} [options.compress=false] Specifies whether or not to
       *     compress `data`
       * @param {Boolean} [options.fin=false] Specifies whether the fragment is the
       *     last one
       * @param {Boolean} [options.mask=false] Specifies whether or not to mask
       *     `data`
       * @param {Function} [cb] Callback
       * @public
       */
      send(data, options, cb) {
        const perMessageDeflate = this._extensions[PerMessageDeflate.extensionName];
        let opcode = options.binary ? 2 : 1;
        let rsv1 = options.compress;
        let byteLength;
        let readOnly;
        if (typeof data === "string") {
          byteLength = Buffer.byteLength(data);
          readOnly = false;
        } else if (isBlob(data)) {
          byteLength = data.size;
          readOnly = false;
        } else {
          data = toBuffer(data);
          byteLength = data.length;
          readOnly = toBuffer.readOnly;
        }
        if (this._firstFragment) {
          this._firstFragment = false;
          if (rsv1 && perMessageDeflate && perMessageDeflate.params[perMessageDeflate._isServer ? "server_no_context_takeover" : "client_no_context_takeover"]) {
            rsv1 = byteLength >= perMessageDeflate._threshold;
          }
          this._compress = rsv1;
        } else {
          rsv1 = false;
          opcode = 0;
        }
        if (options.fin) this._firstFragment = true;
        const opts = {
          [kByteLength]: byteLength,
          fin: options.fin,
          generateMask: this._generateMask,
          mask: options.mask,
          maskBuffer: this._maskBuffer,
          opcode,
          readOnly,
          rsv1
        };
        if (isBlob(data)) {
          if (this._state !== DEFAULT) {
            this.enqueue([this.getBlobData, data, this._compress, opts, cb]);
          } else {
            this.getBlobData(data, this._compress, opts, cb);
          }
        } else if (this._state !== DEFAULT) {
          this.enqueue([this.dispatch, data, this._compress, opts, cb]);
        } else {
          this.dispatch(data, this._compress, opts, cb);
        }
      }
      /**
       * Gets the contents of a blob as binary data.
       *
       * @param {Blob} blob The blob
       * @param {Boolean} [compress=false] Specifies whether or not to compress
       *     the data
       * @param {Object} options Options object
       * @param {Boolean} [options.fin=false] Specifies whether or not to set the
       *     FIN bit
       * @param {Function} [options.generateMask] The function used to generate the
       *     masking key
       * @param {Boolean} [options.mask=false] Specifies whether or not to mask
       *     `data`
       * @param {Buffer} [options.maskBuffer] The buffer used to store the masking
       *     key
       * @param {Number} options.opcode The opcode
       * @param {Boolean} [options.readOnly=false] Specifies whether `data` can be
       *     modified
       * @param {Boolean} [options.rsv1=false] Specifies whether or not to set the
       *     RSV1 bit
       * @param {Function} [cb] Callback
       * @private
       */
      getBlobData(blob, compress, options, cb) {
        this._bufferedBytes += options[kByteLength];
        this._state = GET_BLOB_DATA;
        blob.arrayBuffer().then((arrayBuffer) => {
          if (this._socket.destroyed) {
            const err = new Error(
              "The socket was closed while the blob was being read"
            );
            process.nextTick(callCallbacks, this, err, cb);
            return;
          }
          this._bufferedBytes -= options[kByteLength];
          const data = toBuffer(arrayBuffer);
          if (!compress) {
            this._state = DEFAULT;
            this.sendFrame(_Sender.frame(data, options), cb);
            this.dequeue();
          } else {
            this.dispatch(data, compress, options, cb);
          }
        }).catch((err) => {
          process.nextTick(onError, this, err, cb);
        });
      }
      /**
       * Dispatches a message.
       *
       * @param {(Buffer|String)} data The message to send
       * @param {Boolean} [compress=false] Specifies whether or not to compress
       *     `data`
       * @param {Object} options Options object
       * @param {Boolean} [options.fin=false] Specifies whether or not to set the
       *     FIN bit
       * @param {Function} [options.generateMask] The function used to generate the
       *     masking key
       * @param {Boolean} [options.mask=false] Specifies whether or not to mask
       *     `data`
       * @param {Buffer} [options.maskBuffer] The buffer used to store the masking
       *     key
       * @param {Number} options.opcode The opcode
       * @param {Boolean} [options.readOnly=false] Specifies whether `data` can be
       *     modified
       * @param {Boolean} [options.rsv1=false] Specifies whether or not to set the
       *     RSV1 bit
       * @param {Function} [cb] Callback
       * @private
       */
      dispatch(data, compress, options, cb) {
        if (!compress) {
          this.sendFrame(_Sender.frame(data, options), cb);
          return;
        }
        const perMessageDeflate = this._extensions[PerMessageDeflate.extensionName];
        this._bufferedBytes += options[kByteLength];
        this._state = DEFLATING;
        perMessageDeflate.compress(data, options.fin, (_, buf) => {
          if (this._socket.destroyed) {
            const err = new Error(
              "The socket was closed while data was being compressed"
            );
            callCallbacks(this, err, cb);
            return;
          }
          this._bufferedBytes -= options[kByteLength];
          this._state = DEFAULT;
          options.readOnly = false;
          this.sendFrame(_Sender.frame(buf, options), cb);
          this.dequeue();
        });
      }
      /**
       * Executes queued send operations.
       *
       * @private
       */
      dequeue() {
        while (this._state === DEFAULT && this._queue.length) {
          const params = this._queue.shift();
          this._bufferedBytes -= params[3][kByteLength];
          Reflect.apply(params[0], this, params.slice(1));
        }
      }
      /**
       * Enqueues a send operation.
       *
       * @param {Array} params Send operation parameters.
       * @private
       */
      enqueue(params) {
        this._bufferedBytes += params[3][kByteLength];
        this._queue.push(params);
      }
      /**
       * Sends a frame.
       *
       * @param {(Buffer | String)[]} list The frame to send
       * @param {Function} [cb] Callback
       * @private
       */
      sendFrame(list, cb) {
        if (list.length === 2) {
          this._socket.cork();
          this._socket.write(list[0]);
          this._socket.write(list[1], cb);
          this._socket.uncork();
        } else {
          this._socket.write(list[0], cb);
        }
      }
    };
    module.exports = Sender2;
    function callCallbacks(sender, err, cb) {
      if (typeof cb === "function") cb(err);
      for (let i = 0; i < sender._queue.length; i++) {
        const params = sender._queue[i];
        const callback = params[params.length - 1];
        if (typeof callback === "function") callback(err);
      }
    }
    function onError(sender, err, cb) {
      callCallbacks(sender, err, cb);
      sender.onerror(err);
    }
  }
});

// node_modules/ws/lib/event-target.js
var require_event_target = __commonJS({
  "node_modules/ws/lib/event-target.js"(exports, module) {
    "use strict";
    var { kForOnEventAttribute, kListener } = require_constants();
    var kCode = /* @__PURE__ */ Symbol("kCode");
    var kData = /* @__PURE__ */ Symbol("kData");
    var kError = /* @__PURE__ */ Symbol("kError");
    var kMessage = /* @__PURE__ */ Symbol("kMessage");
    var kReason = /* @__PURE__ */ Symbol("kReason");
    var kTarget = /* @__PURE__ */ Symbol("kTarget");
    var kType = /* @__PURE__ */ Symbol("kType");
    var kWasClean = /* @__PURE__ */ Symbol("kWasClean");
    var Event = class {
      /**
       * Create a new `Event`.
       *
       * @param {String} type The name of the event
       * @throws {TypeError} If the `type` argument is not specified
       */
      constructor(type) {
        this[kTarget] = null;
        this[kType] = type;
      }
      /**
       * @type {*}
       */
      get target() {
        return this[kTarget];
      }
      /**
       * @type {String}
       */
      get type() {
        return this[kType];
      }
    };
    Object.defineProperty(Event.prototype, "target", { enumerable: true });
    Object.defineProperty(Event.prototype, "type", { enumerable: true });
    var CloseEvent = class extends Event {
      /**
       * Create a new `CloseEvent`.
       *
       * @param {String} type The name of the event
       * @param {Object} [options] A dictionary object that allows for setting
       *     attributes via object members of the same name
       * @param {Number} [options.code=0] The status code explaining why the
       *     connection was closed
       * @param {String} [options.reason=''] A human-readable string explaining why
       *     the connection was closed
       * @param {Boolean} [options.wasClean=false] Indicates whether or not the
       *     connection was cleanly closed
       */
      constructor(type, options = {}) {
        super(type);
        this[kCode] = options.code === void 0 ? 0 : options.code;
        this[kReason] = options.reason === void 0 ? "" : options.reason;
        this[kWasClean] = options.wasClean === void 0 ? false : options.wasClean;
      }
      /**
       * @type {Number}
       */
      get code() {
        return this[kCode];
      }
      /**
       * @type {String}
       */
      get reason() {
        return this[kReason];
      }
      /**
       * @type {Boolean}
       */
      get wasClean() {
        return this[kWasClean];
      }
    };
    Object.defineProperty(CloseEvent.prototype, "code", { enumerable: true });
    Object.defineProperty(CloseEvent.prototype, "reason", { enumerable: true });
    Object.defineProperty(CloseEvent.prototype, "wasClean", { enumerable: true });
    var ErrorEvent = class extends Event {
      /**
       * Create a new `ErrorEvent`.
       *
       * @param {String} type The name of the event
       * @param {Object} [options] A dictionary object that allows for setting
       *     attributes via object members of the same name
       * @param {*} [options.error=null] The error that generated this event
       * @param {String} [options.message=''] The error message
       */
      constructor(type, options = {}) {
        super(type);
        this[kError] = options.error === void 0 ? null : options.error;
        this[kMessage] = options.message === void 0 ? "" : options.message;
      }
      /**
       * @type {*}
       */
      get error() {
        return this[kError];
      }
      /**
       * @type {String}
       */
      get message() {
        return this[kMessage];
      }
    };
    Object.defineProperty(ErrorEvent.prototype, "error", { enumerable: true });
    Object.defineProperty(ErrorEvent.prototype, "message", { enumerable: true });
    var MessageEvent = class extends Event {
      /**
       * Create a new `MessageEvent`.
       *
       * @param {String} type The name of the event
       * @param {Object} [options] A dictionary object that allows for setting
       *     attributes via object members of the same name
       * @param {*} [options.data=null] The message content
       */
      constructor(type, options = {}) {
        super(type);
        this[kData] = options.data === void 0 ? null : options.data;
      }
      /**
       * @type {*}
       */
      get data() {
        return this[kData];
      }
    };
    Object.defineProperty(MessageEvent.prototype, "data", { enumerable: true });
    var EventTarget = {
      /**
       * Register an event listener.
       *
       * @param {String} type A string representing the event type to listen for
       * @param {(Function|Object)} handler The listener to add
       * @param {Object} [options] An options object specifies characteristics about
       *     the event listener
       * @param {Boolean} [options.once=false] A `Boolean` indicating that the
       *     listener should be invoked at most once after being added. If `true`,
       *     the listener would be automatically removed when invoked.
       * @public
       */
      addEventListener(type, handler, options = {}) {
        for (const listener of this.listeners(type)) {
          if (!options[kForOnEventAttribute] && listener[kListener] === handler && !listener[kForOnEventAttribute]) {
            return;
          }
        }
        let wrapper;
        if (type === "message") {
          wrapper = function onMessage(data, isBinary) {
            const event = new MessageEvent("message", {
              data: isBinary ? data : data.toString()
            });
            event[kTarget] = this;
            callListener(handler, this, event);
          };
        } else if (type === "close") {
          wrapper = function onClose(code, message) {
            const event = new CloseEvent("close", {
              code,
              reason: message.toString(),
              wasClean: this._closeFrameReceived && this._closeFrameSent
            });
            event[kTarget] = this;
            callListener(handler, this, event);
          };
        } else if (type === "error") {
          wrapper = function onError(error) {
            const event = new ErrorEvent("error", {
              error,
              message: error.message
            });
            event[kTarget] = this;
            callListener(handler, this, event);
          };
        } else if (type === "open") {
          wrapper = function onOpen() {
            const event = new Event("open");
            event[kTarget] = this;
            callListener(handler, this, event);
          };
        } else {
          return;
        }
        wrapper[kForOnEventAttribute] = !!options[kForOnEventAttribute];
        wrapper[kListener] = handler;
        if (options.once) {
          this.once(type, wrapper);
        } else {
          this.on(type, wrapper);
        }
      },
      /**
       * Remove an event listener.
       *
       * @param {String} type A string representing the event type to remove
       * @param {(Function|Object)} handler The listener to remove
       * @public
       */
      removeEventListener(type, handler) {
        for (const listener of this.listeners(type)) {
          if (listener[kListener] === handler && !listener[kForOnEventAttribute]) {
            this.removeListener(type, listener);
            break;
          }
        }
      }
    };
    module.exports = {
      CloseEvent,
      ErrorEvent,
      Event,
      EventTarget,
      MessageEvent
    };
    function callListener(listener, thisArg, event) {
      if (typeof listener === "object" && listener.handleEvent) {
        listener.handleEvent.call(listener, event);
      } else {
        listener.call(thisArg, event);
      }
    }
  }
});

// node_modules/ws/lib/extension.js
var require_extension = __commonJS({
  "node_modules/ws/lib/extension.js"(exports, module) {
    "use strict";
    var { tokenChars } = require_validation();
    function push(dest, name, elem) {
      if (dest[name] === void 0) dest[name] = [elem];
      else dest[name].push(elem);
    }
    function parse(header) {
      const offers = /* @__PURE__ */ Object.create(null);
      let params = /* @__PURE__ */ Object.create(null);
      let mustUnescape = false;
      let isEscaping = false;
      let inQuotes = false;
      let extensionName;
      let paramName;
      let start = -1;
      let code = -1;
      let end = -1;
      let i = 0;
      for (; i < header.length; i++) {
        code = header.charCodeAt(i);
        if (extensionName === void 0) {
          if (end === -1 && tokenChars[code] === 1) {
            if (start === -1) start = i;
          } else if (i !== 0 && (code === 32 || code === 9)) {
            if (end === -1 && start !== -1) end = i;
          } else if (code === 59 || code === 44) {
            if (start === -1) {
              throw new SyntaxError(`Unexpected character at index ${i}`);
            }
            if (end === -1) end = i;
            const name = header.slice(start, end);
            if (code === 44) {
              push(offers, name, params);
              params = /* @__PURE__ */ Object.create(null);
            } else {
              extensionName = name;
            }
            start = end = -1;
          } else {
            throw new SyntaxError(`Unexpected character at index ${i}`);
          }
        } else if (paramName === void 0) {
          if (end === -1 && tokenChars[code] === 1) {
            if (start === -1) start = i;
          } else if (code === 32 || code === 9) {
            if (end === -1 && start !== -1) end = i;
          } else if (code === 59 || code === 44) {
            if (start === -1) {
              throw new SyntaxError(`Unexpected character at index ${i}`);
            }
            if (end === -1) end = i;
            push(params, header.slice(start, end), true);
            if (code === 44) {
              push(offers, extensionName, params);
              params = /* @__PURE__ */ Object.create(null);
              extensionName = void 0;
            }
            start = end = -1;
          } else if (code === 61 && start !== -1 && end === -1) {
            paramName = header.slice(start, i);
            start = end = -1;
          } else {
            throw new SyntaxError(`Unexpected character at index ${i}`);
          }
        } else {
          if (isEscaping) {
            if (tokenChars[code] !== 1) {
              throw new SyntaxError(`Unexpected character at index ${i}`);
            }
            if (start === -1) start = i;
            else if (!mustUnescape) mustUnescape = true;
            isEscaping = false;
          } else if (inQuotes) {
            if (tokenChars[code] === 1) {
              if (start === -1) start = i;
            } else if (code === 34 && start !== -1) {
              inQuotes = false;
              end = i;
            } else if (code === 92) {
              isEscaping = true;
            } else {
              throw new SyntaxError(`Unexpected character at index ${i}`);
            }
          } else if (code === 34 && header.charCodeAt(i - 1) === 61) {
            inQuotes = true;
          } else if (end === -1 && tokenChars[code] === 1) {
            if (start === -1) start = i;
          } else if (start !== -1 && (code === 32 || code === 9)) {
            if (end === -1) end = i;
          } else if (code === 59 || code === 44) {
            if (start === -1) {
              throw new SyntaxError(`Unexpected character at index ${i}`);
            }
            if (end === -1) end = i;
            let value = header.slice(start, end);
            if (mustUnescape) {
              value = value.replace(/\\/g, "");
              mustUnescape = false;
            }
            push(params, paramName, value);
            if (code === 44) {
              push(offers, extensionName, params);
              params = /* @__PURE__ */ Object.create(null);
              extensionName = void 0;
            }
            paramName = void 0;
            start = end = -1;
          } else {
            throw new SyntaxError(`Unexpected character at index ${i}`);
          }
        }
      }
      if (start === -1 || inQuotes || code === 32 || code === 9) {
        throw new SyntaxError("Unexpected end of input");
      }
      if (end === -1) end = i;
      const token = header.slice(start, end);
      if (extensionName === void 0) {
        push(offers, token, params);
      } else {
        if (paramName === void 0) {
          push(params, token, true);
        } else if (mustUnescape) {
          push(params, paramName, token.replace(/\\/g, ""));
        } else {
          push(params, paramName, token);
        }
        push(offers, extensionName, params);
      }
      return offers;
    }
    function format(extensions) {
      return Object.keys(extensions).map((extension) => {
        let configurations = extensions[extension];
        if (!Array.isArray(configurations)) configurations = [configurations];
        return configurations.map((params) => {
          return [extension].concat(
            Object.keys(params).map((k) => {
              let values = params[k];
              if (!Array.isArray(values)) values = [values];
              return values.map((v) => v === true ? k : `${k}=${v}`).join("; ");
            })
          ).join("; ");
        }).join(", ");
      }).join(", ");
    }
    module.exports = { format, parse };
  }
});

// node_modules/ws/lib/websocket.js
var require_websocket = __commonJS({
  "node_modules/ws/lib/websocket.js"(exports, module) {
    "use strict";
    var EventEmitter = __require("events");
    var https = __require("https");
    var http2 = __require("http");
    var net = __require("net");
    var tls = __require("tls");
    var { randomBytes, createHash: createHash2 } = __require("crypto");
    var { Duplex, Readable } = __require("stream");
    var { URL: URL2 } = __require("url");
    var PerMessageDeflate = require_permessage_deflate();
    var Receiver2 = require_receiver();
    var Sender2 = require_sender();
    var { isBlob } = require_validation();
    var {
      BINARY_TYPES,
      CLOSE_TIMEOUT,
      EMPTY_BUFFER,
      GUID,
      kForOnEventAttribute,
      kListener,
      kStatusCode,
      kWebSocket,
      NOOP
    } = require_constants();
    var {
      EventTarget: { addEventListener, removeEventListener }
    } = require_event_target();
    var { format, parse } = require_extension();
    var { toBuffer } = require_buffer_util();
    var kAborted = /* @__PURE__ */ Symbol("kAborted");
    var protocolVersions = [8, 13];
    var readyStates = ["CONNECTING", "OPEN", "CLOSING", "CLOSED"];
    var subprotocolRegex = /^[!#$%&'*+\-.0-9A-Z^_`|a-z~]+$/;
    var WebSocket2 = class _WebSocket extends EventEmitter {
      /**
       * Create a new `WebSocket`.
       *
       * @param {(String|URL)} address The URL to which to connect
       * @param {(String|String[])} [protocols] The subprotocols
       * @param {Object} [options] Connection options
       */
      constructor(address, protocols, options) {
        super();
        this._binaryType = BINARY_TYPES[0];
        this._closeCode = 1006;
        this._closeFrameReceived = false;
        this._closeFrameSent = false;
        this._closeMessage = EMPTY_BUFFER;
        this._closeTimer = null;
        this._errorEmitted = false;
        this._extensions = {};
        this._paused = false;
        this._protocol = "";
        this._readyState = _WebSocket.CONNECTING;
        this._receiver = null;
        this._sender = null;
        this._socket = null;
        if (address !== null) {
          this._bufferedAmount = 0;
          this._isServer = false;
          this._redirects = 0;
          if (protocols === void 0) {
            protocols = [];
          } else if (!Array.isArray(protocols)) {
            if (typeof protocols === "object" && protocols !== null) {
              options = protocols;
              protocols = [];
            } else {
              protocols = [protocols];
            }
          }
          initAsClient(this, address, protocols, options);
        } else {
          this._autoPong = options.autoPong;
          this._closeTimeout = options.closeTimeout;
          this._isServer = true;
        }
      }
      /**
       * For historical reasons, the custom "nodebuffer" type is used by the default
       * instead of "blob".
       *
       * @type {String}
       */
      get binaryType() {
        return this._binaryType;
      }
      set binaryType(type) {
        if (!BINARY_TYPES.includes(type)) return;
        this._binaryType = type;
        if (this._receiver) this._receiver._binaryType = type;
      }
      /**
       * @type {Number}
       */
      get bufferedAmount() {
        if (!this._socket) return this._bufferedAmount;
        return this._socket._writableState.length + this._sender._bufferedBytes;
      }
      /**
       * @type {String}
       */
      get extensions() {
        return Object.keys(this._extensions).join();
      }
      /**
       * @type {Boolean}
       */
      get isPaused() {
        return this._paused;
      }
      /**
       * @type {Function}
       */
      /* istanbul ignore next */
      get onclose() {
        return null;
      }
      /**
       * @type {Function}
       */
      /* istanbul ignore next */
      get onerror() {
        return null;
      }
      /**
       * @type {Function}
       */
      /* istanbul ignore next */
      get onopen() {
        return null;
      }
      /**
       * @type {Function}
       */
      /* istanbul ignore next */
      get onmessage() {
        return null;
      }
      /**
       * @type {String}
       */
      get protocol() {
        return this._protocol;
      }
      /**
       * @type {Number}
       */
      get readyState() {
        return this._readyState;
      }
      /**
       * @type {String}
       */
      get url() {
        return this._url;
      }
      /**
       * Set up the socket and the internal resources.
       *
       * @param {Duplex} socket The network socket between the server and client
       * @param {Buffer} head The first packet of the upgraded stream
       * @param {Object} options Options object
       * @param {Boolean} [options.allowSynchronousEvents=false] Specifies whether
       *     any of the `'message'`, `'ping'`, and `'pong'` events can be emitted
       *     multiple times in the same tick
       * @param {Function} [options.generateMask] The function used to generate the
       *     masking key
       * @param {Number} [options.maxPayload=0] The maximum allowed message size
       * @param {Boolean} [options.skipUTF8Validation=false] Specifies whether or
       *     not to skip UTF-8 validation for text and close messages
       * @private
       */
      setSocket(socket, head, options) {
        const receiver = new Receiver2({
          allowSynchronousEvents: options.allowSynchronousEvents,
          binaryType: this.binaryType,
          extensions: this._extensions,
          isServer: this._isServer,
          maxPayload: options.maxPayload,
          skipUTF8Validation: options.skipUTF8Validation
        });
        const sender = new Sender2(socket, this._extensions, options.generateMask);
        this._receiver = receiver;
        this._sender = sender;
        this._socket = socket;
        receiver[kWebSocket] = this;
        sender[kWebSocket] = this;
        socket[kWebSocket] = this;
        receiver.on("conclude", receiverOnConclude);
        receiver.on("drain", receiverOnDrain);
        receiver.on("error", receiverOnError);
        receiver.on("message", receiverOnMessage);
        receiver.on("ping", receiverOnPing);
        receiver.on("pong", receiverOnPong);
        sender.onerror = senderOnError;
        if (socket.setTimeout) socket.setTimeout(0);
        if (socket.setNoDelay) socket.setNoDelay();
        if (head.length > 0) socket.unshift(head);
        socket.on("close", socketOnClose);
        socket.on("data", socketOnData);
        socket.on("end", socketOnEnd);
        socket.on("error", socketOnError);
        this._readyState = _WebSocket.OPEN;
        this.emit("open");
      }
      /**
       * Emit the `'close'` event.
       *
       * @private
       */
      emitClose() {
        if (!this._socket) {
          this._readyState = _WebSocket.CLOSED;
          this.emit("close", this._closeCode, this._closeMessage);
          return;
        }
        if (this._extensions[PerMessageDeflate.extensionName]) {
          this._extensions[PerMessageDeflate.extensionName].cleanup();
        }
        this._receiver.removeAllListeners();
        this._readyState = _WebSocket.CLOSED;
        this.emit("close", this._closeCode, this._closeMessage);
      }
      /**
       * Start a closing handshake.
       *
       *          +----------+   +-----------+   +----------+
       *     - - -|ws.close()|-->|close frame|-->|ws.close()|- - -
       *    |     +----------+   +-----------+   +----------+     |
       *          +----------+   +-----------+         |
       * CLOSING  |ws.close()|<--|close frame|<--+-----+       CLOSING
       *          +----------+   +-----------+   |
       *    |           |                        |   +---+        |
       *                +------------------------+-->|fin| - - - -
       *    |         +---+                      |   +---+
       *     - - - - -|fin|<---------------------+
       *              +---+
       *
       * @param {Number} [code] Status code explaining why the connection is closing
       * @param {(String|Buffer)} [data] The reason why the connection is
       *     closing
       * @public
       */
      close(code, data) {
        if (this.readyState === _WebSocket.CLOSED) return;
        if (this.readyState === _WebSocket.CONNECTING) {
          const msg = "WebSocket was closed before the connection was established";
          abortHandshake(this, this._req, msg);
          return;
        }
        if (this.readyState === _WebSocket.CLOSING) {
          if (this._closeFrameSent && (this._closeFrameReceived || this._receiver._writableState.errorEmitted)) {
            this._socket.end();
          }
          return;
        }
        this._readyState = _WebSocket.CLOSING;
        this._sender.close(code, data, !this._isServer, (err) => {
          if (err) return;
          this._closeFrameSent = true;
          if (this._closeFrameReceived || this._receiver._writableState.errorEmitted) {
            this._socket.end();
          }
        });
        setCloseTimer(this);
      }
      /**
       * Pause the socket.
       *
       * @public
       */
      pause() {
        if (this.readyState === _WebSocket.CONNECTING || this.readyState === _WebSocket.CLOSED) {
          return;
        }
        this._paused = true;
        this._socket.pause();
      }
      /**
       * Send a ping.
       *
       * @param {*} [data] The data to send
       * @param {Boolean} [mask] Indicates whether or not to mask `data`
       * @param {Function} [cb] Callback which is executed when the ping is sent
       * @public
       */
      ping(data, mask, cb) {
        if (this.readyState === _WebSocket.CONNECTING) {
          throw new Error("WebSocket is not open: readyState 0 (CONNECTING)");
        }
        if (typeof data === "function") {
          cb = data;
          data = mask = void 0;
        } else if (typeof mask === "function") {
          cb = mask;
          mask = void 0;
        }
        if (typeof data === "number") data = data.toString();
        if (this.readyState !== _WebSocket.OPEN) {
          sendAfterClose(this, data, cb);
          return;
        }
        if (mask === void 0) mask = !this._isServer;
        this._sender.ping(data || EMPTY_BUFFER, mask, cb);
      }
      /**
       * Send a pong.
       *
       * @param {*} [data] The data to send
       * @param {Boolean} [mask] Indicates whether or not to mask `data`
       * @param {Function} [cb] Callback which is executed when the pong is sent
       * @public
       */
      pong(data, mask, cb) {
        if (this.readyState === _WebSocket.CONNECTING) {
          throw new Error("WebSocket is not open: readyState 0 (CONNECTING)");
        }
        if (typeof data === "function") {
          cb = data;
          data = mask = void 0;
        } else if (typeof mask === "function") {
          cb = mask;
          mask = void 0;
        }
        if (typeof data === "number") data = data.toString();
        if (this.readyState !== _WebSocket.OPEN) {
          sendAfterClose(this, data, cb);
          return;
        }
        if (mask === void 0) mask = !this._isServer;
        this._sender.pong(data || EMPTY_BUFFER, mask, cb);
      }
      /**
       * Resume the socket.
       *
       * @public
       */
      resume() {
        if (this.readyState === _WebSocket.CONNECTING || this.readyState === _WebSocket.CLOSED) {
          return;
        }
        this._paused = false;
        if (!this._receiver._writableState.needDrain) this._socket.resume();
      }
      /**
       * Send a data message.
       *
       * @param {*} data The message to send
       * @param {Object} [options] Options object
       * @param {Boolean} [options.binary] Specifies whether `data` is binary or
       *     text
       * @param {Boolean} [options.compress] Specifies whether or not to compress
       *     `data`
       * @param {Boolean} [options.fin=true] Specifies whether the fragment is the
       *     last one
       * @param {Boolean} [options.mask] Specifies whether or not to mask `data`
       * @param {Function} [cb] Callback which is executed when data is written out
       * @public
       */
      send(data, options, cb) {
        if (this.readyState === _WebSocket.CONNECTING) {
          throw new Error("WebSocket is not open: readyState 0 (CONNECTING)");
        }
        if (typeof options === "function") {
          cb = options;
          options = {};
        }
        if (typeof data === "number") data = data.toString();
        if (this.readyState !== _WebSocket.OPEN) {
          sendAfterClose(this, data, cb);
          return;
        }
        const opts = {
          binary: typeof data !== "string",
          mask: !this._isServer,
          compress: true,
          fin: true,
          ...options
        };
        if (!this._extensions[PerMessageDeflate.extensionName]) {
          opts.compress = false;
        }
        this._sender.send(data || EMPTY_BUFFER, opts, cb);
      }
      /**
       * Forcibly close the connection.
       *
       * @public
       */
      terminate() {
        if (this.readyState === _WebSocket.CLOSED) return;
        if (this.readyState === _WebSocket.CONNECTING) {
          const msg = "WebSocket was closed before the connection was established";
          abortHandshake(this, this._req, msg);
          return;
        }
        if (this._socket) {
          this._readyState = _WebSocket.CLOSING;
          this._socket.destroy();
        }
      }
    };
    Object.defineProperty(WebSocket2, "CONNECTING", {
      enumerable: true,
      value: readyStates.indexOf("CONNECTING")
    });
    Object.defineProperty(WebSocket2.prototype, "CONNECTING", {
      enumerable: true,
      value: readyStates.indexOf("CONNECTING")
    });
    Object.defineProperty(WebSocket2, "OPEN", {
      enumerable: true,
      value: readyStates.indexOf("OPEN")
    });
    Object.defineProperty(WebSocket2.prototype, "OPEN", {
      enumerable: true,
      value: readyStates.indexOf("OPEN")
    });
    Object.defineProperty(WebSocket2, "CLOSING", {
      enumerable: true,
      value: readyStates.indexOf("CLOSING")
    });
    Object.defineProperty(WebSocket2.prototype, "CLOSING", {
      enumerable: true,
      value: readyStates.indexOf("CLOSING")
    });
    Object.defineProperty(WebSocket2, "CLOSED", {
      enumerable: true,
      value: readyStates.indexOf("CLOSED")
    });
    Object.defineProperty(WebSocket2.prototype, "CLOSED", {
      enumerable: true,
      value: readyStates.indexOf("CLOSED")
    });
    [
      "binaryType",
      "bufferedAmount",
      "extensions",
      "isPaused",
      "protocol",
      "readyState",
      "url"
    ].forEach((property) => {
      Object.defineProperty(WebSocket2.prototype, property, { enumerable: true });
    });
    ["open", "error", "close", "message"].forEach((method) => {
      Object.defineProperty(WebSocket2.prototype, `on${method}`, {
        enumerable: true,
        get() {
          for (const listener of this.listeners(method)) {
            if (listener[kForOnEventAttribute]) return listener[kListener];
          }
          return null;
        },
        set(handler) {
          for (const listener of this.listeners(method)) {
            if (listener[kForOnEventAttribute]) {
              this.removeListener(method, listener);
              break;
            }
          }
          if (typeof handler !== "function") return;
          this.addEventListener(method, handler, {
            [kForOnEventAttribute]: true
          });
        }
      });
    });
    WebSocket2.prototype.addEventListener = addEventListener;
    WebSocket2.prototype.removeEventListener = removeEventListener;
    module.exports = WebSocket2;
    function initAsClient(websocket, address, protocols, options) {
      const opts = {
        allowSynchronousEvents: true,
        autoPong: true,
        closeTimeout: CLOSE_TIMEOUT,
        protocolVersion: protocolVersions[1],
        maxPayload: 100 * 1024 * 1024,
        skipUTF8Validation: false,
        perMessageDeflate: true,
        followRedirects: false,
        maxRedirects: 10,
        ...options,
        socketPath: void 0,
        hostname: void 0,
        protocol: void 0,
        timeout: void 0,
        method: "GET",
        host: void 0,
        path: void 0,
        port: void 0
      };
      websocket._autoPong = opts.autoPong;
      websocket._closeTimeout = opts.closeTimeout;
      if (!protocolVersions.includes(opts.protocolVersion)) {
        throw new RangeError(
          `Unsupported protocol version: ${opts.protocolVersion} (supported versions: ${protocolVersions.join(", ")})`
        );
      }
      let parsedUrl;
      if (address instanceof URL2) {
        parsedUrl = address;
      } else {
        try {
          parsedUrl = new URL2(address);
        } catch (e) {
          throw new SyntaxError(`Invalid URL: ${address}`);
        }
      }
      if (parsedUrl.protocol === "http:") {
        parsedUrl.protocol = "ws:";
      } else if (parsedUrl.protocol === "https:") {
        parsedUrl.protocol = "wss:";
      }
      websocket._url = parsedUrl.href;
      const isSecure = parsedUrl.protocol === "wss:";
      const isIpcUrl = parsedUrl.protocol === "ws+unix:";
      let invalidUrlMessage;
      if (parsedUrl.protocol !== "ws:" && !isSecure && !isIpcUrl) {
        invalidUrlMessage = `The URL's protocol must be one of "ws:", "wss:", "http:", "https:", or "ws+unix:"`;
      } else if (isIpcUrl && !parsedUrl.pathname) {
        invalidUrlMessage = "The URL's pathname is empty";
      } else if (parsedUrl.hash) {
        invalidUrlMessage = "The URL contains a fragment identifier";
      }
      if (invalidUrlMessage) {
        const err = new SyntaxError(invalidUrlMessage);
        if (websocket._redirects === 0) {
          throw err;
        } else {
          emitErrorAndClose(websocket, err);
          return;
        }
      }
      const defaultPort = isSecure ? 443 : 80;
      const key = randomBytes(16).toString("base64");
      const request = isSecure ? https.request : http2.request;
      const protocolSet = /* @__PURE__ */ new Set();
      let perMessageDeflate;
      opts.createConnection = opts.createConnection || (isSecure ? tlsConnect : netConnect);
      opts.defaultPort = opts.defaultPort || defaultPort;
      opts.port = parsedUrl.port || defaultPort;
      opts.host = parsedUrl.hostname.startsWith("[") ? parsedUrl.hostname.slice(1, -1) : parsedUrl.hostname;
      opts.headers = {
        ...opts.headers,
        "Sec-WebSocket-Version": opts.protocolVersion,
        "Sec-WebSocket-Key": key,
        Connection: "Upgrade",
        Upgrade: "websocket"
      };
      opts.path = parsedUrl.pathname + parsedUrl.search;
      opts.timeout = opts.handshakeTimeout;
      if (opts.perMessageDeflate) {
        perMessageDeflate = new PerMessageDeflate(
          opts.perMessageDeflate !== true ? opts.perMessageDeflate : {},
          false,
          opts.maxPayload
        );
        opts.headers["Sec-WebSocket-Extensions"] = format({
          [PerMessageDeflate.extensionName]: perMessageDeflate.offer()
        });
      }
      if (protocols.length) {
        for (const protocol of protocols) {
          if (typeof protocol !== "string" || !subprotocolRegex.test(protocol) || protocolSet.has(protocol)) {
            throw new SyntaxError(
              "An invalid or duplicated subprotocol was specified"
            );
          }
          protocolSet.add(protocol);
        }
        opts.headers["Sec-WebSocket-Protocol"] = protocols.join(",");
      }
      if (opts.origin) {
        if (opts.protocolVersion < 13) {
          opts.headers["Sec-WebSocket-Origin"] = opts.origin;
        } else {
          opts.headers.Origin = opts.origin;
        }
      }
      if (parsedUrl.username || parsedUrl.password) {
        opts.auth = `${parsedUrl.username}:${parsedUrl.password}`;
      }
      if (isIpcUrl) {
        const parts = opts.path.split(":");
        opts.socketPath = parts[0];
        opts.path = parts[1];
      }
      let req;
      if (opts.followRedirects) {
        if (websocket._redirects === 0) {
          websocket._originalIpc = isIpcUrl;
          websocket._originalSecure = isSecure;
          websocket._originalHostOrSocketPath = isIpcUrl ? opts.socketPath : parsedUrl.host;
          const headers = options && options.headers;
          options = { ...options, headers: {} };
          if (headers) {
            for (const [key2, value] of Object.entries(headers)) {
              options.headers[key2.toLowerCase()] = value;
            }
          }
        } else if (websocket.listenerCount("redirect") === 0) {
          const isSameHost = isIpcUrl ? websocket._originalIpc ? opts.socketPath === websocket._originalHostOrSocketPath : false : websocket._originalIpc ? false : parsedUrl.host === websocket._originalHostOrSocketPath;
          if (!isSameHost || websocket._originalSecure && !isSecure) {
            delete opts.headers.authorization;
            delete opts.headers.cookie;
            if (!isSameHost) delete opts.headers.host;
            opts.auth = void 0;
          }
        }
        if (opts.auth && !options.headers.authorization) {
          options.headers.authorization = "Basic " + Buffer.from(opts.auth).toString("base64");
        }
        req = websocket._req = request(opts);
        if (websocket._redirects) {
          websocket.emit("redirect", websocket.url, req);
        }
      } else {
        req = websocket._req = request(opts);
      }
      if (opts.timeout) {
        req.on("timeout", () => {
          abortHandshake(websocket, req, "Opening handshake has timed out");
        });
      }
      req.on("error", (err) => {
        if (req === null || req[kAborted]) return;
        req = websocket._req = null;
        emitErrorAndClose(websocket, err);
      });
      req.on("response", (res) => {
        const location = res.headers.location;
        const statusCode = res.statusCode;
        if (location && opts.followRedirects && statusCode >= 300 && statusCode < 400) {
          if (++websocket._redirects > opts.maxRedirects) {
            abortHandshake(websocket, req, "Maximum redirects exceeded");
            return;
          }
          req.abort();
          let addr;
          try {
            addr = new URL2(location, address);
          } catch (e) {
            const err = new SyntaxError(`Invalid URL: ${location}`);
            emitErrorAndClose(websocket, err);
            return;
          }
          initAsClient(websocket, addr, protocols, options);
        } else if (!websocket.emit("unexpected-response", req, res)) {
          abortHandshake(
            websocket,
            req,
            `Unexpected server response: ${res.statusCode}`
          );
        }
      });
      req.on("upgrade", (res, socket, head) => {
        websocket.emit("upgrade", res);
        if (websocket.readyState !== WebSocket2.CONNECTING) return;
        req = websocket._req = null;
        const upgrade = res.headers.upgrade;
        if (upgrade === void 0 || upgrade.toLowerCase() !== "websocket") {
          abortHandshake(websocket, socket, "Invalid Upgrade header");
          return;
        }
        const digest = createHash2("sha1").update(key + GUID).digest("base64");
        if (res.headers["sec-websocket-accept"] !== digest) {
          abortHandshake(websocket, socket, "Invalid Sec-WebSocket-Accept header");
          return;
        }
        const serverProt = res.headers["sec-websocket-protocol"];
        let protError;
        if (serverProt !== void 0) {
          if (!protocolSet.size) {
            protError = "Server sent a subprotocol but none was requested";
          } else if (!protocolSet.has(serverProt)) {
            protError = "Server sent an invalid subprotocol";
          }
        } else if (protocolSet.size) {
          protError = "Server sent no subprotocol";
        }
        if (protError) {
          abortHandshake(websocket, socket, protError);
          return;
        }
        if (serverProt) websocket._protocol = serverProt;
        const secWebSocketExtensions = res.headers["sec-websocket-extensions"];
        if (secWebSocketExtensions !== void 0) {
          if (!perMessageDeflate) {
            const message = "Server sent a Sec-WebSocket-Extensions header but no extension was requested";
            abortHandshake(websocket, socket, message);
            return;
          }
          let extensions;
          try {
            extensions = parse(secWebSocketExtensions);
          } catch (err) {
            const message = "Invalid Sec-WebSocket-Extensions header";
            abortHandshake(websocket, socket, message);
            return;
          }
          const extensionNames = Object.keys(extensions);
          if (extensionNames.length !== 1 || extensionNames[0] !== PerMessageDeflate.extensionName) {
            const message = "Server indicated an extension that was not requested";
            abortHandshake(websocket, socket, message);
            return;
          }
          try {
            perMessageDeflate.accept(extensions[PerMessageDeflate.extensionName]);
          } catch (err) {
            const message = "Invalid Sec-WebSocket-Extensions header";
            abortHandshake(websocket, socket, message);
            return;
          }
          websocket._extensions[PerMessageDeflate.extensionName] = perMessageDeflate;
        }
        websocket.setSocket(socket, head, {
          allowSynchronousEvents: opts.allowSynchronousEvents,
          generateMask: opts.generateMask,
          maxPayload: opts.maxPayload,
          skipUTF8Validation: opts.skipUTF8Validation
        });
      });
      if (opts.finishRequest) {
        opts.finishRequest(req, websocket);
      } else {
        req.end();
      }
    }
    function emitErrorAndClose(websocket, err) {
      websocket._readyState = WebSocket2.CLOSING;
      websocket._errorEmitted = true;
      websocket.emit("error", err);
      websocket.emitClose();
    }
    function netConnect(options) {
      options.path = options.socketPath;
      return net.connect(options);
    }
    function tlsConnect(options) {
      options.path = void 0;
      if (!options.servername && options.servername !== "") {
        options.servername = net.isIP(options.host) ? "" : options.host;
      }
      return tls.connect(options);
    }
    function abortHandshake(websocket, stream, message) {
      websocket._readyState = WebSocket2.CLOSING;
      const err = new Error(message);
      Error.captureStackTrace(err, abortHandshake);
      if (stream.setHeader) {
        stream[kAborted] = true;
        stream.abort();
        if (stream.socket && !stream.socket.destroyed) {
          stream.socket.destroy();
        }
        process.nextTick(emitErrorAndClose, websocket, err);
      } else {
        stream.destroy(err);
        stream.once("error", websocket.emit.bind(websocket, "error"));
        stream.once("close", websocket.emitClose.bind(websocket));
      }
    }
    function sendAfterClose(websocket, data, cb) {
      if (data) {
        const length = isBlob(data) ? data.size : toBuffer(data).length;
        if (websocket._socket) websocket._sender._bufferedBytes += length;
        else websocket._bufferedAmount += length;
      }
      if (cb) {
        const err = new Error(
          `WebSocket is not open: readyState ${websocket.readyState} (${readyStates[websocket.readyState]})`
        );
        process.nextTick(cb, err);
      }
    }
    function receiverOnConclude(code, reason) {
      const websocket = this[kWebSocket];
      websocket._closeFrameReceived = true;
      websocket._closeMessage = reason;
      websocket._closeCode = code;
      if (websocket._socket[kWebSocket] === void 0) return;
      websocket._socket.removeListener("data", socketOnData);
      process.nextTick(resume, websocket._socket);
      if (code === 1005) websocket.close();
      else websocket.close(code, reason);
    }
    function receiverOnDrain() {
      const websocket = this[kWebSocket];
      if (!websocket.isPaused) websocket._socket.resume();
    }
    function receiverOnError(err) {
      const websocket = this[kWebSocket];
      if (websocket._socket[kWebSocket] !== void 0) {
        websocket._socket.removeListener("data", socketOnData);
        process.nextTick(resume, websocket._socket);
        websocket.close(err[kStatusCode]);
      }
      if (!websocket._errorEmitted) {
        websocket._errorEmitted = true;
        websocket.emit("error", err);
      }
    }
    function receiverOnFinish() {
      this[kWebSocket].emitClose();
    }
    function receiverOnMessage(data, isBinary) {
      this[kWebSocket].emit("message", data, isBinary);
    }
    function receiverOnPing(data) {
      const websocket = this[kWebSocket];
      if (websocket._autoPong) websocket.pong(data, !this._isServer, NOOP);
      websocket.emit("ping", data);
    }
    function receiverOnPong(data) {
      this[kWebSocket].emit("pong", data);
    }
    function resume(stream) {
      stream.resume();
    }
    function senderOnError(err) {
      const websocket = this[kWebSocket];
      if (websocket.readyState === WebSocket2.CLOSED) return;
      if (websocket.readyState === WebSocket2.OPEN) {
        websocket._readyState = WebSocket2.CLOSING;
        setCloseTimer(websocket);
      }
      this._socket.end();
      if (!websocket._errorEmitted) {
        websocket._errorEmitted = true;
        websocket.emit("error", err);
      }
    }
    function setCloseTimer(websocket) {
      websocket._closeTimer = setTimeout(
        websocket._socket.destroy.bind(websocket._socket),
        websocket._closeTimeout
      );
    }
    function socketOnClose() {
      const websocket = this[kWebSocket];
      this.removeListener("close", socketOnClose);
      this.removeListener("data", socketOnData);
      this.removeListener("end", socketOnEnd);
      websocket._readyState = WebSocket2.CLOSING;
      if (!this._readableState.endEmitted && !websocket._closeFrameReceived && !websocket._receiver._writableState.errorEmitted && this._readableState.length !== 0) {
        const chunk = this.read(this._readableState.length);
        websocket._receiver.write(chunk);
      }
      websocket._receiver.end();
      this[kWebSocket] = void 0;
      clearTimeout(websocket._closeTimer);
      if (websocket._receiver._writableState.finished || websocket._receiver._writableState.errorEmitted) {
        websocket.emitClose();
      } else {
        websocket._receiver.on("error", receiverOnFinish);
        websocket._receiver.on("finish", receiverOnFinish);
      }
    }
    function socketOnData(chunk) {
      if (!this[kWebSocket]._receiver.write(chunk)) {
        this.pause();
      }
    }
    function socketOnEnd() {
      const websocket = this[kWebSocket];
      websocket._readyState = WebSocket2.CLOSING;
      websocket._receiver.end();
      this.end();
    }
    function socketOnError() {
      const websocket = this[kWebSocket];
      this.removeListener("error", socketOnError);
      this.on("error", NOOP);
      if (websocket) {
        websocket._readyState = WebSocket2.CLOSING;
        this.destroy();
      }
    }
  }
});

// node_modules/ws/lib/stream.js
var require_stream = __commonJS({
  "node_modules/ws/lib/stream.js"(exports, module) {
    "use strict";
    var WebSocket2 = require_websocket();
    var { Duplex } = __require("stream");
    function emitClose(stream) {
      stream.emit("close");
    }
    function duplexOnEnd() {
      if (!this.destroyed && this._writableState.finished) {
        this.destroy();
      }
    }
    function duplexOnError(err) {
      this.removeListener("error", duplexOnError);
      this.destroy();
      if (this.listenerCount("error") === 0) {
        this.emit("error", err);
      }
    }
    function createWebSocketStream2(ws2, options) {
      let terminateOnDestroy = true;
      const duplex = new Duplex({
        ...options,
        autoDestroy: false,
        emitClose: false,
        objectMode: false,
        writableObjectMode: false
      });
      ws2.on("message", function message(msg, isBinary) {
        const data = !isBinary && duplex._readableState.objectMode ? msg.toString() : msg;
        if (!duplex.push(data)) ws2.pause();
      });
      ws2.once("error", function error(err) {
        if (duplex.destroyed) return;
        terminateOnDestroy = false;
        duplex.destroy(err);
      });
      ws2.once("close", function close() {
        if (duplex.destroyed) return;
        duplex.push(null);
      });
      duplex._destroy = function(err, callback) {
        if (ws2.readyState === ws2.CLOSED) {
          callback(err);
          process.nextTick(emitClose, duplex);
          return;
        }
        let called = false;
        ws2.once("error", function error(err2) {
          called = true;
          callback(err2);
        });
        ws2.once("close", function close() {
          if (!called) callback(err);
          process.nextTick(emitClose, duplex);
        });
        if (terminateOnDestroy) ws2.terminate();
      };
      duplex._final = function(callback) {
        if (ws2.readyState === ws2.CONNECTING) {
          ws2.once("open", function open() {
            duplex._final(callback);
          });
          return;
        }
        if (ws2._socket === null) return;
        if (ws2._socket._writableState.finished) {
          callback();
          if (duplex._readableState.endEmitted) duplex.destroy();
        } else {
          ws2._socket.once("finish", function finish() {
            callback();
          });
          ws2.close();
        }
      };
      duplex._read = function() {
        if (ws2.isPaused) ws2.resume();
      };
      duplex._write = function(chunk, encoding, callback) {
        if (ws2.readyState === ws2.CONNECTING) {
          ws2.once("open", function open() {
            duplex._write(chunk, encoding, callback);
          });
          return;
        }
        ws2.send(chunk, callback);
      };
      duplex.on("end", duplexOnEnd);
      duplex.on("error", duplexOnError);
      return duplex;
    }
    module.exports = createWebSocketStream2;
  }
});

// node_modules/ws/lib/subprotocol.js
var require_subprotocol = __commonJS({
  "node_modules/ws/lib/subprotocol.js"(exports, module) {
    "use strict";
    var { tokenChars } = require_validation();
    function parse(header) {
      const protocols = /* @__PURE__ */ new Set();
      let start = -1;
      let end = -1;
      let i = 0;
      for (i; i < header.length; i++) {
        const code = header.charCodeAt(i);
        if (end === -1 && tokenChars[code] === 1) {
          if (start === -1) start = i;
        } else if (i !== 0 && (code === 32 || code === 9)) {
          if (end === -1 && start !== -1) end = i;
        } else if (code === 44) {
          if (start === -1) {
            throw new SyntaxError(`Unexpected character at index ${i}`);
          }
          if (end === -1) end = i;
          const protocol2 = header.slice(start, end);
          if (protocols.has(protocol2)) {
            throw new SyntaxError(`The "${protocol2}" subprotocol is duplicated`);
          }
          protocols.add(protocol2);
          start = end = -1;
        } else {
          throw new SyntaxError(`Unexpected character at index ${i}`);
        }
      }
      if (start === -1 || end !== -1) {
        throw new SyntaxError("Unexpected end of input");
      }
      const protocol = header.slice(start, i);
      if (protocols.has(protocol)) {
        throw new SyntaxError(`The "${protocol}" subprotocol is duplicated`);
      }
      protocols.add(protocol);
      return protocols;
    }
    module.exports = { parse };
  }
});

// node_modules/ws/lib/websocket-server.js
var require_websocket_server = __commonJS({
  "node_modules/ws/lib/websocket-server.js"(exports, module) {
    "use strict";
    var EventEmitter = __require("events");
    var http2 = __require("http");
    var { Duplex } = __require("stream");
    var { createHash: createHash2 } = __require("crypto");
    var extension = require_extension();
    var PerMessageDeflate = require_permessage_deflate();
    var subprotocol = require_subprotocol();
    var WebSocket2 = require_websocket();
    var { CLOSE_TIMEOUT, GUID, kWebSocket } = require_constants();
    var keyRegex = /^[+/0-9A-Za-z]{22}==$/;
    var RUNNING = 0;
    var CLOSING = 1;
    var CLOSED = 2;
    var WebSocketServer2 = class extends EventEmitter {
      /**
       * Create a `WebSocketServer` instance.
       *
       * @param {Object} options Configuration options
       * @param {Boolean} [options.allowSynchronousEvents=true] Specifies whether
       *     any of the `'message'`, `'ping'`, and `'pong'` events can be emitted
       *     multiple times in the same tick
       * @param {Boolean} [options.autoPong=true] Specifies whether or not to
       *     automatically send a pong in response to a ping
       * @param {Number} [options.backlog=511] The maximum length of the queue of
       *     pending connections
       * @param {Boolean} [options.clientTracking=true] Specifies whether or not to
       *     track clients
       * @param {Number} [options.closeTimeout=30000] Duration in milliseconds to
       *     wait for the closing handshake to finish after `websocket.close()` is
       *     called
       * @param {Function} [options.handleProtocols] A hook to handle protocols
       * @param {String} [options.host] The hostname where to bind the server
       * @param {Number} [options.maxPayload=104857600] The maximum allowed message
       *     size
       * @param {Boolean} [options.noServer=false] Enable no server mode
       * @param {String} [options.path] Accept only connections matching this path
       * @param {(Boolean|Object)} [options.perMessageDeflate=false] Enable/disable
       *     permessage-deflate
       * @param {Number} [options.port] The port where to bind the server
       * @param {(http.Server|https.Server)} [options.server] A pre-created HTTP/S
       *     server to use
       * @param {Boolean} [options.skipUTF8Validation=false] Specifies whether or
       *     not to skip UTF-8 validation for text and close messages
       * @param {Function} [options.verifyClient] A hook to reject connections
       * @param {Function} [options.WebSocket=WebSocket] Specifies the `WebSocket`
       *     class to use. It must be the `WebSocket` class or class that extends it
       * @param {Function} [callback] A listener for the `listening` event
       */
      constructor(options, callback) {
        super();
        options = {
          allowSynchronousEvents: true,
          autoPong: true,
          maxPayload: 100 * 1024 * 1024,
          skipUTF8Validation: false,
          perMessageDeflate: false,
          handleProtocols: null,
          clientTracking: true,
          closeTimeout: CLOSE_TIMEOUT,
          verifyClient: null,
          noServer: false,
          backlog: null,
          // use default (511 as implemented in net.js)
          server: null,
          host: null,
          path: null,
          port: null,
          WebSocket: WebSocket2,
          ...options
        };
        if (options.port == null && !options.server && !options.noServer || options.port != null && (options.server || options.noServer) || options.server && options.noServer) {
          throw new TypeError(
            'One and only one of the "port", "server", or "noServer" options must be specified'
          );
        }
        if (options.port != null) {
          this._server = http2.createServer((req, res) => {
            const body = http2.STATUS_CODES[426];
            res.writeHead(426, {
              "Content-Length": body.length,
              "Content-Type": "text/plain"
            });
            res.end(body);
          });
          this._server.listen(
            options.port,
            options.host,
            options.backlog,
            callback
          );
        } else if (options.server) {
          this._server = options.server;
        }
        if (this._server) {
          const emitConnection = this.emit.bind(this, "connection");
          this._removeListeners = addListeners(this._server, {
            listening: this.emit.bind(this, "listening"),
            error: this.emit.bind(this, "error"),
            upgrade: (req, socket, head) => {
              this.handleUpgrade(req, socket, head, emitConnection);
            }
          });
        }
        if (options.perMessageDeflate === true) options.perMessageDeflate = {};
        if (options.clientTracking) {
          this.clients = /* @__PURE__ */ new Set();
          this._shouldEmitClose = false;
        }
        this.options = options;
        this._state = RUNNING;
      }
      /**
       * Returns the bound address, the address family name, and port of the server
       * as reported by the operating system if listening on an IP socket.
       * If the server is listening on a pipe or UNIX domain socket, the name is
       * returned as a string.
       *
       * @return {(Object|String|null)} The address of the server
       * @public
       */
      address() {
        if (this.options.noServer) {
          throw new Error('The server is operating in "noServer" mode');
        }
        if (!this._server) return null;
        return this._server.address();
      }
      /**
       * Stop the server from accepting new connections and emit the `'close'` event
       * when all existing connections are closed.
       *
       * @param {Function} [cb] A one-time listener for the `'close'` event
       * @public
       */
      close(cb) {
        if (this._state === CLOSED) {
          if (cb) {
            this.once("close", () => {
              cb(new Error("The server is not running"));
            });
          }
          process.nextTick(emitClose, this);
          return;
        }
        if (cb) this.once("close", cb);
        if (this._state === CLOSING) return;
        this._state = CLOSING;
        if (this.options.noServer || this.options.server) {
          if (this._server) {
            this._removeListeners();
            this._removeListeners = this._server = null;
          }
          if (this.clients) {
            if (!this.clients.size) {
              process.nextTick(emitClose, this);
            } else {
              this._shouldEmitClose = true;
            }
          } else {
            process.nextTick(emitClose, this);
          }
        } else {
          const server = this._server;
          this._removeListeners();
          this._removeListeners = this._server = null;
          server.close(() => {
            emitClose(this);
          });
        }
      }
      /**
       * See if a given request should be handled by this server instance.
       *
       * @param {http.IncomingMessage} req Request object to inspect
       * @return {Boolean} `true` if the request is valid, else `false`
       * @public
       */
      shouldHandle(req) {
        if (this.options.path) {
          const index = req.url.indexOf("?");
          const pathname = index !== -1 ? req.url.slice(0, index) : req.url;
          if (pathname !== this.options.path) return false;
        }
        return true;
      }
      /**
       * Handle a HTTP Upgrade request.
       *
       * @param {http.IncomingMessage} req The request object
       * @param {Duplex} socket The network socket between the server and client
       * @param {Buffer} head The first packet of the upgraded stream
       * @param {Function} cb Callback
       * @public
       */
      handleUpgrade(req, socket, head, cb) {
        socket.on("error", socketOnError);
        const key = req.headers["sec-websocket-key"];
        const upgrade = req.headers.upgrade;
        const version = +req.headers["sec-websocket-version"];
        if (req.method !== "GET") {
          const message = "Invalid HTTP method";
          abortHandshakeOrEmitwsClientError(this, req, socket, 405, message);
          return;
        }
        if (upgrade === void 0 || upgrade.toLowerCase() !== "websocket") {
          const message = "Invalid Upgrade header";
          abortHandshakeOrEmitwsClientError(this, req, socket, 400, message);
          return;
        }
        if (key === void 0 || !keyRegex.test(key)) {
          const message = "Missing or invalid Sec-WebSocket-Key header";
          abortHandshakeOrEmitwsClientError(this, req, socket, 400, message);
          return;
        }
        if (version !== 13 && version !== 8) {
          const message = "Missing or invalid Sec-WebSocket-Version header";
          abortHandshakeOrEmitwsClientError(this, req, socket, 400, message, {
            "Sec-WebSocket-Version": "13, 8"
          });
          return;
        }
        if (!this.shouldHandle(req)) {
          abortHandshake(socket, 400);
          return;
        }
        const secWebSocketProtocol = req.headers["sec-websocket-protocol"];
        let protocols = /* @__PURE__ */ new Set();
        if (secWebSocketProtocol !== void 0) {
          try {
            protocols = subprotocol.parse(secWebSocketProtocol);
          } catch (err) {
            const message = "Invalid Sec-WebSocket-Protocol header";
            abortHandshakeOrEmitwsClientError(this, req, socket, 400, message);
            return;
          }
        }
        const secWebSocketExtensions = req.headers["sec-websocket-extensions"];
        const extensions = {};
        if (this.options.perMessageDeflate && secWebSocketExtensions !== void 0) {
          const perMessageDeflate = new PerMessageDeflate(
            this.options.perMessageDeflate,
            true,
            this.options.maxPayload
          );
          try {
            const offers = extension.parse(secWebSocketExtensions);
            if (offers[PerMessageDeflate.extensionName]) {
              perMessageDeflate.accept(offers[PerMessageDeflate.extensionName]);
              extensions[PerMessageDeflate.extensionName] = perMessageDeflate;
            }
          } catch (err) {
            const message = "Invalid or unacceptable Sec-WebSocket-Extensions header";
            abortHandshakeOrEmitwsClientError(this, req, socket, 400, message);
            return;
          }
        }
        if (this.options.verifyClient) {
          const info = {
            origin: req.headers[`${version === 8 ? "sec-websocket-origin" : "origin"}`],
            secure: !!(req.socket.authorized || req.socket.encrypted),
            req
          };
          if (this.options.verifyClient.length === 2) {
            this.options.verifyClient(info, (verified, code, message, headers) => {
              if (!verified) {
                return abortHandshake(socket, code || 401, message, headers);
              }
              this.completeUpgrade(
                extensions,
                key,
                protocols,
                req,
                socket,
                head,
                cb
              );
            });
            return;
          }
          if (!this.options.verifyClient(info)) return abortHandshake(socket, 401);
        }
        this.completeUpgrade(extensions, key, protocols, req, socket, head, cb);
      }
      /**
       * Upgrade the connection to WebSocket.
       *
       * @param {Object} extensions The accepted extensions
       * @param {String} key The value of the `Sec-WebSocket-Key` header
       * @param {Set} protocols The subprotocols
       * @param {http.IncomingMessage} req The request object
       * @param {Duplex} socket The network socket between the server and client
       * @param {Buffer} head The first packet of the upgraded stream
       * @param {Function} cb Callback
       * @throws {Error} If called more than once with the same socket
       * @private
       */
      completeUpgrade(extensions, key, protocols, req, socket, head, cb) {
        if (!socket.readable || !socket.writable) return socket.destroy();
        if (socket[kWebSocket]) {
          throw new Error(
            "server.handleUpgrade() was called more than once with the same socket, possibly due to a misconfiguration"
          );
        }
        if (this._state > RUNNING) return abortHandshake(socket, 503);
        const digest = createHash2("sha1").update(key + GUID).digest("base64");
        const headers = [
          "HTTP/1.1 101 Switching Protocols",
          "Upgrade: websocket",
          "Connection: Upgrade",
          `Sec-WebSocket-Accept: ${digest}`
        ];
        const ws2 = new this.options.WebSocket(null, void 0, this.options);
        if (protocols.size) {
          const protocol = this.options.handleProtocols ? this.options.handleProtocols(protocols, req) : protocols.values().next().value;
          if (protocol) {
            headers.push(`Sec-WebSocket-Protocol: ${protocol}`);
            ws2._protocol = protocol;
          }
        }
        if (extensions[PerMessageDeflate.extensionName]) {
          const params = extensions[PerMessageDeflate.extensionName].params;
          const value = extension.format({
            [PerMessageDeflate.extensionName]: [params]
          });
          headers.push(`Sec-WebSocket-Extensions: ${value}`);
          ws2._extensions = extensions;
        }
        this.emit("headers", headers, req);
        socket.write(headers.concat("\r\n").join("\r\n"));
        socket.removeListener("error", socketOnError);
        ws2.setSocket(socket, head, {
          allowSynchronousEvents: this.options.allowSynchronousEvents,
          maxPayload: this.options.maxPayload,
          skipUTF8Validation: this.options.skipUTF8Validation
        });
        if (this.clients) {
          this.clients.add(ws2);
          ws2.on("close", () => {
            this.clients.delete(ws2);
            if (this._shouldEmitClose && !this.clients.size) {
              process.nextTick(emitClose, this);
            }
          });
        }
        cb(ws2, req);
      }
    };
    module.exports = WebSocketServer2;
    function addListeners(server, map) {
      for (const event of Object.keys(map)) server.on(event, map[event]);
      return function removeListeners() {
        for (const event of Object.keys(map)) {
          server.removeListener(event, map[event]);
        }
      };
    }
    function emitClose(server) {
      server._state = CLOSED;
      server.emit("close");
    }
    function socketOnError() {
      this.destroy();
    }
    function abortHandshake(socket, code, message, headers) {
      message = message || http2.STATUS_CODES[code];
      headers = {
        Connection: "close",
        "Content-Type": "text/html",
        "Content-Length": Buffer.byteLength(message),
        ...headers
      };
      socket.once("finish", socket.destroy);
      socket.end(
        `HTTP/1.1 ${code} ${http2.STATUS_CODES[code]}\r
` + Object.keys(headers).map((h) => `${h}: ${headers[h]}`).join("\r\n") + "\r\n\r\n" + message
      );
    }
    function abortHandshakeOrEmitwsClientError(server, req, socket, code, message, headers) {
      if (server.listenerCount("wsClientError")) {
        const err = new Error(message);
        Error.captureStackTrace(err, abortHandshakeOrEmitwsClientError);
        server.emit("wsClientError", err, socket, req);
      } else {
        abortHandshake(socket, code, message, headers);
      }
    }
  }
});

// node_modules/dotenv/package.json
var require_package = __commonJS({
  "node_modules/dotenv/package.json"(exports, module) {
    module.exports = {
      name: "dotenv",
      version: "16.6.1",
      description: "Loads environment variables from .env file",
      main: "lib/main.js",
      types: "lib/main.d.ts",
      exports: {
        ".": {
          types: "./lib/main.d.ts",
          require: "./lib/main.js",
          default: "./lib/main.js"
        },
        "./config": "./config.js",
        "./config.js": "./config.js",
        "./lib/env-options": "./lib/env-options.js",
        "./lib/env-options.js": "./lib/env-options.js",
        "./lib/cli-options": "./lib/cli-options.js",
        "./lib/cli-options.js": "./lib/cli-options.js",
        "./package.json": "./package.json"
      },
      scripts: {
        "dts-check": "tsc --project tests/types/tsconfig.json",
        lint: "standard",
        pretest: "npm run lint && npm run dts-check",
        test: "tap run --allow-empty-coverage --disable-coverage --timeout=60000",
        "test:coverage": "tap run --show-full-coverage --timeout=60000 --coverage-report=text --coverage-report=lcov",
        prerelease: "npm test",
        release: "standard-version"
      },
      repository: {
        type: "git",
        url: "git://github.com/motdotla/dotenv.git"
      },
      homepage: "https://github.com/motdotla/dotenv#readme",
      funding: "https://dotenvx.com",
      keywords: [
        "dotenv",
        "env",
        ".env",
        "environment",
        "variables",
        "config",
        "settings"
      ],
      readmeFilename: "README.md",
      license: "BSD-2-Clause",
      devDependencies: {
        "@types/node": "^18.11.3",
        decache: "^4.6.2",
        sinon: "^14.0.1",
        standard: "^17.0.0",
        "standard-version": "^9.5.0",
        tap: "^19.2.0",
        typescript: "^4.8.4"
      },
      engines: {
        node: ">=12"
      },
      browser: {
        fs: false
      }
    };
  }
});

// node_modules/dotenv/lib/main.js
var require_main = __commonJS({
  "node_modules/dotenv/lib/main.js"(exports, module) {
    var fs4 = __require("fs");
    var path4 = __require("path");
    var os4 = __require("os");
    var crypto2 = __require("crypto");
    var packageJson = require_package();
    var version = packageJson.version;
    var LINE = /(?:^|^)\s*(?:export\s+)?([\w.-]+)(?:\s*=\s*?|:\s+?)(\s*'(?:\\'|[^'])*'|\s*"(?:\\"|[^"])*"|\s*`(?:\\`|[^`])*`|[^#\r\n]+)?\s*(?:#.*)?(?:$|$)/mg;
    function parse(src) {
      const obj = {};
      let lines = src.toString();
      lines = lines.replace(/\r\n?/mg, "\n");
      let match;
      while ((match = LINE.exec(lines)) != null) {
        const key = match[1];
        let value = match[2] || "";
        value = value.trim();
        const maybeQuote = value[0];
        value = value.replace(/^(['"`])([\s\S]*)\1$/mg, "$2");
        if (maybeQuote === '"') {
          value = value.replace(/\\n/g, "\n");
          value = value.replace(/\\r/g, "\r");
        }
        obj[key] = value;
      }
      return obj;
    }
    function _parseVault(options) {
      options = options || {};
      const vaultPath = _vaultPath(options);
      options.path = vaultPath;
      const result = DotenvModule.configDotenv(options);
      if (!result.parsed) {
        const err = new Error(`MISSING_DATA: Cannot parse ${vaultPath} for an unknown reason`);
        err.code = "MISSING_DATA";
        throw err;
      }
      const keys = _dotenvKey(options).split(",");
      const length = keys.length;
      let decrypted;
      for (let i = 0; i < length; i++) {
        try {
          const key = keys[i].trim();
          const attrs = _instructions(result, key);
          decrypted = DotenvModule.decrypt(attrs.ciphertext, attrs.key);
          break;
        } catch (error) {
          if (i + 1 >= length) {
            throw error;
          }
        }
      }
      return DotenvModule.parse(decrypted);
    }
    function _warn(message) {
      console.log(`[dotenv@${version}][WARN] ${message}`);
    }
    function _debug(message) {
      console.log(`[dotenv@${version}][DEBUG] ${message}`);
    }
    function _log(message) {
      console.log(`[dotenv@${version}] ${message}`);
    }
    function _dotenvKey(options) {
      if (options && options.DOTENV_KEY && options.DOTENV_KEY.length > 0) {
        return options.DOTENV_KEY;
      }
      if (process.env.DOTENV_KEY && process.env.DOTENV_KEY.length > 0) {
        return process.env.DOTENV_KEY;
      }
      return "";
    }
    function _instructions(result, dotenvKey) {
      let uri;
      try {
        uri = new URL(dotenvKey);
      } catch (error) {
        if (error.code === "ERR_INVALID_URL") {
          const err = new Error("INVALID_DOTENV_KEY: Wrong format. Must be in valid uri format like dotenv://:key_1234@dotenvx.com/vault/.env.vault?environment=development");
          err.code = "INVALID_DOTENV_KEY";
          throw err;
        }
        throw error;
      }
      const key = uri.password;
      if (!key) {
        const err = new Error("INVALID_DOTENV_KEY: Missing key part");
        err.code = "INVALID_DOTENV_KEY";
        throw err;
      }
      const environment = uri.searchParams.get("environment");
      if (!environment) {
        const err = new Error("INVALID_DOTENV_KEY: Missing environment part");
        err.code = "INVALID_DOTENV_KEY";
        throw err;
      }
      const environmentKey = `DOTENV_VAULT_${environment.toUpperCase()}`;
      const ciphertext = result.parsed[environmentKey];
      if (!ciphertext) {
        const err = new Error(`NOT_FOUND_DOTENV_ENVIRONMENT: Cannot locate environment ${environmentKey} in your .env.vault file.`);
        err.code = "NOT_FOUND_DOTENV_ENVIRONMENT";
        throw err;
      }
      return { ciphertext, key };
    }
    function _vaultPath(options) {
      let possibleVaultPath = null;
      if (options && options.path && options.path.length > 0) {
        if (Array.isArray(options.path)) {
          for (const filepath of options.path) {
            if (fs4.existsSync(filepath)) {
              possibleVaultPath = filepath.endsWith(".vault") ? filepath : `${filepath}.vault`;
            }
          }
        } else {
          possibleVaultPath = options.path.endsWith(".vault") ? options.path : `${options.path}.vault`;
        }
      } else {
        possibleVaultPath = path4.resolve(process.cwd(), ".env.vault");
      }
      if (fs4.existsSync(possibleVaultPath)) {
        return possibleVaultPath;
      }
      return null;
    }
    function _resolveHome(envPath) {
      return envPath[0] === "~" ? path4.join(os4.homedir(), envPath.slice(1)) : envPath;
    }
    function _configVault(options) {
      const debug = Boolean(options && options.debug);
      const quiet = options && "quiet" in options ? options.quiet : true;
      if (debug || !quiet) {
        _log("Loading env from encrypted .env.vault");
      }
      const parsed = DotenvModule._parseVault(options);
      let processEnv = process.env;
      if (options && options.processEnv != null) {
        processEnv = options.processEnv;
      }
      DotenvModule.populate(processEnv, parsed, options);
      return { parsed };
    }
    function configDotenv(options) {
      const dotenvPath = path4.resolve(process.cwd(), ".env");
      let encoding = "utf8";
      const debug = Boolean(options && options.debug);
      const quiet = options && "quiet" in options ? options.quiet : true;
      if (options && options.encoding) {
        encoding = options.encoding;
      } else {
        if (debug) {
          _debug("No encoding is specified. UTF-8 is used by default");
        }
      }
      let optionPaths = [dotenvPath];
      if (options && options.path) {
        if (!Array.isArray(options.path)) {
          optionPaths = [_resolveHome(options.path)];
        } else {
          optionPaths = [];
          for (const filepath of options.path) {
            optionPaths.push(_resolveHome(filepath));
          }
        }
      }
      let lastError;
      const parsedAll = {};
      for (const path5 of optionPaths) {
        try {
          const parsed = DotenvModule.parse(fs4.readFileSync(path5, { encoding }));
          DotenvModule.populate(parsedAll, parsed, options);
        } catch (e) {
          if (debug) {
            _debug(`Failed to load ${path5} ${e.message}`);
          }
          lastError = e;
        }
      }
      let processEnv = process.env;
      if (options && options.processEnv != null) {
        processEnv = options.processEnv;
      }
      DotenvModule.populate(processEnv, parsedAll, options);
      if (debug || !quiet) {
        const keysCount = Object.keys(parsedAll).length;
        const shortPaths = [];
        for (const filePath of optionPaths) {
          try {
            const relative = path4.relative(process.cwd(), filePath);
            shortPaths.push(relative);
          } catch (e) {
            if (debug) {
              _debug(`Failed to load ${filePath} ${e.message}`);
            }
            lastError = e;
          }
        }
        _log(`injecting env (${keysCount}) from ${shortPaths.join(",")}`);
      }
      if (lastError) {
        return { parsed: parsedAll, error: lastError };
      } else {
        return { parsed: parsedAll };
      }
    }
    function config2(options) {
      if (_dotenvKey(options).length === 0) {
        return DotenvModule.configDotenv(options);
      }
      const vaultPath = _vaultPath(options);
      if (!vaultPath) {
        _warn(`You set DOTENV_KEY but you are missing a .env.vault file at ${vaultPath}. Did you forget to build it?`);
        return DotenvModule.configDotenv(options);
      }
      return DotenvModule._configVault(options);
    }
    function decrypt(encrypted, keyStr) {
      const key = Buffer.from(keyStr.slice(-64), "hex");
      let ciphertext = Buffer.from(encrypted, "base64");
      const nonce = ciphertext.subarray(0, 12);
      const authTag = ciphertext.subarray(-16);
      ciphertext = ciphertext.subarray(12, -16);
      try {
        const aesgcm = crypto2.createDecipheriv("aes-256-gcm", key, nonce);
        aesgcm.setAuthTag(authTag);
        return `${aesgcm.update(ciphertext)}${aesgcm.final()}`;
      } catch (error) {
        const isRange = error instanceof RangeError;
        const invalidKeyLength = error.message === "Invalid key length";
        const decryptionFailed = error.message === "Unsupported state or unable to authenticate data";
        if (isRange || invalidKeyLength) {
          const err = new Error("INVALID_DOTENV_KEY: It must be 64 characters long (or more)");
          err.code = "INVALID_DOTENV_KEY";
          throw err;
        } else if (decryptionFailed) {
          const err = new Error("DECRYPTION_FAILED: Please check your DOTENV_KEY");
          err.code = "DECRYPTION_FAILED";
          throw err;
        } else {
          throw error;
        }
      }
    }
    function populate(processEnv, parsed, options = {}) {
      const debug = Boolean(options && options.debug);
      const override = Boolean(options && options.override);
      if (typeof parsed !== "object") {
        const err = new Error("OBJECT_REQUIRED: Please check the processEnv argument being passed to populate");
        err.code = "OBJECT_REQUIRED";
        throw err;
      }
      for (const key of Object.keys(parsed)) {
        if (Object.prototype.hasOwnProperty.call(processEnv, key)) {
          if (override === true) {
            processEnv[key] = parsed[key];
          }
          if (debug) {
            if (override === true) {
              _debug(`"${key}" is already defined and WAS overwritten`);
            } else {
              _debug(`"${key}" is already defined and was NOT overwritten`);
            }
          }
        } else {
          processEnv[key] = parsed[key];
        }
      }
    }
    var DotenvModule = {
      configDotenv,
      _configVault,
      _parseVault,
      config: config2,
      decrypt,
      parse,
      populate
    };
    module.exports.configDotenv = DotenvModule.configDotenv;
    module.exports._configVault = DotenvModule._configVault;
    module.exports._parseVault = DotenvModule._parseVault;
    module.exports.config = DotenvModule.config;
    module.exports.decrypt = DotenvModule.decrypt;
    module.exports.parse = DotenvModule.parse;
    module.exports.populate = DotenvModule.populate;
    module.exports = DotenvModule;
  }
});

// scripts/qqbot-gateway.js
import { spawn, execFile } from "child_process";

// node_modules/ws/wrapper.mjs
var import_stream = __toESM(require_stream(), 1);
var import_receiver = __toESM(require_receiver(), 1);
var import_sender = __toESM(require_sender(), 1);
var import_websocket = __toESM(require_websocket(), 1);
var import_websocket_server = __toESM(require_websocket_server(), 1);
var wrapper_default = import_websocket.default;

// scripts/qqbot-gateway.js
var import_dotenv = __toESM(require_main(), 1);
import http from "http";
import * as fs3 from "fs";
import * as path3 from "path";
import * as os3 from "os";
import { fileURLToPath } from "url";

// scripts/qqbot-parser.js
var TOOL_KEYWORDS = {
  // 文件操作
  Read: ["read", "\u8BFB\u53D6", "\u67E5\u770B\u6587\u4EF6", "\u8BFB\u6587\u4EF6"],
  Write: ["write", "\u5199\u5165", "\u521B\u5EFA\u6587\u4EF6", "\u5199\u6587\u4EF6", "\u65B0\u5EFA\u6587\u4EF6"],
  Edit: ["edit", "\u7F16\u8F91", "\u4FEE\u6539", "\u66F4\u6539"],
  NotebookEdit: ["notebook", "jupyter", "\u7B14\u8BB0\u672C", "ipynb"],
  // 网络工具
  WebFetch: ["fetch", "\u83B7\u53D6\u7F51\u9875", "webfetch", "\u7F51\u9875\u83B7\u53D6", "\u6293\u53D6\u7F51\u9875"],
  WebSearch: ["search", "\u641C\u7D22", "websearch", "\u7F51\u7EDC\u641C\u7D22", "\u7F51\u4E0A\u641C\u7D22"],
  // 执行工具
  Bash: ["bash", "shell", "\u547D\u4EE4", "\u6267\u884C", "\u7EC8\u7AEF", "\u547D\u4EE4\u884C"],
  Glob: ["glob", "\u6587\u4EF6\u5339\u914D", "\u67E5\u627E\u6587\u4EF6", "\u6587\u4EF6\u641C\u7D22", "glob\u6A21\u5F0F"],
  Grep: ["grep", "\u641C\u7D22\u4EE3\u7801", "\u67E5\u627E\u5185\u5BB9", "\u5185\u5BB9\u641C\u7D22", "\u4EE3\u7801\u641C\u7D22"],
  BashOutput: ["output", "\u8F93\u51FA", "bashoutput", "\u547D\u4EE4\u8F93\u51FA"],
  KillShell: ["kill", "\u7EC8\u6B62", "killshell", "\u505C\u6B62\u8FDB\u7A0B"],
  // 任务管理
  Task: ["task", "\u4EFB\u52A1", "\u5B50\u4EE3\u7406", "agent", "\u5B50\u4EFB\u52A1"],
  TodoWrite: ["todo", "\u5F85\u529E", "\u4EFB\u52A1\u6E05\u5355", "todowrite", "\u5F85\u529E\u4E8B\u9879"],
  // 其他
  SlashCommand: ["slash", "\u547D\u4EE4", "\u659C\u6760\u547D\u4EE4", "slashcommand"],
  Skill: ["skill", "\u6280\u80FD", "skill"],
  ExitPlanMode: ["exitplan", "\u9000\u51FA\u89C4\u5212", "exitplanmode"]
};
var PERMISSION_MODE_KEYWORDS = {
  default: ["default", "\u9ED8\u8BA4\u6A21\u5F0F", "default mode"],
  acceptEdits: ["acceptEdits", "accept", "\u81EA\u52A8\u7F16\u8F91", "\u81EA\u52A8\u6279\u51C6", "\u81EA\u52A8\u6279\u51C6\u7F16\u8F91"],
  bypassPermissions: ["bypass", "skip", "\u8DF3\u8FC7\u6743\u9650", "bypassPermissions", "\u5B8C\u5168\u8DF3\u8FC7"],
  plan: ["plan", "\u89C4\u5212\u6A21\u5F0F", "\u4EC5\u89C4\u5212", "plan mode"]
};
function parseProjectName(message, projects) {
  const bracketMatch = message.match(/\[([^\]]+)\]/);
  if (bracketMatch) {
    const name = bracketMatch[1];
    if (projects[name]) {
      return { projectName: name, cwd: projects[name].path };
    }
  }
  const colonMatch = message.match(/(?:项目|project)[:：]\s*([^\s\n]+)/i);
  if (colonMatch) {
    const name = colonMatch[1];
    if (projects[name]) {
      return { projectName: name, cwd: projects[name].path };
    }
  }
  for (const [name, project] of Object.entries(projects)) {
    if (message.includes(name)) {
      return { projectName: name, cwd: project.path };
    }
  }
  return { projectName: null, cwd: null };
}
function parseToolPermissions(message) {
  const result = {
    allowedTools: [],
    disallowedTools: []
  };
  const allowedMatch = message.match(/(?:allowedTools|允许工具|allow)[:：]\s*([^\n]+)/i);
  if (allowedMatch) {
    const tools = allowedMatch[1].split(/[,，\s]+/).map((t) => t.trim()).filter(Boolean);
    for (const tool of tools) {
      const matched = matchToolKeyword(tool);
      if (matched && !result.allowedTools.includes(matched)) {
        result.allowedTools.push(matched);
      }
    }
  }
  const disallowedMatch = message.match(/(?:disallowedTools|禁用工具|disallow|禁止)[:：]\s*([^\n]+)/i);
  if (disallowedMatch) {
    const tools = disallowedMatch[1].split(/[,，\s]+/).map((t) => t.trim()).filter(Boolean);
    for (const tool of tools) {
      const matched = matchToolKeyword(tool);
      if (matched && !result.disallowedTools.includes(matched)) {
        result.disallowedTools.push(matched);
      }
    }
  }
  if (result.allowedTools.length === 0 && result.disallowedTools.length === 0) {
    for (const [toolName, keywords] of Object.entries(TOOL_KEYWORDS)) {
      for (const keyword of keywords) {
        if (message.toLowerCase().includes(keyword.toLowerCase())) {
          if (!result.allowedTools.includes(toolName)) {
            result.allowedTools.push(toolName);
          }
          break;
        }
      }
    }
  }
  return result;
}
function matchToolKeyword(input) {
  const normalized = input.trim().toLowerCase();
  for (const toolName of Object.keys(TOOL_KEYWORDS)) {
    if (normalized === toolName.toLowerCase()) {
      return toolName;
    }
  }
  for (const [toolName, keywords] of Object.entries(TOOL_KEYWORDS)) {
    for (const keyword of keywords) {
      if (normalized === keyword.toLowerCase()) {
        return toolName;
      }
    }
  }
  return null;
}
function parsePermissionMode(message) {
  const modeMatch = message.match(/(?:permission-mode|权限模式|mode)[:：]\s*([^\s\n]+)/i);
  if (modeMatch) {
    const input = modeMatch[1].toLowerCase();
    for (const [mode2, keywords] of Object.entries(PERMISSION_MODE_KEYWORDS)) {
      for (const keyword of keywords) {
        if (input === keyword.toLowerCase()) {
          return mode2;
        }
      }
    }
  }
  for (const [mode2, keywords] of Object.entries(PERMISSION_MODE_KEYWORDS)) {
    for (const keyword of keywords) {
      if (message.toLowerCase().includes(keyword.toLowerCase())) {
        return mode2;
      }
    }
  }
  return null;
}
function parseMessage(message, projects = {}, defaultProject = null) {
  const result = {
    originalMessage: message,
    projectName: null,
    cwd: null,
    allowedTools: [],
    disallowedTools: [],
    permissionMode: null,
    cleanMessage: message
  };
  const projectResult = parseProjectName(message, projects);
  if (projectResult.projectName) {
    result.projectName = projectResult.projectName;
    result.cwd = projectResult.cwd;
  } else if (defaultProject && projects[defaultProject]) {
    result.projectName = defaultProject;
    result.cwd = projects[defaultProject].path;
  }
  const toolResult = parseToolPermissions(message);
  result.allowedTools = toolResult.allowedTools;
  result.disallowedTools = toolResult.disallowedTools;
  result.permissionMode = parsePermissionMode(message);
  result.cleanMessage = message.replace(/\[[^\]]+\]\s*/g, "").replace(/(?:项目|project)[:：]\s*[^\s\n]+\s*/gi, "").replace(/(?:allowedTools|允许工具)[:：]\s*[^\n]+\s*/gi, "").replace(/(?:disallowedTools|禁用工具)[:：]\s*[^\n]+\s*/gi, "").replace(/(?:permission-mode|权限模式)[:：]\s*[^\s\n]+\s*/gi, "").trim();
  return result;
}
function buildClaudeArgs(parsed, sessionId = null) {
  const args2 = ["-p"];
  args2.push("--output-format", "stream-json");
  args2.push("--verbose");
  if (sessionId) {
    args2.push("--resume", sessionId);
  }
  if (parsed.allowedTools.length > 0) {
    args2.push("--allowedTools", parsed.allowedTools.join(","));
  }
  if (parsed.disallowedTools.length > 0) {
    args2.push("--disallowedTools", parsed.disallowedTools.join(","));
  }
  if (parsed.permissionMode) {
    args2.push("--permission-mode", parsed.permissionMode);
  }
  return args2;
}

// scripts/activation-state.js
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
var GATEWAY_DIR = path.join(os.homedir(), ".claude", "qqbot-gateway");
var ACTIVATION_STATE_FILE = path.join(GATEWAY_DIR, "activation-state.json");
var FILE_CACHE_DIR = path.join(GATEWAY_DIR, "file-cache");
var MSG_ID_TTL_MS = 60 * 60 * 1e3;
var MSG_ID_EXPIRING_THRESHOLD_MS = 10 * 60 * 1e3;
var MSG_ID_MAX_USAGE = 4;
var FILE_EXPIRY_MS = 24 * 60 * 60 * 1e3;
var REMINDER_POINTS_MINUTES = [5, 3, 1];
var stateCache = null;
function ensureDir() {
  if (!fs.existsSync(GATEWAY_DIR)) {
    fs.mkdirSync(GATEWAY_DIR, { recursive: true });
  }
  if (!fs.existsSync(FILE_CACHE_DIR)) {
    fs.mkdirSync(FILE_CACHE_DIR, { recursive: true });
  }
}
function loadActivationState() {
  if (stateCache !== null) {
    return stateCache;
  }
  try {
    if (fs.existsSync(ACTIVATION_STATE_FILE)) {
      const data = fs.readFileSync(ACTIVATION_STATE_FILE, "utf-8");
      stateCache = JSON.parse(data);
      if (!stateCache.cachedFiles) {
        stateCache.cachedFiles = {};
      }
      return stateCache;
    }
  } catch (err) {
    console.error(`[activation-state] Failed to load state: ${err.message}`);
  }
  stateCache = {
    gatewayStatus: "pending_activation",
    users: {},
    pendingMessages: [],
    cachedFiles: {},
    lastUpdatedAt: Date.now()
  };
  return stateCache;
}
function saveActivationState(state) {
  ensureDir();
  state.lastUpdatedAt = Date.now();
  stateCache = state;
  try {
    fs.writeFileSync(ACTIVATION_STATE_FILE, JSON.stringify(state, null, 2));
  } catch (err) {
    console.error(`[activation-state] Failed to save state: ${err.message}`);
  }
}
function getGatewayStatus() {
  const state = loadActivationState();
  return state.gatewayStatus;
}
function setGatewayStatus(status) {
  const state = loadActivationState();
  state.gatewayStatus = status;
  saveActivationState(state);
}
function getUserActivation(openid) {
  const state = loadActivationState();
  return state.users[openid];
}
function getUserActivationStatus(openid) {
  const user = getUserActivation(openid);
  if (!user) {
    return "expired";
  }
  const now = Date.now();
  const timeUntilExpiry = user.msgIdExpiresAt - now;
  if (timeUntilExpiry <= 0) {
    return "expired";
  } else if (timeUntilExpiry <= MSG_ID_EXPIRING_THRESHOLD_MS) {
    return "expiring_soon";
  } else {
    return "active";
  }
}
function updateUserActivation({ openid, msgId, type = "c2c", nickname }) {
  const state = loadActivationState();
  const now = Date.now();
  const existingUser = state.users[openid];
  const user = {
    openid,
    type,
    status: "active",
    lastMsgId: msgId,
    lastMsgIdAt: now,
    msgIdExpiresAt: now + MSG_ID_TTL_MS,
    msgIdUsageCount: 0,
    // 新的 msg_id，重置计数
    nickname: nickname || existingUser?.nickname,
    activatedAt: existingUser?.activatedAt || now,
    lastInteractionAt: now,
    // 提醒状态跟踪 - 记录已发送的提醒时间点
    remindersSent: {
      at5min: false,
      at3min: false,
      at1min: false
    }
  };
  state.users[openid] = user;
  if (state.gatewayStatus === "pending_activation") {
    state.gatewayStatus = "activated";
  }
  saveActivationState(state);
  return user;
}
function incrementMsgIdUsage(openid) {
  const state = loadActivationState();
  const user = state.users[openid];
  if (!user) {
    return { canUse: false, remaining: 0, shouldFallback: true };
  }
  const now = Date.now();
  if (now >= user.msgIdExpiresAt) {
    user.status = "expired";
    saveActivationState(state);
    return { canUse: false, remaining: 0, shouldFallback: true, reason: "expired" };
  }
  if (user.msgIdUsageCount >= MSG_ID_MAX_USAGE) {
    return { canUse: false, remaining: 0, shouldFallback: true, reason: "limit_exceeded" };
  }
  user.msgIdUsageCount++;
  user.lastInteractionAt = now;
  const timeUntilExpiry = user.msgIdExpiresAt - now;
  if (timeUntilExpiry <= MSG_ID_EXPIRING_THRESHOLD_MS) {
    user.status = "expiring_soon";
  }
  saveActivationState(state);
  return {
    canUse: true,
    remaining: MSG_ID_MAX_USAGE - user.msgIdUsageCount,
    shouldFallback: false,
    msgId: user.lastMsgId
  };
}
function getActiveUsers() {
  const state = loadActivationState();
  const now = Date.now();
  const users = [];
  for (const user of Object.values(state.users)) {
    if (now < user.msgIdExpiresAt) {
      users.push(user);
    }
  }
  return users;
}
function getUsersNeedingReminder() {
  const state = loadActivationState();
  const now = Date.now();
  const reminders = [];
  for (const user of Object.values(state.users)) {
    const timeUntilExpiry = user.msgIdExpiresAt - now;
    if (timeUntilExpiry <= 0) continue;
    const minutesLeft = Math.ceil(timeUntilExpiry / 6e4);
    if (!user.remindersSent) {
      user.remindersSent = { at5min: false, at3min: false, at1min: false };
    }
    for (const point of REMINDER_POINTS_MINUTES) {
      const reminderKey = `at${point}min`;
      if (minutesLeft <= point && minutesLeft > point - 1 && !user.remindersSent[reminderKey]) {
        reminders.push({ user, reminderPoint: point });
        break;
      }
    }
  }
  if (reminders.length > 0) {
    saveActivationState(state);
  }
  return reminders;
}
function markReminderSent(openid, reminderPoint) {
  const state = loadActivationState();
  const user = state.users[openid];
  if (user) {
    if (!user.remindersSent) {
      user.remindersSent = { at5min: false, at3min: false, at1min: false };
    }
    user.remindersSent[`at${reminderPoint}min`] = true;
    saveActivationState(state);
    console.log(`[activation-state] Reminder marked as sent: ${openid} at ${reminderPoint}min`);
  }
}
var MESSAGE_EXPIRY_MS = 24 * 60 * 60 * 1e3;
var COMPRESSED_RETAIN_MS = 7 * 24 * 60 * 60 * 1e3;
function addPendingMessage({ targetOpenid, content, source = "user_message", priority = 10, expiresAt, skipDuplicateCheck = false }) {
  const state = loadActivationState();
  const normalizedTarget = normalizeOpenid(targetOpenid);
  if (!skipDuplicateCheck) {
    const existingMessage = state.pendingMessages.find(
      (msg) => normalizeOpenid(msg.targetOpenid) === normalizedTarget && msg.content === content
    );
    if (existingMessage) {
      console.log(`[activation-state] Duplicate message skipped: ${content.substring(0, 50)}... -> ${targetOpenid}`);
      return { message: existingMessage, isDuplicate: true };
    }
  }
  const message = {
    id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    targetOpenid,
    content,
    source,
    createdAt: Date.now(),
    priority,
    expiresAt: expiresAt || Date.now() + MESSAGE_EXPIRY_MS
    // 默认 24 小时
  };
  state.pendingMessages.push(message);
  saveActivationState(state);
  console.log(`[activation-state] Pending message added: ${message.id} -> ${targetOpenid}`);
  return { message, isDuplicate: false };
}
function getExpiredMessages(openid) {
  const state = loadActivationState();
  const now = Date.now();
  return state.pendingMessages.filter((msg) => {
    const isExpired = msg.expiresAt ? now >= msg.expiresAt : now - msg.createdAt >= MESSAGE_EXPIRY_MS;
    const matchesUser = openid ? msg.targetOpenid === openid : true;
    return isExpired && matchesUser;
  });
}
function getCompressibleMessages(openid) {
  const state = loadActivationState();
  const now = Date.now();
  return state.pendingMessages.filter((msg) => {
    const isExpired = msg.expiresAt ? now >= msg.expiresAt : now - msg.createdAt >= MESSAGE_EXPIRY_MS;
    const withinRetainPeriod = now - msg.createdAt < COMPRESSED_RETAIN_MS;
    const matchesUser = openid ? msg.targetOpenid === openid : true;
    return isExpired && withinRetainPeriod && matchesUser;
  });
}
function replacePendingMessages(openid, newMessages) {
  const state = loadActivationState();
  const before = state.pendingMessages.filter((msg) => msg.targetOpenid === openid).length;
  state.pendingMessages = state.pendingMessages.filter((msg) => msg.targetOpenid !== openid);
  for (const msg of newMessages) {
    state.pendingMessages.push(msg);
  }
  const after = state.pendingMessages.filter((msg) => msg.targetOpenid === openid).length;
  saveActivationState(state);
  console.log(`[activation-state] Replaced ${before} -> ${after} messages for ${openid}`);
}
function clearExpiredMessages(openid) {
  const state = loadActivationState();
  const now = Date.now();
  const before = state.pendingMessages.length;
  state.pendingMessages = state.pendingMessages.filter((msg) => {
    const isExpired = msg.expiresAt ? now >= msg.expiresAt : now - msg.createdAt >= MESSAGE_EXPIRY_MS;
    return !isExpired;
  });
  const after = state.pendingMessages.length;
  if (before !== after) {
    saveActivationState(state);
    console.log(`[activation-state] Cleared ${before - after} expired messages for ${openid || "all users"}`);
  }
  return before - after;
}
function normalizeOpenid(openid) {
  if (!openid) return openid;
  return openid.startsWith("U_") ? openid.substring(2) : openid;
}
function getPendingMessages(openid) {
  const state = loadActivationState();
  const normalizedOpenid = normalizeOpenid(openid);
  return state.pendingMessages.filter((msg) => normalizeOpenid(msg.targetOpenid) === normalizedOpenid).sort((a, b) => a.priority - b.priority);
}
function removePendingMessage(messageId) {
  const state = loadActivationState();
  const index = state.pendingMessages.findIndex((msg) => msg.id === messageId);
  if (index !== -1) {
    state.pendingMessages.splice(index, 1);
    saveActivationState(state);
    console.log(`[activation-state] Pending message removed: ${messageId}`);
  }
}
function getPendingMessageCount(openid) {
  const state = loadActivationState();
  if (openid) {
    const normalizedOpenid = normalizeOpenid(openid);
    return state.pendingMessages.filter((msg) => normalizeOpenid(msg.targetOpenid) === normalizedOpenid).length;
  }
  return state.pendingMessages.length;
}
function cleanupExpiredUsers() {
  const state = loadActivationState();
  const now = Date.now();
  let cleaned = 0;
  for (const [openid, user] of Object.entries(state.users)) {
    if (now >= user.msgIdExpiresAt) {
      delete state.users[openid];
      cleaned++;
    }
  }
  if (cleaned > 0) {
    saveActivationState(state);
    console.log(`[activation-state] Cleaned up ${cleaned} expired users`);
  }
  return cleaned;
}
function getActivationStats() {
  const state = loadActivationState();
  const now = Date.now();
  let activeCount = 0;
  let expiringCount = 0;
  let expiredCount = 0;
  for (const user of Object.values(state.users)) {
    const timeUntilExpiry = user.msgIdExpiresAt - now;
    if (timeUntilExpiry <= 0) {
      expiredCount++;
    } else if (timeUntilExpiry <= MSG_ID_EXPIRING_THRESHOLD_MS) {
      expiringCount++;
    } else {
      activeCount++;
    }
  }
  return {
    gatewayStatus: state.gatewayStatus,
    totalUsers: Object.keys(state.users).length,
    activeUsers: activeCount,
    expiringUsers: expiringCount,
    expiredUsers: expiredCount,
    pendingMessages: state.pendingMessages.length,
    cachedFiles: Object.keys(state.cachedFiles || {}).length
  };
}
function removeCachedFile(fileId) {
  const state = loadActivationState();
  const fileInfo = state.cachedFiles[fileId];
  if (!fileInfo) {
    return false;
  }
  const fullPath = path.join(FILE_CACHE_DIR, fileInfo.filepath);
  try {
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
  } catch (err) {
    console.error(`[activation-state] Failed to delete file ${fileId}: ${err.message}`);
  }
  delete state.cachedFiles[fileId];
  saveActivationState(state);
  console.log(`[activation-state] File removed: ${fileId}`);
  return true;
}
function getExpiredFiles(openid) {
  const state = loadActivationState();
  const now = Date.now();
  const files = [];
  for (const file of Object.values(state.cachedFiles)) {
    const isExpired = now >= file.expiresAt;
    const matchesUser = openid ? file.openid === openid : true;
    if (isExpired && matchesUser) {
      files.push(file);
    }
  }
  return files;
}
function cleanupExpiredFiles(openid) {
  const expiredFiles = getExpiredFiles(openid);
  let cleaned = 0;
  for (const file of expiredFiles) {
    if (removeCachedFile(file.fileId)) {
      cleaned++;
    }
  }
  if (cleaned > 0) {
    console.log(`[activation-state] Cleaned up ${cleaned} expired files`);
  }
  return cleaned;
}
var MESSAGE_HISTORY_MAX = 100;
var MESSAGE_HISTORY_EXPIRY_MS = 24 * 60 * 60 * 1e3;
function saveMessageHistory({ msgId, openid, content, role }) {
  const state = loadActivationState();
  if (!state.messageHistory) {
    state.messageHistory = {};
  }
  state.messageHistory[msgId] = {
    msgId,
    openid,
    content,
    role,
    createdAt: Date.now(),
    expiresAt: Date.now() + MESSAGE_HISTORY_EXPIRY_MS
  };
  const msgIds = Object.keys(state.messageHistory);
  if (msgIds.length > MESSAGE_HISTORY_MAX) {
    const sortedIds = msgIds.sort(
      (a, b) => state.messageHistory[a].createdAt - state.messageHistory[b].createdAt
    );
    const toDelete = sortedIds.slice(0, msgIds.length - MESSAGE_HISTORY_MAX);
    for (const id of toDelete) {
      delete state.messageHistory[id];
    }
  }
  const now = Date.now();
  for (const id of Object.keys(state.messageHistory)) {
    if (state.messageHistory[id].expiresAt < now) {
      delete state.messageHistory[id];
    }
  }
  saveActivationState(state);
}
function getReferencedMessage(msgId) {
  const state = loadActivationState();
  if (!state.messageHistory || !state.messageHistory[msgId]) {
    return null;
  }
  const msg = state.messageHistory[msgId];
  if (msg.expiresAt < Date.now()) {
    delete state.messageHistory[msgId];
    saveActivationState(state);
    return null;
  }
  return msg;
}
function buildContextWithReference(currentContent, referencedMsgId) {
  const referencedMsg = getReferencedMessage(referencedMsgId);
  if (!referencedMsg) {
    return currentContent;
  }
  const roleText = referencedMsg.role === "user" ? "\u7528\u6237" : "\u52A9\u624B";
  const time = new Date(referencedMsg.createdAt).toLocaleTimeString("zh-CN");
  return `[\u5F15\u7528\u6D88\u606F] ${time} | ${roleText}:
${referencedMsg.content}

---

[\u5F53\u524D\u56DE\u590D]
${currentContent}`;
}

// scripts/authorization-state.js
import * as fs2 from "fs";
import * as path2 from "path";
import * as os2 from "os";
var GATEWAY_DIR2 = path2.join(os2.homedir(), ".claude", "qqbot-gateway");
var AUTHORIZATION_STATE_FILE = path2.join(GATEWAY_DIR2, "authorization-state.json");
var DEFAULT_AUTH_TIMEOUT_HOURS = 24;
var DEFAULT_REMINDER_HOURS = 1;
var NEVER_EXPIRE = 0;
var stateCache2 = null;
function ensureDir2() {
  if (!fs2.existsSync(GATEWAY_DIR2)) {
    fs2.mkdirSync(GATEWAY_DIR2, { recursive: true });
  }
}
function getDefaultGlobalConfig() {
  return {
    defaultAuthTimeoutHours: DEFAULT_AUTH_TIMEOUT_HOURS,
    defaultReminderHours: DEFAULT_REMINDER_HOURS,
    enableExpiryReminder: true
  };
}
function loadAuthorizationState() {
  if (stateCache2 !== null) {
    return stateCache2;
  }
  try {
    if (fs2.existsSync(AUTHORIZATION_STATE_FILE)) {
      const data = fs2.readFileSync(AUTHORIZATION_STATE_FILE, "utf-8");
      const parsed = JSON.parse(data);
      if (!parsed.globalConfig) {
        parsed.globalConfig = getDefaultGlobalConfig();
      }
      stateCache2 = parsed;
      return stateCache2;
    }
  } catch (err) {
    console.error(`[authorization-state] Failed to load state: ${err.message}`);
  }
  stateCache2 = {
    users: {},
    globalConfig: getDefaultGlobalConfig(),
    lastUpdatedAt: Date.now()
  };
  return stateCache2;
}
function saveAuthorizationState(state) {
  ensureDir2();
  state.lastUpdatedAt = Date.now();
  stateCache2 = state;
  try {
    fs2.writeFileSync(AUTHORIZATION_STATE_FILE, JSON.stringify(state, null, 2));
  } catch (err) {
    console.error(`[authorization-state] Failed to save state: ${err.message}`);
  }
}
function getUserAuthorization(openid) {
  const state = loadAuthorizationState();
  return state.users[openid];
}
function getUserTimeoutSettings(openid) {
  const state = loadAuthorizationState();
  const userAuth = state.users[openid];
  return {
    authTimeoutHours: userAuth?.timeoutSettings?.authTimeoutHours ?? state.globalConfig.defaultAuthTimeoutHours,
    reminderHours: userAuth?.timeoutSettings?.reminderHours ?? state.globalConfig.defaultReminderHours
  };
}
function setUserTimeoutSettings(openid, settings) {
  const state = loadAuthorizationState();
  let userAuth = state.users[openid];
  if (!userAuth) {
    userAuth = {
      openid,
      authorizedAt: Date.now(),
      lastAuthorizedAt: Date.now(),
      authorizations: {
        mcpTools: [],
        filePaths: [],
        networkDomains: []
      },
      headlessConfig: getDefaultHeadlessConfig()
    };
    state.users[openid] = userAuth;
  }
  userAuth.timeoutSettings = {
    ...userAuth.timeoutSettings,
    ...settings
  };
  saveAuthorizationState(state);
  console.log(`[authorization-state] User ${openid} timeout settings updated:`, userAuth.timeoutSettings);
  return getUserTimeoutSettings(openid);
}
function getGlobalTimeoutConfig() {
  const state = loadAuthorizationState();
  return state.globalConfig;
}
function authorizeUser({ openid, authType, resource, nickname, timeoutHours }) {
  const state = loadAuthorizationState();
  const now = Date.now();
  const effectiveTimeout = timeoutHours ?? getUserTimeoutSettings(openid).authTimeoutHours;
  const expiresAt = effectiveTimeout > 0 ? now + effectiveTimeout * 60 * 60 * 1e3 : NEVER_EXPIRE;
  let userAuth = state.users[openid];
  if (!userAuth) {
    userAuth = {
      openid,
      authorizedAt: now,
      lastAuthorizedAt: now,
      nickname,
      authorizations: {
        mcpTools: [],
        filePaths: [],
        networkDomains: []
      },
      headlessConfig: getDefaultHeadlessConfig()
    };
    state.users[openid] = userAuth;
  }
  if (nickname && !userAuth.nickname) {
    userAuth.nickname = nickname;
  }
  const authList = userAuth.authorizations[authType] || [];
  const existingIndex = authList.findIndex((item) => {
    const res = typeof item === "string" ? item : item.resource;
    return res === resource;
  });
  const newEntry = {
    resource,
    authorizedAt: now,
    expiresAt
  };
  if (existingIndex !== -1) {
    authList[existingIndex] = newEntry;
  } else {
    authList.push(newEntry);
  }
  userAuth.authorizations[authType] = authList;
  userAuth.lastAuthorizedAt = now;
  saveAuthorizationState(state);
  console.log(`[authorization-state] User ${openid} authorized: ${authType}/${resource}, expiresAt: ${expiresAt === NEVER_EXPIRE ? "never" : new Date(expiresAt).toLocaleString("zh-CN")}`);
  return {
    userAuth,
    expiresAt,
    timeoutHours: effectiveTimeout
  };
}
function getDefaultHeadlessConfig() {
  return {
    model: "claude-sonnet-4-6",
    maxTokens: 4096,
    systemPrompt: null,
    allowedTools: ["Read", "Grep", "Glob", "Bash"]
  };
}
function getOrSetHeadlessConfig(openid, config2) {
  const state = loadAuthorizationState();
  const now = Date.now();
  let userAuth = state.users[openid];
  if (!userAuth) {
    userAuth = {
      openid,
      authorizedAt: now,
      lastAuthorizedAt: now,
      authorizations: {
        mcpTools: [],
        filePaths: [],
        networkDomains: []
      },
      headlessConfig: getDefaultHeadlessConfig()
    };
    state.users[openid] = userAuth;
    saveAuthorizationState(state);
    return userAuth.headlessConfig;
  }
  if (config2) {
    userAuth.headlessConfig = {
      ...userAuth.headlessConfig,
      ...config2
    };
    saveAuthorizationState(state);
    console.log(`[authorization-state] User ${openid} headless config updated`);
  }
  return userAuth.headlessConfig;
}
function resetHeadlessConfig(openid) {
  return getOrSetHeadlessConfig(openid, getDefaultHeadlessConfig());
}
function getAuthorizationStats() {
  const state = loadAuthorizationState();
  const users = Object.values(state.users);
  const now = Date.now();
  let totalMcpAuthorizations = 0;
  let totalFileAuthorizations = 0;
  let totalNetworkAuthorizations = 0;
  let expiredAuthorizations = 0;
  let expiringSoonAuthorizations = 0;
  for (const user of users) {
    for (const authType of ["mcpTools", "filePaths", "networkDomains"]) {
      const authList = user.authorizations?.[authType] || [];
      for (const item of authList) {
        if (typeof item === "object" && item.expiresAt !== void 0) {
          if (item.expiresAt !== NEVER_EXPIRE) {
            if (now >= item.expiresAt) {
              expiredAuthorizations++;
            } else {
              const hoursUntilExpiry = (item.expiresAt - now) / (60 * 60 * 1e3);
              if (hoursUntilExpiry <= 1) {
                expiringSoonAuthorizations++;
              }
            }
          }
        }
        if (authType === "mcpTools") totalMcpAuthorizations++;
        else if (authType === "filePaths") totalFileAuthorizations++;
        else if (authType === "networkDomains") totalNetworkAuthorizations++;
      }
    }
  }
  return {
    totalUsers: users.length,
    totalMcpAuthorizations,
    totalFileAuthorizations,
    totalNetworkAuthorizations,
    expiredAuthorizations,
    expiringSoonAuthorizations,
    lastUpdatedAt: state.lastUpdatedAt,
    globalConfig: state.globalConfig
  };
}
function getExpiringAuthorizations(withinHours = 1) {
  const state = loadAuthorizationState();
  const now = Date.now();
  const checkUntil = now + withinHours * 60 * 60 * 1e3;
  const results = [];
  for (const [openid, userAuth] of Object.entries(state.users)) {
    if (!userAuth.authorizations) continue;
    for (const authType of ["mcpTools", "filePaths", "networkDomains"]) {
      const authList = userAuth.authorizations[authType] || [];
      for (const item of authList) {
        if (typeof item !== "object" || item.expiresAt === void 0 || item.expiresAt === NEVER_EXPIRE) {
          continue;
        }
        if (item.expiresAt <= checkUntil) {
          results.push({
            openid,
            nickname: userAuth.nickname,
            authType,
            resource: item.resource,
            expiresAt: item.expiresAt,
            status: now >= item.expiresAt ? "expired" : "expiring_soon"
          });
        }
      }
    }
  }
  return results;
}
function cleanupExpiredAuthorizations() {
  const state = loadAuthorizationState();
  const now = Date.now();
  let cleaned = 0;
  for (const [openid, userAuth] of Object.entries(state.users)) {
    if (!userAuth.authorizations) continue;
    for (const authType of ["mcpTools", "filePaths", "networkDomains"]) {
      const authList = userAuth.authorizations[authType] || [];
      const validEntries = authList.filter((item) => {
        if (typeof item === "string") return true;
        if (item.expiresAt === NEVER_EXPIRE) return true;
        return now < item.expiresAt;
      });
      const removedCount = authList.length - validEntries.length;
      if (removedCount > 0) {
        userAuth.authorizations[authType] = validEntries;
        cleaned += removedCount;
      }
    }
  }
  if (cleaned > 0) {
    saveAuthorizationState(state);
    console.log(`[authorization-state] Cleaned up ${cleaned} expired authorizations`);
  }
  return cleaned;
}

// dist/src/api.js
import { createRequire } from "module";
import * as crypto from "node:crypto";
var require2 = createRequire(import.meta.url);
var cache = /* @__PURE__ */ new Map();
var MAX_CACHE_SIZE = 500;
function computeFileHash(data) {
  const content = typeof data === "string" ? data : data;
  return crypto.createHash("md5").update(content).digest("hex");
}
function buildCacheKey(contentHash, scope, targetId, fileType) {
  return `${contentHash}:${scope}:${targetId}:${fileType}`;
}
function getCachedFileInfo(contentHash, scope, targetId, fileType) {
  const key = buildCacheKey(contentHash, scope, targetId, fileType);
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() >= entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  console.log(`[upload-cache] Cache HIT: key=${key.slice(0, 40)}..., fileUuid=${entry.fileUuid}`);
  return entry.fileInfo;
}
function setCachedFileInfo(contentHash, scope, targetId, fileType, fileInfo, fileUuid, ttl) {
  if (cache.size >= MAX_CACHE_SIZE) {
    const now = Date.now();
    for (const [k, v] of cache) {
      if (now >= v.expiresAt) {
        cache.delete(k);
      }
    }
    if (cache.size >= MAX_CACHE_SIZE) {
      const keys = Array.from(cache.keys());
      for (let i = 0; i < keys.length / 2; i++) {
        cache.delete(keys[i]);
      }
    }
  }
  const key = buildCacheKey(contentHash, scope, targetId, fileType);
  const safetyMargin = 60;
  const effectiveTtl = Math.max(ttl - safetyMargin, 10);
  cache.set(key, {
    fileInfo,
    fileUuid,
    expiresAt: Date.now() + effectiveTtl * 1e3
  });
  console.log(`[upload-cache] Cache SET: key=${key.slice(0, 40)}..., ttl=${effectiveTtl}s, uuid=${fileUuid}`);
}
function sanitizeFileName(name) {
  if (!name) return name;
  let result = name.trim();
  if (result.includes("%")) {
    try {
      result = decodeURIComponent(result);
    } catch {
    }
  }
  result = result.normalize("NFC");
  result = result.replace(/[\x00-\x1F\x7F]/g, "");
  return result;
}
var API_BASE = "https://api.sgroup.qq.com";
var TOKEN_URL = "https://bots.qq.com/app/getAppAccessToken";
var currentMarkdownSupport = false;
var tokenCacheMap = /* @__PURE__ */ new Map();
var tokenFetchPromises = /* @__PURE__ */ new Map();
async function getAccessToken(appId, clientSecret) {
  const cachedToken = tokenCacheMap.get(appId);
  if (cachedToken && Date.now() < cachedToken.expiresAt - 5 * 60 * 1e3) {
    return cachedToken.token;
  }
  let fetchPromise = tokenFetchPromises.get(appId);
  if (fetchPromise) {
    console.error(`[qqbot-api:${appId}] Token fetch in progress, waiting for existing request...`);
    return fetchPromise;
  }
  fetchPromise = (async () => {
    try {
      return await doFetchToken(appId, clientSecret);
    } finally {
      tokenFetchPromises.delete(appId);
    }
  })();
  tokenFetchPromises.set(appId, fetchPromise);
  return fetchPromise;
}
async function doFetchToken(appId, clientSecret) {
  const requestBody = { appId, clientSecret };
  const requestHeaders = { "Content-Type": "application/json" };
  console.error(`[qqbot-api:${appId}] >>> POST ${TOKEN_URL}`);
  let response;
  try {
    response = await fetch(TOKEN_URL, {
      method: "POST",
      headers: requestHeaders,
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(3e4)
      // 30 秒超时
    });
  } catch (err) {
    console.error(`[qqbot-api:${appId}] <<< Network error:`, err);
    throw new Error(`Network error getting access_token: ${err instanceof Error ? err.message : String(err)}`);
  }
  const responseHeaders = {};
  response.headers.forEach((value, key) => {
    responseHeaders[key] = value;
  });
  console.error(`[qqbot-api:${appId}] <<< Status: ${response.status} ${response.statusText}`);
  let data;
  let rawBody;
  try {
    rawBody = await response.text();
    const logBody = rawBody.replace(/"access_token"\s*:\s*"[^"]+"/g, '"access_token": "***"');
    console.error(`[qqbot-api:${appId}] <<< Body:`, logBody);
    data = JSON.parse(rawBody);
  } catch (err) {
    console.error(`[qqbot-api:${appId}] <<< Parse error:`, err);
    throw new Error(`Failed to parse access_token response: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (!data.access_token) {
    throw new Error(`Failed to get access_token: ${JSON.stringify(data)}`);
  }
  const expiresAt = Date.now() + (data.expires_in ?? 7200) * 1e3;
  tokenCacheMap.set(appId, {
    token: data.access_token,
    expiresAt,
    appId
  });
  console.error(`[qqbot-api:${appId}] Token cached, expires at: ${new Date(expiresAt).toISOString()}`);
  return data.access_token;
}
function getNextMsgSeq(_msgId) {
  const timePart = Date.now() % 1e8;
  const random = Math.floor(Math.random() * 65536);
  return (timePart ^ random) % 65536;
}
var DEFAULT_API_TIMEOUT = 3e4;
var FILE_UPLOAD_TIMEOUT = 12e4;
async function apiRequest(accessToken2, method, path4, body, timeoutMs) {
  const url = `${API_BASE}${path4}`;
  const headers = {
    Authorization: `QQBot ${accessToken2}`,
    "Content-Type": "application/json"
  };
  const isFileUpload = path4.includes("/files");
  const timeout = timeoutMs ?? (isFileUpload ? FILE_UPLOAD_TIMEOUT : DEFAULT_API_TIMEOUT);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeout);
  const options = {
    method,
    headers,
    signal: controller.signal
  };
  if (body) {
    options.body = JSON.stringify(body);
  }
  console.error(`[qqbot-api] >>> ${method} ${url} (timeout: ${timeout}ms)`);
  if (body) {
    const logBody = { ...body };
    if (typeof logBody.file_data === "string") {
      logBody.file_data = `<base64 ${logBody.file_data.length} chars>`;
    }
  }
  let res;
  try {
    res = await fetch(url, options);
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === "AbortError") {
      console.error(`[qqbot-api] <<< Request timeout after ${timeout}ms`);
      throw new Error(`Request timeout[${path4}]: exceeded ${timeout}ms`);
    }
    console.error(`[qqbot-api] <<< Network error:`, err);
    throw new Error(`Network error [${path4}]: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    clearTimeout(timeoutId);
  }
  const responseHeaders = {};
  res.headers.forEach((value, key) => {
    responseHeaders[key] = value;
  });
  console.error(`[qqbot-api] <<< Status: ${res.status} ${res.statusText}`);
  let data;
  let rawBody;
  try {
    rawBody = await res.text();
    data = JSON.parse(rawBody);
  } catch (err) {
    throw new Error(`Failed to parse response[${path4}]: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (!res.ok) {
    const error = data;
    throw new Error(`API Error [${path4}]: ${error.message ?? JSON.stringify(data)}`);
  }
  return data;
}
var UPLOAD_MAX_RETRIES = 2;
var UPLOAD_BASE_DELAY_MS = 1e3;
async function apiRequestWithRetry(accessToken2, method, path4, body, maxRetries = UPLOAD_MAX_RETRIES) {
  let lastError = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await apiRequest(accessToken2, method, path4, body);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      const errMsg = lastError.message;
      if (errMsg.includes("400") || errMsg.includes("401") || errMsg.includes("Invalid") || errMsg.includes("\u4E0A\u4F20\u8D85\u65F6") || errMsg.includes("timeout") || errMsg.includes("Timeout")) {
        throw lastError;
      }
      if (attempt < maxRetries) {
        const delay = UPLOAD_BASE_DELAY_MS * Math.pow(2, attempt);
        console.error(`[qqbot-api] Upload attempt ${attempt + 1} failed, retrying in ${delay}ms: ${errMsg.slice(0, 100)}`);
        await new Promise((resolve2) => setTimeout(resolve2, delay));
      }
    }
  }
  throw lastError;
}
async function getGatewayUrl(accessToken2) {
  const data = await apiRequest(accessToken2, "GET", "/gateway");
  return data.url;
}
function buildMessageBody(content, msgId, msgSeq) {
  const body = currentMarkdownSupport ? {
    markdown: { content },
    msg_type: 2,
    msg_seq: msgSeq
  } : {
    content,
    msg_type: 0,
    msg_seq: msgSeq
  };
  if (msgId) {
    body.msg_id = msgId;
  }
  return body;
}
async function sendC2CMessage(accessToken2, openid, content, msgId) {
  const msgSeq = msgId ? getNextMsgSeq(msgId) : 1;
  const body = buildMessageBody(content, msgId, msgSeq);
  return apiRequest(accessToken2, "POST", `/v2/users/${openid}/messages`, body);
}
function buildProactiveMessageBody(content) {
  if (!content || content.trim().length === 0) {
    throw new Error("\u4E3B\u52A8\u6D88\u606F\u5185\u5BB9\u4E0D\u80FD\u4E3A\u7A7A (markdown.content is empty)");
  }
  if (currentMarkdownSupport) {
    return { markdown: { content }, msg_type: 2 };
  } else {
    return { content, msg_type: 0 };
  }
}
async function sendProactiveC2CMessage(accessToken2, openid, content) {
  const body = buildProactiveMessageBody(content);
  return apiRequest(accessToken2, "POST", `/v2/users/${openid}/messages`, body);
}
async function uploadC2CMedia(accessToken2, openid, fileType, url, fileData, srvSendMsg = false, fileName) {
  if (!url && !fileData) throw new Error("uploadC2CMedia: url or fileData is required");
  if (fileData) {
    const contentHash = computeFileHash(fileData);
    const cachedInfo = getCachedFileInfo(contentHash, "c2c", openid, fileType);
    if (cachedInfo) {
      return { file_uuid: "", file_info: cachedInfo, ttl: 0 };
    }
  }
  const body = { file_type: fileType, srv_send_msg: srvSendMsg };
  if (url) body.url = url;
  else if (fileData) body.file_data = fileData;
  if (fileType === 4 && fileName) body.file_name = sanitizeFileName(fileName);
  const result = await apiRequestWithRetry(
    accessToken2,
    "POST",
    `/v2/users/${openid}/files`,
    body
  );
  if (fileData && result.file_info && result.ttl > 0) {
    const contentHash = computeFileHash(fileData);
    setCachedFileInfo(contentHash, "c2c", openid, fileType, result.file_info, result.file_uuid, result.ttl);
  }
  return result;
}
async function sendC2CMediaMessage(accessToken2, openid, fileInfo, msgId, content) {
  const msgSeq = msgId ? getNextMsgSeq(msgId) : 1;
  return apiRequest(accessToken2, "POST", `/v2/users/${openid}/messages`, {
    msg_type: 7,
    media: { file_info: fileInfo },
    msg_seq: msgSeq,
    ...content ? { content } : {},
    ...msgId ? { msg_id: msgId } : {}
  });
}
async function sendC2CImageMessage(accessToken2, openid, imageUrl, msgId, content) {
  let uploadResult;
  if (imageUrl.startsWith("data:")) {
    const matches = imageUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!matches) throw new Error("Invalid Base64 Data URL format");
    uploadResult = await uploadC2CMedia(accessToken2, openid, 1, void 0, matches[2], false);
  } else {
    uploadResult = await uploadC2CMedia(accessToken2, openid, 1, imageUrl, void 0, false);
  }
  return sendC2CMediaMessage(accessToken2, openid, uploadResult.file_info, msgId, content);
}
async function sendC2CFileMessage(accessToken2, openid, fileBase64, fileUrl, msgId, fileName) {
  const uploadResult = await uploadC2CMedia(accessToken2, openid, 4, fileUrl, fileBase64, false, fileName);
  return sendC2CMediaMessage(accessToken2, openid, uploadResult.file_info, msgId);
}

// scripts/qqbot-gateway.js
var __dirname = path3.dirname(fileURLToPath(import.meta.url));
var GATEWAY_DIR3 = path3.join(os3.homedir(), ".claude", "qqbot-gateway");
var PROJECTS_FILE = path3.join(GATEWAY_DIR3, "projects.json");
var SESSIONS_DIR = path3.join(GATEWAY_DIR3, "sessions");
var PID_FILE = path3.join(GATEWAY_DIR3, "gateway.pid");
var LOG_FILE = path3.join(GATEWAY_DIR3, "gateway.log");
var GATEWAY_STATE_FILE = path3.join(GATEWAY_DIR3, "gateway-state.json");
var HOOK_BATCH_CONFIG_FILE = path3.join(GATEWAY_DIR3, "hook-batch-config.json");
[GATEWAY_DIR3, SESSIONS_DIR].forEach((dir) => {
  if (!fs3.existsSync(dir)) {
    fs3.mkdirSync(dir, { recursive: true });
  }
});
var localEnvPath = path3.join(__dirname, "..", ".env");
if (fs3.existsSync(localEnvPath)) {
  (0, import_dotenv.config)({ path: localEnvPath });
}
var DEFAULT_GATEWAY_STATE = {
  version: "2.0.0",
  runtime: {
    mode: null,
    pid: null,
    startedAt: null
  },
  channel: {
    enabled: false,
    mode: null
  },
  hookNotify: {
    enabled: true,
    // 默认开启 Hook 推送
    updatedAt: null
  }
};
function loadGatewayState() {
  try {
    if (fs3.existsSync(GATEWAY_STATE_FILE)) {
      const content = fs3.readFileSync(GATEWAY_STATE_FILE, "utf-8");
      const state = JSON.parse(content);
      return {
        ...DEFAULT_GATEWAY_STATE,
        ...state,
        hookNotify: {
          ...DEFAULT_GATEWAY_STATE.hookNotify,
          ...state.hookNotify || {}
        }
      };
    }
  } catch (err) {
    log("yellow", `   \u26A0\uFE0F \u52A0\u8F7D\u7F51\u5173\u72B6\u6001\u5931\u8D25: ${err.message}`);
  }
  return { ...DEFAULT_GATEWAY_STATE };
}
function saveGatewayState(state) {
  try {
    fs3.writeFileSync(GATEWAY_STATE_FILE, JSON.stringify(state, null, 2));
  } catch (err) {
    log("red", `   \u274C \u4FDD\u5B58\u7F51\u5173\u72B6\u6001\u5931\u8D25: ${err.message}`);
  }
}
function getHookNotifyEnabled() {
  const state = loadGatewayState();
  return state.hookNotify.enabled !== false;
}
function setHookNotifyEnabled(enabled) {
  const state = loadGatewayState();
  state.hookNotify.enabled = enabled;
  state.hookNotify.updatedAt = Date.now();
  saveGatewayState(state);
  log("cyan", `   \u{1F4EC} Hook \u63A8\u9001\u5DF2${enabled ? "\u5F00\u542F" : "\u5173\u95ED"}`);
}
function classifyHeadlessError(code, stderr, stdout) {
  if (code === null || code === 137) {
    return {
      type: "timeout",
      reason: "\u5904\u7406\u8D85\u65F6 (5\u5206\u949F)",
      userMessage: "\u23F3 \u5904\u7406\u8D85\u65F6\uFF0C\u8BF7\u5C1D\u8BD5\u7B80\u5316\u60A8\u7684\u8BF7\u6C42\u540E\u91CD\u8BD5"
    };
  }
  if (stderr.includes("rate limit") || stderr.includes("429") || stderr.includes("Erate limit") || stderr.includes("Too many requests")) {
    return {
      type: "rate_limit",
      reason: "API \u8BF7\u6C42\u8FC7\u4E8E\u9891\u7E41",
      userMessage: "\u23F3 \u8BF7\u6C42\u8FC7\u4E8E\u9891\u7E41\uFF0C\u8BF7\u7B49\u5F85\u7247\u523B\u540E\u91CD\u8BD5"
    };
  }
  if (stderr.includes("overloaded") || stderr.includes("capacity") || stderr.includes("model not available")) {
    return {
      type: "overloaded",
      reason: "\u6A21\u578B\u7E41\u5FD9\u6216\u8D44\u6E90\u4E0D\u8DB3",
      userMessage: "\u{1F916} \u6A21\u578B\u7E41\u5FD9\u6216\u8D44\u6E90\u4E0D\u8DB3\uFF0C\u8BF7\u7A0D\u540E\u518D\u8BD5"
    };
  }
  if (stderr.includes("ETIMEDOUT") || stderr.includes("ECONNREFUSED") || stderr.includes("network") || stderr.includes("ENotfound")) {
    return {
      type: "network",
      reason: "\u7F51\u7EDC\u8FDE\u63A5\u95EE\u9898",
      userMessage: "\u{1F310} \u7F51\u7EDC\u8FDE\u63A5\u4E0D\u7A33\u5B9A\uFF0C\u6B63\u5728\u91CD\u8BD5..."
    };
  }
  if (stderr.includes("permission") || stderr.includes("not authorized") || stderr.includes("forbidden")) {
    return {
      type: "permission",
      reason: "\u6743\u9650\u4E0D\u8DB3",
      userMessage: "\u{1F510} \u6743\u9650\u4E0D\u8DB3\uFF0C\u8BF7\u68C0\u67E5\u6388\u6743\u72B6\u6001"
    };
  }
  return {
    type: "unknown",
    reason: "\u672A\u77E5\u9519\u8BEF",
    userMessage: "\u274C \u5904\u7406\u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u518D\u8BD5"
  };
}
var HEADLESS_SESSIONS_DIR = path3.join(GATEWAY_DIR3, "headless-sessions");
async function getOrCreateHeadlessSessionId(openid) {
  const sessionFile = path3.join(HEADLESS_SESSIONS_DIR, `${openid}.json`);
  if (!fs3.existsSync(HEADLESS_SESSIONS_DIR)) {
    fs3.mkdirSync(HEADLESS_SESSIONS_DIR, { recursive: true });
  }
  if (fs3.existsSync(sessionFile)) {
    try {
      const sessionData2 = JSON.parse(fs3.readFileSync(sessionFile, "utf8"));
      if (sessionData2.sessionId && sessionData2.confirmedAt) {
        sessionData2.lastActive = Date.now();
        fs3.writeFileSync(sessionFile, JSON.stringify(sessionData2));
        return { sessionId: sessionData2.sessionId, isNew: false };
      }
    } catch (e) {
    }
  }
  const sessionData = {
    sessionId: null,
    // 首次对话后由 Claude 返回
    openid,
    createdAt: Date.now(),
    lastActive: Date.now(),
    confirmedAt: null
    // Claude 确认后设置
  };
  fs3.writeFileSync(sessionFile, JSON.stringify(sessionData));
  cleanExpiredHeadlessSessions();
  return { sessionId: null, isNew: true };
}
function updateHeadlessSessionId(openid, sessionId) {
  const sessionFile = path3.join(HEADLESS_SESSIONS_DIR, `${openid}.json`);
  if (!fs3.existsSync(sessionFile)) {
    return;
  }
  try {
    const sessionData = JSON.parse(fs3.readFileSync(sessionFile, "utf8"));
    sessionData.sessionId = sessionId;
    sessionData.confirmedAt = Date.now();
    sessionData.lastActive = Date.now();
    fs3.writeFileSync(sessionFile, JSON.stringify(sessionData));
    log("cyan", `   \u{1F4DD} \u4F1A\u8BDD ID \u5DF2\u4FDD\u5B58: ${sessionId.slice(0, 12)}...`);
  } catch (e) {
    log("yellow", `   \u26A0\uFE0F \u4FDD\u5B58\u4F1A\u8BDD ID \u5931\u8D25: ${e.message}`);
  }
}
function cleanExpiredHeadlessSessions() {
  const maxAge = 24 * 60 * 60 * 1e3;
  const now = Date.now();
  try {
    if (!fs3.existsSync(HEADLESS_SESSIONS_DIR)) {
      return;
    }
    const files = fs3.readdirSync(HEADLESS_SESSIONS_DIR);
    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      const filePath = path3.join(HEADLESS_SESSIONS_DIR, file);
      try {
        const sessionData = JSON.parse(fs3.readFileSync(filePath, "utf8"));
        if (now - sessionData.lastActive > maxAge) {
          fs3.unlinkSync(filePath);
          log("cyan", `   \u{1F9F9} \u6E05\u7406\u8FC7\u671F\u4F1A\u8BDD: ${file}`);
        }
      } catch (e) {
      }
    }
  } catch (e) {
  }
}
var SELF_HEALING_CONFIG = {
  // 启动重试配置
  startupRetry: {
    maxAttempts: 5,
    // 最大重试次数
    initialDelayMs: 2e3,
    // 初始延迟 2 秒
    maxDelayMs: 3e4,
    // 最大延迟 30 秒
    backoffMultiplier: 2
    // 指数退避倍数
  },
  // 网络请求重试配置
  networkRetry: {
    maxAttempts: 3,
    // 最大重试次数
    initialDelayMs: 1e3,
    // 初始延迟 1 秒
    maxDelayMs: 1e4,
    // 最大延迟 10 秒
    backoffMultiplier: 2
    // 指数退避倍数
  },
  // 健康检查配置
  healthCheck: {
    intervalMs: 6e4,
    // 检查间隔 1 分钟
    wsIdleTimeoutMs: 18e4
    // WebSocket 空闲超时 3 分钟（QQ 平台约 30 分钟断开）
  },
  // 进程守护配置
  processGuardian: {
    checkIntervalMs: 1e4,
    // 检查间隔 10 秒
    restartDelayMs: 5e3
    // 重启延迟 5 秒
  },
  // ============ Claude Code 任务队列配置 ============
  claudeQueue: {
    maxConcurrent: 1,
    // 最大并发执行数（同时只运行一个 Claude Code）
    mergeWindowMs: 5e3,
    // 消息合并窗口 5 秒
    taskTimeoutMs: 3e5
    // 单任务超时 5 分钟
  }
};
var hookCache = /* @__PURE__ */ new Map();
var HOOK_MESSAGE_CONFIG = {
  batchTimeoutMs: 5e3,
  // 批量等待超时：5 秒（有新消息重置）
  maxBatchWaitMs: 3e4,
  // 最大等待时间：30 秒（强制发送，防止无限延迟）
  compressThreshold: 300,
  // 压缩阈值：300 字节
  compressedMaxSize: 150,
  // 压缩后最大：150 字节
  compressTimeoutMs: 6e4,
  // 压缩超时：60 秒（Claude headless）
  pendingMaxSize: 2e3
  // 待发送消息最大：2000 字节（防止积压过大）
};
var channelRegistry = /* @__PURE__ */ new Map();
var channelQueues = /* @__PURE__ */ new Map();
var defaultChannelId = null;
var activeMode = "notify";
var CHANNEL_EXPIRY_CONFIG = {
  checkInterval: 6e4,
  // 每 60 秒检查一次
  inactiveThreshold: 9e4,
  // 90 秒无活跃视为过期
  wsGracePeriod: 3e4
  // WebSocket 断开后 30 秒宽限期
};
var channelExpiryTimer = null;
function startChannelExpiryChecker() {
  if (channelExpiryTimer) return;
  channelExpiryTimer = setInterval(() => {
    const now = Date.now();
    for (const [sessionId, info] of channelRegistry.entries()) {
      const inactiveTime = now - info.lastActive;
      const hasWs = channelWsClients.has(sessionId);
      if (!hasWs && inactiveTime > CHANNEL_EXPIRY_CONFIG.inactiveThreshold || hasWs === false && inactiveTime > CHANNEL_EXPIRY_CONFIG.wsGracePeriod) {
        log("yellow", `\u{1F9F9} \u6E05\u7406\u8FC7\u671F Channel: ${sessionId.slice(0, 12)}... (inactive: ${Math.round(inactiveTime / 1e3)}s)`);
        unregisterChannel(sessionId);
      }
    }
  }, CHANNEL_EXPIRY_CONFIG.checkInterval);
  log("green", `\u2705 Channel \u8FC7\u671F\u68C0\u6D4B\u5668\u5DF2\u542F\u52A8 (\u68C0\u67E5\u95F4\u9694: ${CHANNEL_EXPIRY_CONFIG.checkInterval / 1e3}s, \u8FC7\u671F\u9608\u503C: ${CHANNEL_EXPIRY_CONFIG.inactiveThreshold / 1e3}s)`);
}
function unregisterChannelsByPath(projectPath) {
  let cleaned = 0;
  for (const [sessionId, info] of channelRegistry.entries()) {
    if (info.projectPath === projectPath) {
      unregisterChannel(sessionId);
      cleaned++;
    }
  }
  return { status: "ok", cleaned };
}
var CHANNEL_WEBSOCKET_PORT = 3311;
var channelWss = null;
var channelWsClients = /* @__PURE__ */ new Map();
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}
function registerChannel(sessionId, projectPath, projectName = null, displayName = null) {
  if (!sessionId || !projectPath) {
    return { success: false, error: "\u7F3A\u5C11 sessionId \u6216 projectPath" };
  }
  if (!projectName) {
    projectName = path3.basename(projectPath);
  }
  const channelDisplayName = displayName || projectName;
  if (channelRegistry.has(sessionId)) {
    const existing = channelRegistry.get(sessionId);
    existing.projectPath = projectPath;
    existing.projectName = projectName;
    existing.displayName = channelDisplayName;
    existing.lastActive = Date.now();
    log("cyan", `   \u{1F504} Channel \u5DF2\u66F4\u65B0: ${sessionId} (${channelDisplayName})`);
    return { success: true, channelId: sessionId };
  }
  const isDefault = channelRegistry.size === 0;
  const channelInfo = {
    sessionId,
    projectPath,
    projectName,
    displayName: channelDisplayName,
    registeredAt: Date.now(),
    lastActive: Date.now(),
    isDefault
  };
  channelRegistry.set(sessionId, channelInfo);
  if (!channelQueues.has(sessionId)) {
    channelQueues.set(sessionId, []);
  }
  if (isDefault) {
    defaultChannelId = sessionId;
    activeMode = "channel";
  }
  log("green", `   \u2705 Channel \u5DF2\u6CE8\u518C: ${sessionId} (${channelDisplayName})${isDefault ? " [\u9ED8\u8BA4]" : ""}`);
  return { success: true, channelId: sessionId };
}
function unregisterChannel(sessionId) {
  if (!channelRegistry.has(sessionId)) {
    return { success: false, error: "Channel \u4E0D\u5B58\u5728" };
  }
  const channelInfo = channelRegistry.get(sessionId);
  const wasDefault = channelInfo.isDefault;
  channelRegistry.delete(sessionId);
  if (channelQueues.has(sessionId)) {
    channelQueues.delete(sessionId);
  }
  if (wasDefault) {
    if (channelRegistry.size > 0) {
      const [newDefaultId, newDefaultInfo] = channelRegistry.entries().next().value;
      newDefaultInfo.isDefault = true;
      defaultChannelId = newDefaultId;
      log("cyan", `   \u{1F504} \u9ED8\u8BA4 Channel \u5DF2\u5207\u6362: ${newDefaultId}`);
    } else {
      defaultChannelId = null;
      activeMode = "notify";
      log("yellow", `   \u26A0\uFE0F \u6240\u6709 Channel \u5DF2\u6CE8\u9500\uFF0C\u56DE\u9000\u5230\u901A\u77E5\u6A21\u5F0F`);
    }
  }
  log("green", `   \u2705 Channel \u5DF2\u6CE8\u9500: ${sessionId}`);
  return { success: true };
}
function getAllChannels() {
  return Array.from(channelRegistry.values()).map((info) => ({
    sessionId: info.sessionId,
    projectName: info.projectName,
    projectPath: info.projectPath,
    registeredAt: info.registeredAt,
    lastActive: info.lastActive,
    isDefault: info.isDefault,
    pendingMessages: channelQueues.has(info.sessionId) ? channelQueues.get(info.sessionId).length : 0
  }));
}
function resolveChannel(content) {
  const prefixMatch = content.match(/^\[([^\]]+)\]\s*(.*)$/s);
  if (prefixMatch) {
    const [, prefix, cleanContent] = prefixMatch;
    if (channelRegistry.has(prefix)) {
      return { targetSessionId: prefix, cleanContent };
    }
    for (const [sessionId, info] of channelRegistry) {
      if (info.projectName === prefix || info.projectPath.includes(prefix)) {
        return { targetSessionId: sessionId, cleanContent };
      }
    }
    return { targetSessionId: defaultChannelId, cleanContent };
  }
  return { targetSessionId: defaultChannelId, cleanContent: content };
}
var CHANNEL_MESSAGES_DIR = path3.join(GATEWAY_DIR3, "channel-messages");
async function persistChannelMessage(sessionId, message) {
  const channelDir = path3.join(CHANNEL_MESSAGES_DIR, sessionId);
  if (!fs3.existsSync(channelDir)) {
    fs3.mkdirSync(channelDir, { recursive: true });
  }
  const messageFile = path3.join(channelDir, `${message.id}.json`);
  await fs3.promises.writeFile(messageFile, JSON.stringify(message));
}
function loadPersistedMessages(sessionId) {
  const channelDir = path3.join(CHANNEL_MESSAGES_DIR, sessionId);
  if (!fs3.existsSync(channelDir)) {
    return [];
  }
  const messages = [];
  const files = fs3.readdirSync(channelDir).filter((f) => f.endsWith(".json"));
  for (const file of files) {
    try {
      const data = JSON.parse(fs3.readFileSync(path3.join(channelDir, file), "utf8"));
      messages.push(data);
    } catch (e) {
    }
  }
  return messages.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
}
function loadAllPersistedMessages() {
  if (!fs3.existsSync(CHANNEL_MESSAGES_DIR)) {
    return;
  }
  const channels = fs3.readdirSync(CHANNEL_MESSAGES_DIR);
  for (const sessionId of channels) {
    const messages = loadPersistedMessages(sessionId);
    if (messages.length > 0) {
      if (!channelQueues.has(sessionId)) {
        channelQueues.set(sessionId, []);
      }
      const queue = channelQueues.get(sessionId);
      for (const msg of messages) {
        if (!msg.delivered && !queue.find((m) => m.id === msg.id)) {
          queue.push(msg);
        }
      }
      log("cyan", `   \u{1F4C2} \u52A0\u8F7D\u6301\u4E45\u5316\u6D88\u606F: ${sessionId} (${messages.length} \u6761)`);
    }
  }
}
function addMessageToChannelQueue(sessionId, message) {
  if (!channelQueues.has(sessionId)) {
    channelQueues.set(sessionId, []);
  }
  const queue = channelQueues.get(sessionId);
  const QUEUE_LIMITS = {
    maxMessages: 2e3,
    maxSizeBytes: 100 * 1024 * 1024
    // 100MB
  };
  if (queue.length >= QUEUE_LIMITS.maxMessages) {
    const removed = queue.shift();
    log("yellow", `   \u26A0\uFE0F Channel \u961F\u5217\u5DF2\u6EE1 (${sessionId}), \u4E22\u5F03\u6700\u65E7\u6D88\u606F: ${removed?.id}`);
  }
  const newMessage = {
    id: generateId(),
    sessionId,
    ...message,
    timestamp: Date.now(),
    delivered: false
  };
  const newSize = queue.reduce((sum, m) => sum + JSON.stringify(m).length, 0) + JSON.stringify(newMessage).length;
  if (newSize > QUEUE_LIMITS.maxSizeBytes) {
    log("yellow", `   \u26A0\uFE0F Channel \u961F\u5217\u8D85\u8FC7\u5927\u5C0F\u9650\u5236 (${sessionId}), \u4E22\u5F03\u6700\u65E7\u6D88\u606F`);
    while (queue.length > 0 && newSize > QUEUE_LIMITS.maxSizeBytes) {
      queue.shift();
    }
  }
  queue.push(newMessage);
  persistChannelMessage(sessionId, newMessage).catch((err) => {
    log("yellow", `   \u26A0\uFE0F \u6D88\u606F\u6301\u4E45\u5316\u5931\u8D25: ${err.message}`);
  });
  if (channelRegistry.has(sessionId)) {
    channelRegistry.get(sessionId).lastActive = Date.now();
  }
  const pushed = pushToChannelWebSocket(sessionId, newMessage);
  if (pushed) {
    newMessage.delivered = true;
    log("cyan", `   \u26A1 WebSocket \u5B9E\u65F6\u63A8\u9001\u6210\u529F: ${sessionId.slice(0, 12)}...`);
  }
}
function getChannelMessages(sessionId, limit = 10) {
  if (!channelQueues.has(sessionId)) {
    return [];
  }
  const queue = channelQueues.get(sessionId);
  return queue.filter((m) => !m.delivered).slice(0, limit);
}
function markChannelMessagesDelivered(sessionId, messageIds) {
  if (!channelQueues.has(sessionId)) {
    return;
  }
  const queue = channelQueues.get(sessionId);
  for (const msg of queue) {
    if (messageIds.includes(msg.id)) {
      msg.delivered = true;
    }
  }
  channelQueues.set(sessionId, queue.filter((m) => !m.delivered));
}
function hasActiveChannels() {
  return channelRegistry.size > 0;
}
function getActiveMode() {
  return activeMode;
}
async function retryWithBackoff(fn, options, operationName = "operation") {
  const { maxAttempts, initialDelayMs, maxDelayMs, backoffMultiplier } = options;
  let lastError = null;
  let delay = initialDelayMs;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts) {
        const isNetworkError = error.message?.includes("fetch failed") || error.message?.includes("Network error") || error.message?.includes("ECONNREFUSED") || error.message?.includes("ETIMEDOUT");
        if (isNetworkError) {
          log("yellow", `   \u26A0\uFE0F ${operationName} \u5931\u8D25 (\u5C1D\u8BD5 ${attempt}/${maxAttempts}): ${error.message}`);
          log("cyan", `   \u{1F504} ${delay / 1e3} \u79D2\u540E\u91CD\u8BD5...`);
          await new Promise((resolve2) => setTimeout(resolve2, delay));
          delay = Math.min(delay * backoffMultiplier, maxDelayMs);
        } else {
          throw error;
        }
      }
    }
  }
  throw lastError;
}
function addHookToCache(openid, message, project) {
  if (!getHookNotifyEnabled()) {
    log("yellow", `   \u{1F515} Hook \u63A8\u9001\u5DF2\u5173\u95ED\uFF0C\u8DF3\u8FC7\u7F13\u5B58`);
    return;
  }
  if (!hookCache.has(openid)) {
    hookCache.set(openid, {
      messages: [],
      firstMessageTime: Date.now(),
      timer: null
      // 5 秒超时定时器
    });
  }
  const entry = hookCache.get(openid);
  entry.messages.push({
    message,
    project,
    timestamp: Date.now()
  });
  log("cyan", `   \u{1F4EC} Hook \u6D88\u606F\u5DF2\u7F13\u5B58 (\u7528\u6237: ${openid.slice(0, 8)}..., \u7F13\u5B58\u6570: ${entry.messages.length})`);
  const elapsed = Date.now() - entry.firstMessageTime;
  if (elapsed >= HOOK_MESSAGE_CONFIG.maxBatchWaitMs) {
    log("yellow", `   \u23F0 \u5DF2\u8FBE\u6700\u5927\u7B49\u5F85\u65F6\u95F4 ${Math.round(elapsed / 1e3)}s\uFF0C\u5F3A\u5236\u89E6\u53D1\u5904\u7406`);
    if (entry.timer) {
      clearTimeout(entry.timer);
      entry.timer = null;
    }
    processHookBatchWithTimeout(openid).catch((err) => {
      log("red", `   \u274C \u6279\u6B21\u5904\u7406\u5931\u8D25: ${err.message}`);
    });
    return;
  }
  if (entry.timer) {
    clearTimeout(entry.timer);
  }
  entry.timer = setTimeout(() => {
    processHookBatchWithTimeout(openid).catch((err) => {
      log("red", `   \u274C \u6279\u6B21\u5904\u7406\u5931\u8D25: ${err.message}`);
    });
  }, HOOK_MESSAGE_CONFIG.batchTimeoutMs);
}
async function processHookBatchWithTimeout(openid) {
  const entry = hookCache.get(openid);
  if (!entry || entry.messages.length === 0) {
    return;
  }
  const messages = entry.messages;
  const waitTime = Math.round((Date.now() - entry.firstMessageTime) / 1e3);
  if (entry.timer) {
    clearTimeout(entry.timer);
  }
  hookCache.delete(openid);
  log("cyan", `   \u{1F5DC}\uFE0F 5\u79D2\u8D85\u65F6\u89E6\u53D1 Hook \u6279\u6B21: ${messages.length} \u6761\u6D88\u606F (\u7B49\u5F85 ${waitTime} \u79D2)`);
  try {
    const mergedContent = mergeHookMessages(messages);
    const mergedBytes = getByteLength(mergedContent);
    let finalContent;
    if (mergedBytes > HOOK_MESSAGE_CONFIG.compressThreshold) {
      log("cyan", `   \u{1F4CA} \u5408\u5E76\u540E ${mergedBytes} \u5B57\u8282 > \u9608\u503C ${HOOK_MESSAGE_CONFIG.compressThreshold}\uFF0C\u542F\u52A8\u5185\u90E8 Headless \u538B\u7F29...`);
      const summary = await compressHookMessagesToSize(messages, HOOK_MESSAGE_CONFIG.compressedMaxSize);
      finalContent = `\u{1F4CB} Hook \u6458\u8981 (${messages.length} \u6761, \u539F\u59CB ${mergedBytes} \u5B57\u8282)

${summary}`;
    } else {
      log("cyan", `   \u{1F4CA} \u5408\u5E76\u540E ${mergedBytes} \u5B57\u8282 <= \u9608\u503C ${HOOK_MESSAGE_CONFIG.compressThreshold}\uFF0C\u76F4\u63A5\u53D1\u9001`);
      finalContent = `\u{1F4CB} Hook \u6D88\u606F (${messages.length} \u6761)

${mergedContent}`;
    }
    const userStatus = getUserActivationStatus(openid);
    if (userStatus === "expired" || !userStatus) {
      addPendingMessage({
        targetOpenid: openid,
        content: finalContent,
        source: "hook_batch",
        priority: 5
      });
      log("cyan", `   \u{1F4EC} Hook \u6279\u6B21\u5DF2\u7F13\u5B58 (\u76EE\u6807\u672A\u6FC0\u6D3B)`);
      return;
    }
    const token = await getAccessToken2();
    const usageInfo = incrementMsgIdUsage(openid);
    const result = await sendMessageSmart(token, openid, finalContent, usageInfo);
    if (result.success) {
      const methodText = result.method === "passive" ? `\u88AB\u52A8\u56DE\u590D (\u5269\u4F59 ${result.remaining} \u6B21)` : "\u4E3B\u52A8\u6D88\u606F";
      log("green", `   \u2705 Hook \u6279\u6B21\u5DF2\u53D1\u9001 [${methodText}]`);
    } else {
      addPendingMessage({
        targetOpenid: openid,
        content: finalContent,
        source: "hook_batch",
        priority: 5
      });
      log("yellow", `   \u26A0\uFE0F Hook \u6279\u6B21\u53D1\u9001\u5931\u8D25\uFF0C\u5DF2\u7F13\u5B58: ${result.error}`);
    }
  } catch (err) {
    log("red", `   \u274C Hook \u6279\u6B21\u5904\u7406\u5931\u8D25: ${err.message}`);
    for (const msg of messages) {
      addPendingMessage({
        targetOpenid: openid,
        content: `[${msg.project || "Hook"}] ${msg.message}`,
        source: "hook_notification",
        priority: 5
      });
    }
  }
}
async function compressHookMessagesToSize(messages, maxSize) {
  const messagesText = messages.map((m, i) => `[${i + 1}] ${new Date(m.timestamp).toLocaleTimeString("zh-CN")} | ${m.project || "Hook"}
${m.message}`).join("\n\n");
  const compressPrompt = `\u8BF7\u5C06\u4EE5\u4E0B ${messages.length} \u6761 Hook \u6D88\u606F\u538B\u7F29\u6210\u7B80\u6D01\u6458\u8981\u3002

\u4E25\u683C\u8981\u6C42:
1. \u4F7F\u7528\u4E2D\u6587
2. \u603B\u957F\u5EA6\u4E0D\u8D85\u8FC7 ${maxSize} \u5B57\u8282\uFF08\u7EA6 ${Math.floor(maxSize / 3)} \u4E2A\u6C49\u5B57\uFF09
3. \u4FDD\u7559\u6700\u91CD\u8981\u7684\u4FE1\u606F
4. \u683C\u5F0F: \u6BCF\u6761\u4E00\u884C\uFF0C"\u65F6\u95F4 | \u7B80\u8981\u5185\u5BB9"

\u5F85\u538B\u7F29\u5185\u5BB9:
${messagesText}`;
  try {
    const claudePath = process.env.CLAUDE_CODE_PATH || "claude";
    const compressResult = await new Promise((resolve2, reject) => {
      const child = spawn(claudePath, [
        "--print",
        "--allowedTools",
        "none",
        compressPrompt
      ], {
        timeout: HOOK_MESSAGE_CONFIG.compressTimeoutMs,
        // 使用配置的压缩超时（默认 60 秒）
        maxBuffer: 1024 * 1024
      });
      let stdout = "";
      let stderr = "";
      child.stdout.on("data", (data) => {
        stdout += data.toString();
      });
      child.stderr.on("data", (data) => {
        stderr += data.toString();
      });
      child.on("close", (code) => {
        if (code === 0) {
          resolve2(stdout.trim());
        } else {
          reject(new Error(`Claude exited with code ${code}: ${stderr}`));
        }
      });
      child.on("error", reject);
    });
    let result = compressResult || "\uFF08\u538B\u7F29\u5931\u8D25\uFF09";
    if (getByteLength(result) > maxSize) {
      result = result.slice(0, Math.floor(maxSize / 3)) + "...";
    }
    return result;
  } catch (err) {
    log("red", `   \u274C Hook \u6D88\u606F\u538B\u7F29\u5931\u8D25: ${err.message}`);
    return messages.slice(0, 3).map((m, i) => `[${i + 1}] ${m.message.slice(0, 50)}...`).join("\n");
  }
}
function getByteLength(str) {
  return Buffer.byteLength(str, "utf-8");
}
function mergeHookMessages(messages) {
  return messages.map((m, i) => `[${i + 1}] ${new Date(m.timestamp).toLocaleTimeString("zh-CN")} | ${m.project || "Hook"}
${m.message}`).join("\n\n");
}
function startHookBatchTimer() {
  log("cyan", `   \u{1F4E4} Hook \u6D88\u606F\u6A21\u5F0F: 5\u79D2\u8D85\u65F6\u5408\u5E76\u53D1\u9001 (\u9608\u503C ${HOOK_MESSAGE_CONFIG.compressThreshold} \u5B57\u8282)`);
}
function stopHookBatchTimer() {
  for (const [openid, entry] of hookCache) {
    if (entry.timer) {
      clearTimeout(entry.timer);
    }
  }
  hookCache.clear();
}
function getHookCacheStatus() {
  const cacheInfo = [];
  const now = Date.now();
  for (const [openid, entry] of hookCache) {
    const waitSeconds = Math.round((now - entry.firstMessageTime) / 1e3);
    cacheInfo.push({
      openid: openid.slice(0, 8) + "...",
      messageCount: entry.messages.length,
      firstMessageTime: new Date(entry.firstMessageTime).toLocaleString("zh-CN"),
      waitSeconds,
      timeoutSeconds: HOOK_MESSAGE_CONFIG.batchTimeoutMs / 1e3
    });
  }
  return {
    mode: "5\u79D2\u8D85\u65F6\u5408\u5E76",
    config: {
      batchTimeoutMs: HOOK_MESSAGE_CONFIG.batchTimeoutMs,
      compressThreshold: HOOK_MESSAGE_CONFIG.compressThreshold,
      compressedMaxSize: HOOK_MESSAGE_CONFIG.compressedMaxSize
    },
    totalCachedMessages: cacheInfo.reduce((sum, c) => sum + c.messageCount, 0),
    cachedUsers: cacheInfo.length,
    cacheDetails: cacheInfo
  };
}
var claudeQueue = {
  tasks: [],
  // 待处理任务队列
  running: null,
  // 当前正在执行的任务
  runningProcess: null,
  // 当前执行的子进程
  isProcessing: false,
  // 是否正在处理中
  stats: {
    totalProcessed: 0,
    // 总处理数
    totalMerged: 0,
    // 总合并数
    avgProcessTimeMs: 0
    // 平均处理时间
  }
};
function generateTaskId() {
  return `task_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}
function enqueueTask(taskData) {
  const { projectName, cwd, authorId, msgId, content, parsed } = taskData;
  const config2 = SELF_HEALING_CONFIG.claudeQueue;
  const now = Date.now();
  const pendingTask = claudeQueue.tasks.find(
    (t) => t.projectName === projectName && t.authorId === authorId && now - t.createdAt < config2.mergeWindowMs
  );
  if (pendingTask) {
    pendingTask.content += `
---
${content}`;
    pendingTask.mergedCount = (pendingTask.mergedCount || 1) + 1;
    pendingTask.mergedAt = now;
    log("cyan", `   \u{1F4E6} \u6D88\u606F\u5DF2\u5408\u5E76\u5230\u961F\u5217\u4EFB\u52A1 (\u9879\u76EE: ${projectName}, \u961F\u5217: ${claudeQueue.tasks.length})`);
    return pendingTask;
  }
  const newTask = {
    id: generateTaskId(),
    projectName,
    cwd,
    authorId,
    msgId,
    content,
    parsed,
    createdAt: now,
    mergedCount: 1
  };
  claudeQueue.tasks.push(newTask);
  log("cyan", `   \u{1F4E5} \u4EFB\u52A1\u5DF2\u52A0\u5165\u961F\u5217 (\u9879\u76EE: ${projectName}, \u961F\u5217\u4F4D\u7F6E: ${claudeQueue.tasks.length})`);
  return newTask;
}
async function startQueueProcessing() {
  if (claudeQueue.isProcessing) {
    log("cyan", `   \u23F3 \u961F\u5217\u5904\u7406\u4E2D\uFF0C\u65B0\u4EFB\u52A1\u5C06\u6392\u961F\u7B49\u5F85...`);
    return;
  }
  processQueue();
}
async function processQueue() {
  if (claudeQueue.isProcessing || claudeQueue.tasks.length === 0) {
    return;
  }
  claudeQueue.isProcessing = true;
  const config2 = SELF_HEALING_CONFIG.claudeQueue;
  while (claudeQueue.tasks.length > 0) {
    const task = claudeQueue.tasks.shift();
    claudeQueue.running = task;
    const startTime = Date.now();
    log("yellow", `
\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501`);
    log("green", `\u{1F504} \u5F00\u59CB\u5904\u7406\u961F\u5217\u4EFB\u52A1`);
    log("yellow", `\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501`);
    log("cyan", `   \u{1F4C1} \u9879\u76EE: ${task.projectName}`);
    log("cyan", `   \u{1F4CB} \u961F\u5217\u5269\u4F59: ${claudeQueue.tasks.length}`);
    if (task.mergedCount > 1) {
      log("cyan", `   \u{1F4CA} \u5408\u5E76\u6D88\u606F\u6570: ${task.mergedCount}`);
    }
    try {
      await processWithClaude(task.parsed, task.authorId, task.msgId, task.content);
      const processTime = Date.now() - startTime;
      claudeQueue.stats.totalProcessed++;
      claudeQueue.stats.totalMerged += task.mergedCount;
      claudeQueue.stats.avgProcessTimeMs = (claudeQueue.stats.avgProcessTimeMs * (claudeQueue.stats.totalProcessed - 1) + processTime) / claudeQueue.stats.totalProcessed;
      log("green", `   \u2705 \u4EFB\u52A1\u5B8C\u6210 (\u8017\u65F6: ${(processTime / 1e3).toFixed(1)}\u79D2)`);
    } catch (error) {
      log("red", `   \u274C \u4EFB\u52A1\u6267\u884C\u5931\u8D25: ${error.message}`);
    } finally {
      claudeQueue.running = null;
      claudeQueue.runningProcess = null;
    }
  }
  claudeQueue.isProcessing = false;
  if (claudeQueue.stats.totalProcessed > 0) {
    log("cyan", `
\u{1F4CA} \u961F\u5217\u7EDF\u8BA1:`);
    log("cyan", `   \u603B\u5904\u7406: ${claudeQueue.stats.totalProcessed}, \u603B\u5408\u5E76: ${claudeQueue.stats.totalMerged}`);
    log("cyan", `   \u5E73\u5747\u8017\u65F6: ${(claudeQueue.stats.avgProcessTimeMs / 1e3).toFixed(1)}\u79D2`);
  }
}
var colors = {
  reset: "\x1B[0m",
  green: "\x1B[32m",
  yellow: "\x1B[33m",
  red: "\x1B[31m",
  cyan: "\x1B[36m",
  bold: "\x1B[1m"
};
function log(color, msg) {
  const timestamp = (/* @__PURE__ */ new Date()).toISOString().slice(11, 19);
  const line = `[${timestamp}] ${msg}`;
  console.log(`${colors[color]}${line}${colors.reset}`);
  fs3.appendFileSync(LOG_FILE, line + "\n");
}
function loadProjects() {
  if (!fs3.existsSync(PROJECTS_FILE)) {
    return { projects: {}, defaultProject: null };
  }
  return JSON.parse(fs3.readFileSync(PROJECTS_FILE, "utf-8"));
}
function saveProjects(data) {
  fs3.writeFileSync(PROJECTS_FILE, JSON.stringify(data, null, 2));
}
function syncProjectConfig(projectPath) {
  const projectEnvPath = path3.join(projectPath, ".env");
  if (!fs3.existsSync(projectEnvPath)) {
    return null;
  }
  const projectEnv = fs3.readFileSync(projectEnvPath, "utf-8");
  const config2 = {};
  projectEnv.split("\n").forEach((line) => {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) {
      config2[match[1].trim()] = match[2].trim();
    }
  });
  const qqbotKeys = ["QQBOT_APP_ID", "QQBOT_CLIENT_SECRET", "QQBOT_TEST_TARGET_ID", "QQBOT_IMAGE_SERVER_BASE_URL"];
  const hasQQBotConfig = qqbotKeys.some((key) => config2[key]);
  if (!hasQQBotConfig) {
    return null;
  }
  return {
    appId: config2.QQBOT_APP_ID,
    clientSecret: config2.QQBOT_CLIENT_SECRET,
    testTargetId: config2.QQBOT_TEST_TARGET_ID,
    imageServerBaseUrl: config2.QQBOT_IMAGE_SERVER_BASE_URL
  };
}
function getProjectBotConfig(projectName) {
  const data = loadProjects();
  const project = data.projects[projectName];
  if (!project || !project.botConfig) {
    return {
      appId: process.env.QQBOT_APP_ID,
      clientSecret: process.env.QQBOT_CLIENT_SECRET,
      testTargetId: process.env.QQBOT_TEST_TARGET_ID,
      imageServerBaseUrl: process.env.QQBOT_IMAGE_SERVER_BASE_URL
    };
  }
  return project.botConfig;
}
function registerProject(projectPath, name = null, botConfig = null) {
  const data = loadProjects();
  const projectName = name || path3.basename(projectPath);
  data.projects[projectName] = {
    path: projectPath,
    name: projectName,
    registeredAt: Date.now(),
    lastActive: Date.now(),
    session: null,
    botConfig
    // 存储项目级机器人配置
  };
  data.defaultProject = projectName;
  saveProjects(data);
  log("green", `\u2705 \u9879\u76EE\u5DF2\u6CE8\u518C: ${projectName} (${projectPath})`);
  return projectName;
}
function unregisterProject(projectName) {
  const data = loadProjects();
  if (!data.projects[projectName]) {
    log("yellow", `\u26A0\uFE0F \u9879\u76EE\u4E0D\u5B58\u5728: ${projectName}`);
    return false;
  }
  const sessionFile = path3.join(SESSIONS_DIR, `${projectName}.json`);
  if (fs3.existsSync(sessionFile)) {
    fs3.unlinkSync(sessionFile);
  }
  delete data.projects[projectName];
  if (data.defaultProject === projectName) {
    const remaining = Object.keys(data.projects);
    data.defaultProject = remaining.length > 0 ? remaining[remaining.length - 1] : null;
  }
  saveProjects(data);
  log("green", `\u2705 \u9879\u76EE\u5DF2\u6CE8\u9500: ${projectName}`);
  return true;
}
function switchDefaultProject(projectName) {
  const data = loadProjects();
  if (!data.projects[projectName]) {
    log("yellow", `\u26A0\uFE0F \u9879\u76EE\u4E0D\u5B58\u5728: ${projectName}`);
    return false;
  }
  data.defaultProject = projectName;
  data.projects[projectName].lastActive = Date.now();
  saveProjects(data);
  log("green", `\u2705 \u9ED8\u8BA4\u9879\u76EE\u5DF2\u5207\u6362: ${projectName}`);
  return true;
}
function getSessionFile(projectName) {
  return path3.join(SESSIONS_DIR, `${projectName}.json`);
}
function loadSession(projectName) {
  const file = getSessionFile(projectName);
  if (!fs3.existsSync(file)) {
    return null;
  }
  return JSON.parse(fs3.readFileSync(file, "utf-8"));
}
function saveSession(projectName, session) {
  const file = getSessionFile(projectName);
  fs3.writeFileSync(file, JSON.stringify(session, null, 2));
}
async function initializeSession(projectName, initPrompt = null) {
  const data = loadProjects();
  const project = data.projects[projectName];
  if (!project) {
    throw new Error(`\u9879\u76EE\u4E0D\u5B58\u5728: ${projectName}`);
  }
  const prompt = initPrompt || `\u4F60\u662F ${projectName} \u9879\u76EE\u7684\u667A\u80FD\u52A9\u624B\u3002\u8BF7\u786E\u8BA4\u5DF2\u51C6\u5907\u597D\u534F\u52A9\u5904\u7406\u6765\u81EA QQ \u7684\u4EFB\u52A1\u8BF7\u6C42\u3002`;
  return new Promise((resolve2, reject) => {
    const child = spawn("claude", ["-p", "--output-format", "json"], {
      cwd: project.path,
      env: { ...process.env, CLAUDECODE: void 0 },
      stdio: ["pipe", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (data2) => {
      stdout += data2.toString();
    });
    child.stderr.on("data", (data2) => {
      stderr += data2.toString();
    });
    child.stdin.write(prompt);
    child.stdin.end();
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error("Session \u521D\u59CB\u5316\u8D85\u65F6"));
    }, 6e4);
    child.on("close", (code) => {
      clearTimeout(timeout);
      if (code === 0) {
        try {
          const result = JSON.parse(stdout);
          const session = {
            sessionId: result.session_id || `sess_${Date.now()}`,
            projectName,
            projectPath: project.path,
            createdAt: Date.now(),
            lastUsed: Date.now(),
            mode: "auto"
          };
          saveSession(projectName, session);
          data.projects[projectName].session = session.sessionId;
          data.projects[projectName].lastActive = Date.now();
          saveProjects(data);
          resolve2(session);
        } catch (e) {
          reject(new Error(`\u89E3\u6790 session \u5931\u8D25: ${e.message}`));
        }
      } else {
        reject(new Error(`Session \u521D\u59CB\u5316\u5931\u8D25: ${stderr}`));
      }
    });
    child.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}
function parseMessage2(message) {
  const data = loadProjects();
  return parseMessage(message, data.projects, data.defaultProject);
}
async function getAccessToken2() {
  const data = loadProjects();
  const defaultProject = data.defaultProject;
  const botConfig = defaultProject ? getProjectBotConfig(defaultProject) : null;
  const appId = botConfig?.appId || process.env.QQBOT_APP_ID;
  const clientSecret = botConfig?.clientSecret || process.env.QQBOT_CLIENT_SECRET;
  if (!appId || !clientSecret) {
    throw new Error("\u672A\u627E\u5230 QQ Bot \u914D\u7F6E\u3002\u8BF7\u8BBE\u7F6E QQBOT_APP_ID \u548C QQBOT_CLIENT_SECRET \u73AF\u5883\u53D8\u91CF\uFF0C\u6216\u5728\u9879\u76EE .env \u6587\u4EF6\u4E2D\u914D\u7F6E\u3002");
  }
  return retryWithBackoff(
    () => getAccessToken(appId, clientSecret),
    SELF_HEALING_CONFIG.networkRetry,
    "\u83B7\u53D6 Access Token"
  );
}
async function sendC2CMessage2(token, openid, content, msgId = null) {
  return sendC2CMessage(token, openid, content, msgId);
}
async function sendProactiveMessage(token, openid, content) {
  return sendProactiveC2CMessage(token, openid, content);
}
async function sendMessageSmart(token, openid, content, usageInfo) {
  if (usageInfo && usageInfo.canUse) {
    try {
      await sendC2CMessage2(token, openid, content, usageInfo.msgId);
      return { success: true, method: "passive", remaining: usageInfo.remaining };
    } catch (err) {
      log("yellow", `   \u26A0\uFE0F \u88AB\u52A8\u56DE\u590D\u53D1\u9001\u5931\u8D25: ${err.message}\uFF0C\u5C1D\u8BD5\u4E3B\u52A8\u6D88\u606F...`);
    }
  }
  const maxRetries = 3;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 1) {
        const delay = 1e3 * Math.pow(2, attempt - 1);
        log("cyan", `   \u{1F504} \u4E3B\u52A8\u6D88\u606F\u91CD\u8BD5 ${attempt}/${maxRetries}\uFF0C\u7B49\u5F85 ${delay}ms...`);
        await new Promise((resolve2) => setTimeout(resolve2, delay));
      }
      await sendProactiveMessage(token, openid, content);
      return { success: true, method: "proactive" };
    } catch (err) {
      if (attempt === maxRetries) {
        log("red", `   \u274C \u4E3B\u52A8\u6D88\u606F\u53D1\u9001\u5931\u8D25 (\u5DF2\u91CD\u8BD5 ${maxRetries} \u6B21): ${err.message}`);
        return { success: false, method: "proactive", error: err.message };
      }
      log("yellow", `   \u26A0\uFE0F \u4E3B\u52A8\u6D88\u606F\u53D1\u9001\u5931\u8D25: ${err.message}\uFF0C\u51C6\u5907\u91CD\u8BD5...`);
    }
  }
  return { success: false, method: "proactive", error: "Max retries exceeded" };
}
async function sendRichMessageSmart(token, openid, text, usageInfo, projectName = "") {
  if (usageInfo && usageInfo.canUse) {
    try {
      const result = await sendRichMessage(token, openid, text, usageInfo.msgId, projectName);
      if (result && result.id) {
        return { success: true, method: "passive", remaining: usageInfo.remaining, id: result.id };
      }
    } catch (err) {
      log("yellow", `   \u26A0\uFE0F \u88AB\u52A8\u56DE\u590D\u53D1\u9001\u5931\u8D25: ${err.message}\uFF0C\u5C1D\u8BD5\u4E3B\u52A8\u6D88\u606F...`);
    }
  }
  try {
    const result = await sendRichMessage(token, openid, text, null, projectName);
    if (result && result.id) {
      return { success: true, method: "proactive", id: result.id };
    }
  } catch (err) {
    log("yellow", `   \u26A0\uFE0F \u4E3B\u52A8\u5BCC\u5A92\u4F53\u53D1\u9001\u5931\u8D25: ${err.message}\uFF0C\u5C1D\u8BD5\u7EAF\u6587\u672C...`);
  }
  const plainText = text.replace(/<(qqimg|qqvoice|qqvideo|qqfile)>[^<>]*<\/(?:qqimg|qqvoice|qqvideo|qqfile|img)>/gi, "[\u5A92\u4F53\u6587\u4EF6]");
  const finalText = projectName ? `[${projectName}] ${plainText}` : plainText;
  try {
    await sendProactiveMessage(token, openid, finalText);
    return { success: true, method: "proactive" };
  } catch (err) {
    log("red", `   \u274C \u4E3B\u52A8\u6D88\u606F\u53D1\u9001\u5931\u8D25: ${err.message}`);
    return { success: false, method: "proactive", error: err.message };
  }
}
async function sendC2CImageMessage2(token, openid, imageUrl, msgId = null, content = null, strictValidation = true) {
  if (!imageUrl.startsWith("http://") && !imageUrl.startsWith("https://") && !imageUrl.startsWith("data:")) {
    try {
      const imageData = await loadImageAsDataUrl(imageUrl, strictValidation);
      const sizeKB = Math.round(imageData.size / 1024);
      const sizeDisplay = sizeKB >= 1024 ? `${(sizeKB / 1024).toFixed(1)}MB` : `${sizeKB}KB`;
      log("cyan", `   \u{1F5BC}\uFE0F \u56FE\u7247\u4FE1\u606F:`);
      log("cyan", `      \u540D\u79F0: ${imageData.fileName}`);
      log("cyan", `      \u683C\u5F0F: ${imageData.mimeType}`);
      log("cyan", `      \u5927\u5C0F: ${sizeDisplay}`);
      return sendC2CImageMessage(token, openid, imageData.dataUrl, msgId, content);
    } catch (error) {
      log("red", `   \u274C \u56FE\u7247\u5B89\u5168\u68C0\u67E5\u5931\u8D25: ${error.message}`);
      throw error;
    }
  }
  return sendC2CImageMessage(token, openid, imageUrl, msgId, content);
}
async function sendC2CFileMessage2(token, openid, fileUrl, msgId = null, content = null, projectPath = null) {
  if (!fileUrl.startsWith("http://") && !fileUrl.startsWith("https://")) {
    try {
      const fileData = await loadFileAsBase64(fileUrl, projectPath);
      const sizeKB = Math.round(fileData.size / 1024);
      const sizeDisplay = sizeKB >= 1024 ? `${(sizeKB / 1024).toFixed(1)}MB` : `${sizeKB}KB`;
      log("cyan", `   \u{1F4CE} \u6587\u4EF6\u4FE1\u606F:`);
      log("cyan", `      \u540D\u79F0: ${fileData.fileName}`);
      log("cyan", `      \u7C7B\u578B: ${fileData.typeInfo.description}`);
      log("cyan", `      \u5927\u5C0F: ${sizeDisplay} (${Math.round(fileData.base64.length / 1024)}KB base64)`);
      return sendC2CFileMessage(token, openid, fileData.base64, null, msgId, fileData.fileName);
    } catch (error) {
      if (error.message.startsWith("MULTIPLE_MATCHES:")) {
        const fileList = error.message.replace("MULTIPLE_MATCHES:", "");
        throw new Error(`\u627E\u5230\u591A\u4E2A\u5339\u914D\u7684\u6587\u4EF6\uFF0C\u8BF7\u660E\u786E\u6307\u5B9A\u6587\u4EF6\u540D\uFF1A
${fileList}`);
      }
      throw error;
    }
  } else {
    log("cyan", `   \u{1F4CE} \u6587\u4EF6 URL: ${fileUrl}`);
    return sendC2CFileMessage(token, openid, null, fileUrl, msgId);
  }
}
var IMAGE_SECURITY_CONFIG = {
  maxSizeBytes: 100 * 1024 * 1024,
  // 100MB
  allowedExtensions: [".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp"],
  mimeTypes: {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".bmp": "image/bmp"
  },
  // 图片文件头魔数（用于验证真实的图片格式）
  magicNumbers: {
    "image/jpeg": [255, 216, 255],
    "image/png": [137, 80, 78, 71],
    "image/gif": [71, 73, 70, 56],
    "image/webp": [82, 73, 70, 70],
    // WebP 以 RIFF 开头
    "image/bmp": [66, 77]
  }
};
function validateImageFormat(buffer, expectedMimeType) {
  const magicNumbers = IMAGE_SECURITY_CONFIG.magicNumbers[expectedMimeType];
  if (!magicNumbers) return true;
  for (let i = 0; i < magicNumbers.length; i++) {
    if (buffer[i] !== magicNumbers[i]) {
      return false;
    }
  }
  return true;
}
async function loadImageAsDataUrl(imagePath, strictValidation = true) {
  const fs4 = await import("fs");
  const path4 = await import("path");
  if (!fs4.existsSync(imagePath)) {
    throw new Error(`\u56FE\u7247\u6587\u4EF6\u4E0D\u5B58\u5728: ${imagePath}`);
  }
  const ext = path4.extname(imagePath).toLowerCase();
  const fileName = path4.basename(imagePath);
  if (strictValidation && !IMAGE_SECURITY_CONFIG.allowedExtensions.includes(ext)) {
    throw new Error(`\u4E0D\u652F\u6301\u7684\u56FE\u7247\u683C\u5F0F: ${ext}\u3002\u652F\u6301\u7684\u683C\u5F0F: ${IMAGE_SECURITY_CONFIG.allowedExtensions.join(", ")}`);
  }
  const mimeType = IMAGE_SECURITY_CONFIG.mimeTypes[ext];
  if (!mimeType) {
    throw new Error(`\u65E0\u6CD5\u8BC6\u522B\u7684\u56FE\u7247\u7C7B\u578B: ${ext}`);
  }
  const buffer = fs4.readFileSync(imagePath);
  const fileSize = buffer.length;
  if (fileSize > IMAGE_SECURITY_CONFIG.maxSizeBytes) {
    const sizeMB = (fileSize / 1024 / 1024).toFixed(2);
    const limitMB = (IMAGE_SECURITY_CONFIG.maxSizeBytes / 1024 / 1024).toFixed(0);
    throw new Error(`\u56FE\u7247\u6587\u4EF6\u8FC7\u5927: ${sizeMB}MB\uFF0C\u6700\u5927\u5141\u8BB8: ${limitMB}MB`);
  }
  if (!validateImageFormat(buffer, mimeType)) {
    throw new Error(`\u56FE\u7247\u683C\u5F0F\u65E0\u6548: \u6587\u4EF6\u6269\u5C55\u540D\u662F ${ext}\uFF0C\u4F46\u6587\u4EF6\u5185\u5BB9\u4E0D\u662F\u6709\u6548\u7684 ${mimeType} \u683C\u5F0F`);
  }
  const base64 = buffer.toString("base64");
  return {
    dataUrl: `data:${mimeType};base64,${base64}`,
    fileName,
    size: fileSize,
    mimeType
  };
}
function getFileTypeInfo(fileName) {
  const ext = path3.extname(fileName).toLowerCase();
  const typeInfo = {
    category: "file",
    mimeType: "application/octet-stream",
    description: "\u6587\u4EF6"
  };
  if ([".md", ".txt", ".rst"].includes(ext)) {
    typeInfo.category = "document";
    typeInfo.mimeType = ext === ".md" ? "text/markdown" : "text/plain";
    typeInfo.description = ext === ".md" ? "Markdown \u6587\u6863" : "\u6587\u672C\u6587\u4EF6";
  } else if ([".pdf"].includes(ext)) {
    typeInfo.category = "document";
    typeInfo.mimeType = "application/pdf";
    typeInfo.description = "PDF \u6587\u6863";
  } else if ([".doc", ".docx"].includes(ext)) {
    typeInfo.category = "document";
    typeInfo.mimeType = "application/msword";
    typeInfo.description = "Word \u6587\u6863";
  } else if ([".json"].includes(ext)) {
    typeInfo.category = "code";
    typeInfo.mimeType = "application/json";
    typeInfo.description = "JSON \u6587\u4EF6";
  } else if ([".js", ".ts", ".jsx", ".tsx"].includes(ext)) {
    typeInfo.category = "code";
    typeInfo.mimeType = "text/javascript";
    typeInfo.description = ext.startsWith(".ts") ? "TypeScript \u6587\u4EF6" : "JavaScript \u6587\u4EF6";
  } else if ([".py"].includes(ext)) {
    typeInfo.category = "code";
    typeInfo.mimeType = "text/x-python";
    typeInfo.description = "Python \u6587\u4EF6";
  } else if ([".zip", ".tar", ".gz"].includes(ext)) {
    typeInfo.category = "archive";
    typeInfo.description = "\u538B\u7F29\u6587\u4EF6";
  }
  return typeInfo;
}
async function findMatchingFiles(basePath, pattern, projectPath) {
  const fs4 = await import("fs");
  const path4 = await import("path");
  if (fs4.existsSync(basePath)) {
    return [{ path: basePath, exact: true }];
  }
  const searchDir = projectPath || process.cwd();
  const results = [];
  try {
    const files = fs4.readdirSync(searchDir, { recursive: true });
    const patternLower = pattern.toLowerCase();
    for (const file of files) {
      const fullPath = path4.join(searchDir, file);
      try {
        const stat = fs4.statSync(fullPath);
        if (stat.isFile()) {
          const fileName = path4.basename(file);
          const fileNameLower = fileName.toLowerCase();
          if (fileNameLower.includes(patternLower) || patternLower.includes(fileNameLower.replace(/\.[^.]+$/, ""))) {
            results.push({
              path: fullPath,
              fileName,
              size: stat.size,
              exact: false
            });
          }
        }
      } catch (e) {
      }
    }
  } catch (e) {
  }
  return results.slice(0, 10);
}
async function loadFileAsBase64(filePath, projectPath = null) {
  const fs4 = await import("fs");
  const path4 = await import("path");
  if (!fs4.existsSync(filePath)) {
    const matches = await findMatchingFiles(filePath, path4.basename(filePath).replace(/\.[^.]+$/, ""), projectPath);
    if (matches.length === 0) {
      throw new Error(`File not found: ${filePath}`);
    } else if (matches.length === 1 && !matches[0].exact) {
      log("cyan", `   \u{1F50D} \u6587\u4EF6\u8DEF\u5F84\u6A21\u7CCA\u5339\u914D: ${path4.basename(filePath)} \u2192 ${matches[0].fileName}`);
      filePath = matches[0].path;
    } else if (matches.length > 1) {
      const fileList = matches.map((m, i) => `${i + 1}. ${m.fileName} (${Math.round(m.size / 1024)}KB)`).join("\n");
      throw new Error(`MULTIPLE_MATCHES:${fileList}`);
    }
  }
  const fileName = path4.basename(filePath);
  const buffer = fs4.readFileSync(filePath);
  const base64 = buffer.toString("base64");
  const typeInfo = getFileTypeInfo(fileName);
  return {
    base64,
    fileName,
    size: buffer.length,
    typeInfo
  };
}
async function sendRichMessage(token, openid, text, msgId = null, projectName = null) {
  text = text.replace(/<qqimg>/gi, "<qqimg>").replace(/<\/img>/gi, "</qqimg>").replace(/<(qqimg)([^>]*?)\/>/gi, "<qqimg>$2</qqimg>");
  const state = loadGatewayState();
  const isChannelMode = state?.channel?.enabled === true;
  const mediaTagRegex = /<(qqimg|qqvoice|qqvideo|qqfile)>([^<>]+)<\/(?:qqimg|qqvoice|qqvideo|qqfile|img)>/gi;
  const matches = text.match(mediaTagRegex);
  if (!matches || matches.length === 0) {
    const finalText = isChannelMode && projectName ? `[${projectName}] ${text}` : text;
    return sendC2CMessage2(token, openid, finalText, msgId);
  }
  log("cyan", `   \u68C0\u6D4B\u5230 ${matches.length} \u4E2A\u5BCC\u5A92\u4F53\u6807\u7B7E\uFF0C\u5206\u6279\u53D1\u9001...`);
  const sendQueue = [];
  let lastIndex = 0;
  const regexWithIndex = /<(qqimg|qqvoice|qqvideo|qqfile)>([^<>]+)<\/(?:qqimg|qqvoice|qqvideo|qqfile|img)>/gi;
  let match;
  while ((match = regexWithIndex.exec(text)) !== null) {
    const textBefore = text.slice(lastIndex, match.index).replace(/\n{3,}/g, "\n\n").trim();
    if (textBefore) {
      sendQueue.push({ type: "text", content: textBefore });
    }
    const tagName = match[1].toLowerCase();
    let mediaPath = match[2].trim();
    if (mediaPath.startsWith("~")) {
      const os4 = await import("os");
      mediaPath = os4.homedir() + mediaPath.slice(1);
    }
    if (tagName === "qqimg") {
      sendQueue.push({ type: "image", content: mediaPath });
    } else if (tagName === "qqvoice") {
      sendQueue.push({ type: "voice", content: mediaPath });
    } else if (tagName === "qqvideo") {
      sendQueue.push({ type: "video", content: mediaPath });
    } else if (tagName === "qqfile") {
      sendQueue.push({ type: "file", content: mediaPath });
    }
    lastIndex = match.index + match[0].length;
  }
  const textAfter = text.slice(lastIndex).replace(/\n{3,}/g, "\n\n").trim();
  if (textAfter) {
    sendQueue.push({ type: "text", content: textAfter });
  }
  log("cyan", `   \u53D1\u9001\u961F\u5217: ${sendQueue.map((i) => i.type).join(" -> ")}`);
  let lastResult = null;
  let isFirstMessage = true;
  for (const item of sendQueue) {
    try {
      if (item.type === "text") {
        const content = isChannelMode && projectName ? `[${projectName}] ${item.content}` : item.content;
        lastResult = await sendC2CMessage2(token, openid, content, isFirstMessage ? msgId : null);
        log("green", `   \u2705 \u6587\u672C\u6D88\u606F\u5DF2\u53D1\u9001`);
      } else if (item.type === "image") {
        const imagePath = item.content;
        const isHttpUrl = imagePath.startsWith("http://") || imagePath.startsWith("https://");
        let imageUrl;
        if (isHttpUrl) {
          imageUrl = imagePath;
        } else if (imagePath.startsWith("data:")) {
          imageUrl = imagePath;
        } else {
          const imageData = await loadImageAsDataUrl(imagePath);
          imageUrl = imageData.dataUrl;
          log("cyan", `   \u5DF2\u8BFB\u53D6\u672C\u5730\u56FE\u7247: ${imagePath}`);
        }
        lastResult = await sendC2CImageMessage2(token, openid, imageUrl, isFirstMessage ? msgId : null);
        log("green", `   \u2705 \u56FE\u7247\u6D88\u606F\u5DF2\u53D1\u9001`);
      } else if (item.type === "file") {
        const filePath = item.content;
        const isHttpUrl = filePath.startsWith("http://") || filePath.startsWith("https://");
        let fileUrl;
        if (isHttpUrl) {
          fileUrl = filePath;
        } else {
          fileUrl = filePath;
        }
        lastResult = await sendC2CFileMessage2(token, openid, fileUrl, isFirstMessage ? msgId : null);
        log("green", `   \u2705 \u6587\u4EF6\u6D88\u606F\u5DF2\u53D1\u9001`);
      } else if (item.type === "voice" || item.type === "video") {
        const tipText = `[${item.type === "voice" ? "\u8BED\u97F3" : "\u89C6\u9891"}\u6682\u4E0D\u652F\u6301]`;
        lastResult = await sendC2CMessage2(token, openid, tipText, isFirstMessage ? msgId : null);
        log("yellow", `   \u26A0\uFE0F ${item.type} \u6682\u4E0D\u652F\u6301\uFF0C\u5DF2\u53D1\u9001\u63D0\u793A`);
      }
      isFirstMessage = false;
      await new Promise((resolve2) => setTimeout(resolve2, 500));
    } catch (error) {
      log("red", `   \u274C \u53D1\u9001 ${item.type} \u5931\u8D25: ${error.message}`);
    }
  }
  return lastResult;
}
var ws = null;
var accessToken = null;
var heartbeatIntervalMs = null;
var heartbeatTimer = null;
var healthCheckTimer = null;
var lastWsActivity = Date.now();
var running = false;
var mode = "notify";
var startupAttempts = 0;
var consecutiveFailures = 0;
var INTERNAL_API_PORT = 3310;
var internalServer = null;
function startInternalApi() {
  internalServer = http.createServer(async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Content-Type", "application/json");
    if (req.method === "OPTIONS") {
      res.writeHead(200);
      res.end();
      return;
    }
    if (req.method === "POST" && req.url === "/api/notify") {
      let body = "";
      req.on("data", (chunk) => body += chunk);
      req.on("end", async () => {
        try {
          const data = JSON.parse(body);
          const { target, message, project } = data;
          if (!target || !message) {
            res.writeHead(400);
            res.end(JSON.stringify({ error: "\u7F3A\u5C11 target \u6216 message \u53C2\u6570" }));
            return;
          }
          addHookToCache(target, message, project);
          res.writeHead(200);
          res.end(JSON.stringify({
            status: "batched",
            message: "\u6D88\u606F\u5DF2\u7F13\u5B58\uFF0C\u5C06\u5728 5 \u79D2\u540E\u6279\u91CF\u53D1\u9001"
          }));
        } catch (parseErr) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: "\u65E0\u6548\u7684 JSON \u683C\u5F0F" }));
        }
      });
      return;
    }
    if (req.method === "GET" && req.url === "/api/status") {
      const stats = getActivationStats();
      res.writeHead(200);
      res.end(JSON.stringify({
        status: "running",
        mode,
        pid: process.pid,
        running,
        // 暴露内部 running 状态，用于检测僵尸状态
        lastWsActivity,
        // WebSocket 最后活动时间戳
        wsReadyState: ws ? ws.readyState : null,
        // WebSocket 状态 (0=CONNECTING, 1=OPEN, 2=CLOSING, 3=CLOSED)
        ...stats
      }));
      return;
    }
    if (req.method === "GET" && req.url === "/api/hook-batch-config") {
      const status = getHookCacheStatus();
      res.writeHead(200);
      res.end(JSON.stringify(status));
      return;
    }
    if (req.method === "POST" && req.url === "/api/hook-batch-config") {
      let body = "";
      req.on("data", (chunk) => body += chunk);
      req.on("end", async () => {
        try {
          const data = JSON.parse(body);
          if (typeof data.compressThreshold === "number" && data.compressThreshold > 0) {
            HOOK_MESSAGE_CONFIG.compressThreshold = data.compressThreshold;
          }
          if (typeof data.compressedMaxSize === "number" && data.compressedMaxSize > 0) {
            HOOK_MESSAGE_CONFIG.compressedMaxSize = data.compressedMaxSize;
          }
          res.writeHead(200);
          res.end(JSON.stringify({
            status: "ok",
            config: HOOK_MESSAGE_CONFIG,
            message: `Hook \u6D88\u606F\u914D\u7F6E\u5DF2\u66F4\u65B0: 5\u79D2\u8D85\u65F6, \u538B\u7F29\u9608\u503C ${HOOK_MESSAGE_CONFIG.compressThreshold} \u5B57\u8282`
          }));
        } catch (parseErr) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: "\u65E0\u6548\u7684 JSON \u683C\u5F0F" }));
        }
      });
      return;
    }
    if (req.method === "POST" && req.url === "/api/compress") {
      let body = "";
      req.on("data", (chunk) => body += chunk);
      req.on("end", async () => {
        try {
          const data = body ? JSON.parse(body) : {};
          const { openid } = data;
          if (openid) {
            const success = await compressExpiredMessages(openid);
            res.writeHead(200);
            res.end(JSON.stringify({
              status: success ? "compressed" : "no_messages",
              message: success ? "\u6D88\u606F\u538B\u7F29\u5B8C\u6210" : "\u6CA1\u6709\u53EF\u538B\u7F29\u7684\u6D88\u606F"
            }));
          } else {
            await checkAndCompressExpiredMessages();
            res.writeHead(200);
            res.end(JSON.stringify({
              status: "compressed",
              message: "\u6240\u6709\u8FC7\u671F\u6D88\u606F\u5DF2\u68C0\u67E5\u5E76\u538B\u7F29"
            }));
          }
        } catch (compressErr) {
          res.writeHead(500);
          res.end(JSON.stringify({ error: compressErr.message }));
        }
      });
      return;
    }
    if (req.method === "POST" && req.url === "/api/channels/register") {
      let body = "";
      req.on("data", (chunk) => body += chunk);
      req.on("end", async () => {
        try {
          const data = JSON.parse(body);
          const { sessionId, projectPath, projectName, displayName } = data;
          if (!sessionId || !projectPath) {
            res.writeHead(400);
            res.end(JSON.stringify({ error: "\u7F3A\u5C11 sessionId \u6216 projectPath" }));
            return;
          }
          const result = registerChannel(sessionId, projectPath, projectName, displayName);
          if (result.success) {
            const channelInfo = channelRegistry.get(result.channelId);
            res.writeHead(200);
            res.end(JSON.stringify({
              status: "registered",
              channelId: result.channelId,
              displayName: channelInfo?.displayName || projectName,
              isDefault: channelInfo?.isDefault || false,
              activeMode: getActiveMode()
            }));
          } else {
            res.writeHead(400);
            res.end(JSON.stringify({ error: result.error }));
          }
        } catch (parseErr) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: "\u65E0\u6548\u7684 JSON \u683C\u5F0F" }));
        }
      });
      return;
    }
    if (req.method === "DELETE" && req.url.startsWith("/api/channels/")) {
      const sessionId = decodeURIComponent(req.url.replace("/api/channels/", ""));
      const result = unregisterChannel(sessionId);
      if (result.success) {
        res.writeHead(200);
        res.end(JSON.stringify({
          status: "unregistered",
          sessionId,
          activeMode: getActiveMode(),
          remainingChannels: channelRegistry.size
        }));
      } else {
        res.writeHead(404);
        res.end(JSON.stringify({ error: result.error }));
      }
      return;
    }
    if (req.method === "GET" && req.url === "/api/channels") {
      const channels = getAllChannels();
      res.writeHead(200);
      res.end(JSON.stringify({
        activeMode: getActiveMode(),
        totalChannels: channels.length,
        defaultChannelId,
        channels
      }));
      return;
    }
    if (req.method === "POST" && req.url.match(/^\/api\/channels\/[^/]+\/heartbeat$/)) {
      const sessionId = decodeURIComponent(req.url.replace("/api/channels/", "").replace("/heartbeat", ""));
      const info = channelRegistry.get(sessionId);
      if (!info) {
        res.writeHead(404);
        res.end(JSON.stringify({ error: "Channel not found" }));
        return;
      }
      info.lastActive = Date.now();
      res.writeHead(200);
      res.end(JSON.stringify({ status: "ok", lastActive: info.lastActive }));
      return;
    }
    if (req.method === "DELETE" && req.url.startsWith("/api/channels/by-path?")) {
      const urlObj = new URL(req.url, `http://127.0.0.1:${INTERNAL_API_PORT}`);
      const projectPath = urlObj.searchParams.get("path");
      if (!projectPath) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: "Missing path parameter" }));
        return;
      }
      const result = unregisterChannelsByPath(projectPath);
      res.writeHead(200);
      res.end(JSON.stringify({
        status: "ok",
        cleaned: result.cleaned,
        projectPath
      }));
      return;
    }
    if (req.method === "GET" && req.url.startsWith("/api/messages?")) {
      const urlObj = new URL(req.url, `http://127.0.0.1:${INTERNAL_API_PORT}`);
      const sessionId = urlObj.searchParams.get("channel");
      const limit = parseInt(urlObj.searchParams.get("limit") || "10", 10);
      if (!sessionId) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: "\u7F3A\u5C11 channel \u53C2\u6570" }));
        return;
      }
      const messages = getChannelMessages(sessionId, limit);
      res.writeHead(200);
      res.end(JSON.stringify({
        sessionId,
        count: messages.length,
        messages
      }));
      return;
    }
    if (req.method === "DELETE" && req.url.startsWith("/api/messages?")) {
      const urlObj = new URL(req.url, `http://127.0.0.1:${INTERNAL_API_PORT}`);
      const sessionId = urlObj.searchParams.get("channel");
      const messageIds = urlObj.searchParams.get("ids")?.split(",") || [];
      if (!sessionId) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: "\u7F3A\u5C11 channel \u53C2\u6570" }));
        return;
      }
      markChannelMessagesDelivered(sessionId, messageIds);
      res.writeHead(200);
      res.end(JSON.stringify({
        status: "cleared",
        sessionId,
        clearedCount: messageIds.length
      }));
      return;
    }
    res.writeHead(404);
    res.end(JSON.stringify({ error: "Not found" }));
  });
  internalServer.listen(INTERNAL_API_PORT, "127.0.0.1", () => {
    log("green", `\u2705 \u5185\u90E8 API \u5DF2\u542F\u52A8: http://127.0.0.1:${INTERNAL_API_PORT}`);
  });
  internalServer.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      log("yellow", `\u26A0\uFE0F \u5185\u90E8 API \u7AEF\u53E3 ${INTERNAL_API_PORT} \u5DF2\u88AB\u5360\u7528`);
    } else {
      log("red", `\u274C \u5185\u90E8 API \u9519\u8BEF: ${err.message}`);
    }
  });
}
function startChannelWebSocketServer() {
  if (channelWss) {
    log("yellow", "\u26A0\uFE0F Channel WebSocket Server \u5DF2\u5728\u8FD0\u884C");
    return;
  }
  channelWss = new import_websocket_server.default({ port: CHANNEL_WEBSOCKET_PORT });
  channelWss.on("connection", (ws2, req) => {
    let clientSessionId = null;
    log("cyan", `   \u{1F50C} \u65B0\u7684 WebSocket \u8FDE\u63A5: ${req.socket.remoteAddress}`);
    ws2.on("message", (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === "register" && msg.sessionId) {
          clientSessionId = msg.sessionId;
          channelWsClients.set(clientSessionId, {
            ws: ws2,
            registeredAt: Date.now(),
            lastActive: Date.now()
          });
          log("green", `   \u2705 Channel WS \u5DF2\u6CE8\u518C: ${clientSessionId.slice(0, 12)}...`);
          ws2.send(JSON.stringify({
            type: "registered",
            sessionId: clientSessionId,
            timestamp: Date.now()
          }));
        }
        if (msg.type === "ping") {
          ws2.send(JSON.stringify({ type: "pong", timestamp: Date.now() }));
          if (clientSessionId && channelWsClients.has(clientSessionId)) {
            channelWsClients.get(clientSessionId).lastActive = Date.now();
          }
        }
      } catch (e) {
        log("yellow", `   \u26A0\uFE0F \u65E0\u6548\u7684 WebSocket \u6D88\u606F: ${e.message}`);
      }
    });
    ws2.on("close", () => {
      if (clientSessionId) {
        channelWsClients.delete(clientSessionId);
        log("yellow", `   \u26A0\uFE0F Channel WS \u5DF2\u65AD\u5F00: ${clientSessionId.slice(0, 12)}...`);
      }
    });
    ws2.on("error", (err) => {
      log("red", `   \u274C WebSocket \u9519\u8BEF: ${err.message}`);
    });
  });
  channelWss.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      log("yellow", `\u26A0\uFE0F Channel WebSocket \u7AEF\u53E3 ${CHANNEL_WEBSOCKET_PORT} \u5DF2\u88AB\u5360\u7528`);
    } else {
      log("red", `\u274C Channel WebSocket \u9519\u8BEF: ${err.message}`);
    }
  });
  log("green", `\u2705 Channel WebSocket \u5DF2\u542F\u52A8: ws://127.0.0.1:${CHANNEL_WEBSOCKET_PORT}`);
}
function pushToChannelWebSocket(sessionId, message) {
  const client = channelWsClients.get(sessionId);
  if (!client || !client.ws) {
    return false;
  }
  if (client.ws.readyState !== wrapper_default.OPEN) {
    channelWsClients.delete(sessionId);
    return false;
  }
  try {
    client.ws.send(JSON.stringify({
      type: "channel_message",
      data: message,
      timestamp: Date.now()
    }));
    client.lastActive = Date.now();
    return true;
  } catch (e) {
    log("yellow", `   \u26A0\uFE0F WebSocket \u63A8\u9001\u5931\u8D25: ${e.message}`);
    return false;
  }
}
async function startGateway(gatewayMode = "notify", channelConfig = null) {
  mode = gatewayMode;
  running = true;
  startupAttempts++;
  log("cyan", "\u{1F680} \u542F\u52A8 QQ Bot \u5168\u5C40\u7F51\u5173...");
  log("cyan", `   \u6A21\u5F0F: ${mode === "auto" ? "\u81EA\u52A8\u56DE\u590D" : "\u901A\u77E5"}`);
  if (channelConfig) {
    log("cyan", `   Channel: ${channelConfig}`);
  }
  if (startupAttempts > 1) {
    log("cyan", `   \u542F\u52A8\u5C1D\u8BD5: ${startupAttempts}/${SELF_HEALING_CONFIG.startupRetry.maxAttempts}`);
  }
  fs3.writeFileSync(PID_FILE, process.pid.toString());
  loadAllPersistedMessages();
  const existingState = loadGatewayState();
  const gatewayState = {
    ...existingState,
    mode,
    channel: {
      enabled: !!channelConfig,
      mode: channelConfig || "none"
    },
    pid: process.pid,
    startedAt: Date.now(),
    startupAttempts
  };
  saveGatewayState(gatewayState);
  if (startupAttempts === 1) {
    initActivationState();
    startExpirationChecker();
    startInternalApi();
    startChannelWebSocketServer();
    startHealthCheck();
    startHookBatchTimer();
    startChannelExpiryChecker();
  }
  try {
    accessToken = await getAccessToken2();
    log("green", "\u2705 Access Token \u83B7\u53D6\u6210\u529F");
    const gatewayUrl = await retryWithBackoff(
      () => getGatewayUrl(accessToken),
      SELF_HEALING_CONFIG.networkRetry,
      "\u83B7\u53D6 Gateway URL"
    );
    log("green", `\u2705 Gateway URL: ${gatewayUrl}`);
    ws = new wrapper_default(gatewayUrl);
    lastWsActivity = Date.now();
    ws.on("open", () => {
      log("green", "\u2705 WebSocket \u8FDE\u63A5\u5DF2\u5EFA\u7ACB");
      lastWsActivity = Date.now();
      startupAttempts = 0;
      consecutiveFailures = 0;
    });
    ws.on("message", async (data) => {
      lastWsActivity = Date.now();
      const payload = JSON.parse(data.toString());
      switch (payload.op) {
        case 10:
          heartbeatIntervalMs = payload.d.heartbeat_interval;
          startHeartbeat();
          sendIdentify();
          break;
        case 11:
          break;
        case 0:
          await handleEvent(payload);
          break;
      }
    });
    ws.on("close", (code, reason) => {
      log("yellow", `\u26A0\uFE0F WebSocket \u8FDE\u63A5\u5DF2\u5173\u95ED (code: ${code}, reason: ${reason || "\u65E0"})`);
      if (running) {
        const delay = Math.min(5e3 * (consecutiveFailures + 1), 3e4);
        log("cyan", `   \u{1F504} ${delay / 1e3} \u79D2\u540E\u91CD\u65B0\u8FDE\u63A5...`);
        setTimeout(() => startGateway(mode), delay);
      }
    });
    ws.on("error", (err) => {
      log("red", `\u274C WebSocket \u9519\u8BEF: ${err.message}`);
      consecutiveFailures++;
    });
    ws.on("ping", () => {
      lastWsActivity = Date.now();
    });
  } catch (error) {
    consecutiveFailures++;
    log("red", `\u274C \u542F\u52A8\u5931\u8D25: ${error.message}`);
    if (startupAttempts < SELF_HEALING_CONFIG.startupRetry.maxAttempts) {
      const delay = Math.min(
        SELF_HEALING_CONFIG.startupRetry.initialDelayMs * Math.pow(SELF_HEALING_CONFIG.startupRetry.backoffMultiplier, startupAttempts - 1),
        SELF_HEALING_CONFIG.startupRetry.maxDelayMs
      );
      log("yellow", `   \u{1F504} ${delay / 1e3} \u79D2\u540E\u91CD\u8BD5\u542F\u52A8 (${startupAttempts}/${SELF_HEALING_CONFIG.startupRetry.maxAttempts})...`);
      setTimeout(() => startGateway(mode), delay);
    } else {
      log("red", `   \u274C \u8FBE\u5230\u6700\u5927\u91CD\u8BD5\u6B21\u6570 (${SELF_HEALING_CONFIG.startupRetry.maxAttempts})\uFF0C\u505C\u6B62\u91CD\u8BD5`);
      log("yellow", `   \u{1F4A1} \u8BF7\u68C0\u67E5\u7F51\u7EDC\u8FDE\u63A5\u548C QQ Bot \u914D\u7F6E\u540E\u624B\u52A8\u91CD\u542F`);
      running = false;
    }
  }
}
function startHealthCheck() {
  if (healthCheckTimer) {
    clearInterval(healthCheckTimer);
  }
  let consecutiveWsFailures = 0;
  let consecutiveApiFailures = 0;
  const MAX_CONSECUTIVE_FAILURES = 3;
  healthCheckTimer = setInterval(async () => {
    if (!running) return;
    const now = Date.now();
    const idleTime = now - lastWsActivity;
    if (ws && ws.readyState === 1) {
      consecutiveWsFailures = 0;
      if (idleTime > SELF_HEALING_CONFIG.healthCheck.wsIdleTimeoutMs) {
        log("yellow", `\u26A0\uFE0F WebSocket \u7A7A\u95F2\u8D85\u8FC7 ${Math.round(idleTime / 6e4)} \u5206\u949F\uFF0C\u4E3B\u52A8\u91CD\u8FDE...`);
        consecutiveWsFailures++;
        ws.close();
      }
    } else if (ws && ws.readyState === 3) {
      consecutiveWsFailures++;
      log("yellow", `\u26A0\uFE0F \u68C0\u6D4B\u5230 WebSocket \u5DF2\u5173\u95ED (\u8FDE\u7EED\u5931\u8D25: ${consecutiveWsFailures}/${MAX_CONSECUTIVE_FAILURES})`);
      if (consecutiveWsFailures >= MAX_CONSECUTIVE_FAILURES) {
        log("red", "\u274C WebSocket \u8FDE\u7EED\u5931\u8D25\u6B21\u6570\u8FC7\u591A\uFF0C\u6267\u884C\u5B8C\u5168\u91CD\u542F...");
        consecutiveWsFailures = 0;
        if (running) {
          try {
            await startGateway(mode);
            log("green", "\u2705 \u7F51\u5173\u91CD\u542F\u6210\u529F");
          } catch (err) {
            log("red", `\u274C \u7F51\u5173\u91CD\u542F\u5931\u8D25: ${err.message}`);
          }
        }
      } else if (running) {
        startGateway(mode);
      }
    }
    if (now % (5 * 60 * 1e3) < SELF_HEALING_CONFIG.healthCheck.intervalMs) {
      try {
        const token = await getAccessToken2();
        if (token) {
          consecutiveApiFailures = 0;
        } else {
          throw new Error("Token \u4E3A\u7A7A");
        }
      } catch (err) {
        consecutiveApiFailures++;
        log("yellow", `\u26A0\uFE0F API \u5065\u5EB7\u68C0\u67E5\u5931\u8D25 (\u8FDE\u7EED\u5931\u8D25: ${consecutiveApiFailures}/${MAX_CONSECUTIVE_FAILURES}): ${err.message}`);
        if (consecutiveApiFailures >= MAX_CONSECUTIVE_FAILURES) {
          log("red", "\u274C API \u8FDE\u7EED\u5931\u8D25\u6B21\u6570\u8FC7\u591A\uFF0C\u53EF\u80FD\u51ED\u8BC1\u8FC7\u671F\u6216\u7F51\u7EDC\u95EE\u9898");
          consecutiveApiFailures = 0;
        }
      }
    }
    const memUsage = process.memoryUsage();
    const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
    const memUsagePercent = Math.round(memUsage.heapUsed / memUsage.heapTotal * 100);
    if (memUsagePercent > 90) {
      log("yellow", `\u26A0\uFE0F \u5185\u5B58\u4F7F\u7528\u7387\u8FC7\u9AD8: ${heapUsedMB}MB / ${heapTotalMB}MB (${memUsagePercent}%)`);
      if (global.gc) {
        global.gc();
        log("cyan", "\u{1F5D1}\uFE0F \u5DF2\u89E6\u53D1\u5783\u573E\u56DE\u6536");
      }
      cleanupExpiredUsers();
      cleanupExpiredFiles();
      clearExpiredMessages();
    }
    if (claudeQueue.tasks.length > 10) {
      log("yellow", `\u26A0\uFE0F \u4EFB\u52A1\u961F\u5217\u79EF\u538B: ${claudeQueue.tasks.length} \u4E2A\u4EFB\u52A1\u7B49\u5F85\u5904\u7406`);
    }
  }, SELF_HEALING_CONFIG.healthCheck.intervalMs);
  log("cyan", `\u2705 \u5065\u5EB7\u68C0\u67E5\u5DF2\u542F\u52A8 (\u95F4\u9694: ${SELF_HEALING_CONFIG.healthCheck.intervalMs / 1e3} \u79D2, \u5305\u542B: WebSocket/API/\u5185\u5B58/\u961F\u5217)`);
}
function startHeartbeat() {
  const send = () => {
    if (ws && ws.readyState === 1) {
      ws.send(JSON.stringify({ op: 1, d: null }));
    }
  };
  send();
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
  }
  heartbeatTimer = setInterval(send, heartbeatIntervalMs);
}
function sendIdentify() {
  ws.send(JSON.stringify({
    op: 2,
    d: {
      token: `QQBot ${accessToken}`,
      intents: 1 << 25 | 1 << 30 | 1 << 12,
      shard: [0, 1],
      properties: {
        $os: process.platform,
        $browser: "qqbot-gateway",
        $device: "server"
      }
    }
  }));
  log("green", "\u2705 Identify \u6D88\u606F\u5DF2\u53D1\u9001");
}
async function handleEvent(payload) {
  const { t: eventType, d: data } = payload;
  if (eventType === "READY") {
    const botUsername = data.user?.username || "\u672A\u77E5";
    log("green", `
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550`);
    log("green", `\u{1F680} QQ Bot \u7F51\u5173\u5DF2\u542F\u52A8 (PID: ${process.pid})`);
    log("green", `\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550`);
    log("cyan", `   \u{1F916} \u673A\u5668\u4EBA: ${botUsername}`);
    log("cyan", `   \u{1F4C1} \u9879\u76EE: ${loadProjects().defaultProject || "\u65E0"}`);
    log("cyan", `   \u2699\uFE0F  \u6A21\u5F0F: ${mode === "auto" ? "\u81EA\u52A8\u56DE\u590D" : "\u901A\u77E5"}`);
    const activeUsers = getActiveUsers();
    if (activeUsers.length === 0) {
      log("yellow", `
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500`);
      log("yellow", `\u{1F4F1} \u7B49\u5F85\u6FC0\u6D3B`);
      log("yellow", `\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500`);
      log("cyan", `
   \u8BF7\u4F7F\u7528 QQ \u5411\u673A\u5668\u4EBA\u53D1\u9001\u4EFB\u610F\u6D88\u606F\u4EE5\u6FC0\u6D3B\u7F51\u5173`);
      log("cyan", `   \u6FC0\u6D3B\u540E\u5373\u53EF\u53D1\u9001\u901A\u77E5\u6D88\u606F`);
      log("cyan", `
   \u{1F4A1} \u63D0\u793A: \u53D1\u9001 "hello" \u6216\u4EFB\u610F\u6587\u5B57\u5373\u53EF
`);
      log("green", `\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
`);
      setGatewayStatus("pending_activation");
      const projectsData = loadProjects();
      const defaultProject = projectsData.defaultProject;
      if (defaultProject) {
        const botConfig = getProjectBotConfig(defaultProject);
        if (botConfig?.testTargetId) {
          const modeText = mode === "auto" ? "\u81EA\u52A8\u56DE\u590D" : "\u901A\u77E5";
          const notification = `\u2705 QQ Bot \u7F51\u5173\u5DF2\u542F\u52A8
\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
\u{1F916} \u673A\u5668\u4EBA: ${botUsername}
\u{1F4C1} \u9879\u76EE: ${defaultProject}
\u2699\uFE0F \u6A21\u5F0F: ${modeText}
\u{1F522} PID: ${process.pid}`;
          addPendingMessage({
            targetOpenid: botConfig.testTargetId,
            content: notification,
            source: "startup_notification",
            priority: 1
            // 高优先级
          });
          log("cyan", `   \u{1F4EC} \u542F\u52A8\u901A\u77E5\u5DF2\u7F13\u5B58\uFF0C\u7B49\u5F85\u6FC0\u6D3B\u540E\u53D1\u9001`);
        }
      }
    } else {
      log("green", `
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500`);
      log("green", `\u2705 \u5DF2\u6709 ${activeUsers.length} \u4E2A\u6FC0\u6D3B\u7528\u6237`);
      log("green", `\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500`);
      setGatewayStatus("activated");
      sendStartupNotificationWithRetry(data.user?.username).catch((err) => {
        log("yellow", `   \u26A0\uFE0F \u542F\u52A8\u901A\u77E5\u5F02\u5E38: ${err.message}`);
      });
    }
    return;
  }
  if (eventType === "C2C_MESSAGE_CREATE") {
    await handleMessage("private", data);
  }
  if (eventType === "GROUP_AT_MESSAGE_CREATE") {
    await handleMessage("group", data);
  }
}
async function handleMessage(type, data) {
  const msgId = data.id;
  const content = data.content;
  const authorId = type === "private" ? data.author?.id : data.author?.member_openid;
  const groupId = type === "group" ? data.group_openid : null;
  const authorNickname = type === "private" ? data.author?.username : data.author?.nick;
  const messageReference = data.message_reference;
  let finalContent = content;
  if (messageReference?.message_id) {
    const referencedMsg = getReferencedMessage(messageReference.message_id);
    if (referencedMsg) {
      log("cyan", `   \u{1F4CE} \u68C0\u6D4B\u5230\u5F15\u7528\u6D88\u606F (ID: ${messageReference.message_id})`);
      finalContent = buildContextWithReference(content, messageReference.message_id);
      log("cyan", `   \u{1F4DD} \u5DF2\u5408\u5E76\u5F15\u7528\u4E0A\u4E0B\u6587`);
    } else {
      log("yellow", `   \u26A0\uFE0F \u5F15\u7528\u6D88\u606F\u672A\u627E\u5230\u6216\u5DF2\u8FC7\u671F (ID: ${messageReference.message_id})`);
    }
  }
  saveMessageHistory({
    msgId,
    openid: authorId,
    content,
    role: "user"
  });
  log("green", `
\u{1F4EC} \u6536\u5230${type === "private" ? "\u79C1\u804A" : "\u7FA4\u804A"}\u6D88\u606F\uFF01`);
  log("cyan", `   \u53D1\u9001\u8005: ${authorId} (${authorNickname || "\u672A\u77E5\u6635\u79F0"})`);
  log("cyan", `   \u5185\u5BB9: ${content}`);
  if (messageReference?.message_id) {
    log("cyan", `   \u5F15\u7528: \u662F`);
  }
  const userActivation = updateUserActivation({
    openid: authorId,
    msgId,
    type: type === "private" ? "c2c" : "group",
    nickname: authorNickname
  });
  log("green", `   \u2705 \u7528\u6237\u6FC0\u6D3B\u6210\u529F (msg_id \u6709\u6548\u671F\u81F3 ${new Date(userActivation.msgIdExpiresAt).toLocaleTimeString()})`);
  const currentStatus = getGatewayStatus();
  if (currentStatus === "activated") {
    const pendingCount = getPendingMessageCount(authorId);
    if (pendingCount > 0) {
      log("yellow", `
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500`);
      log("green", `\u2705 \u7528\u6237\u6FC0\u6D3B\u6210\u529F`);
      log("yellow", `\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500`);
      log("cyan", `   \u{1F464} \u7528\u6237: ${authorNickname || authorId}`);
      log("cyan", `   \u{1F550} \u65F6\u95F4: ${(/* @__PURE__ */ new Date()).toLocaleTimeString()}`);
      log("cyan", `   \u{1F4E4} \u5F85\u53D1\u9001\u6D88\u606F: ${pendingCount} \u6761`);
      log("cyan", `
   \u6B63\u5728\u53D1\u9001\u5F85\u53D1\u9001\u6D88\u606F...`);
      await processPendingMessages(authorId, msgId);
    }
  }
  const trimmedContent = content.trim();
  const setThresholdMatch = trimmedContent.match(/^设置hook压缩阈值\s+(\d+)$/);
  if (setThresholdMatch) {
    const threshold = parseInt(setThresholdMatch[1], 10);
    HOOK_MESSAGE_CONFIG.compressThreshold = threshold;
    const token = await getAccessToken2();
    const usageInfo = incrementMsgIdUsage(authorId);
    const replyMsg2 = `\u2705 Hook \u538B\u7F29\u9608\u503C\u5DF2\u8BBE\u7F6E\u4E3A ${threshold} \u5B57\u8282

\u5408\u5E76\u540E\u8D85\u8FC7\u6B64\u9608\u503C\u7684\u6D88\u606F\u5C06\u8C03\u7528 Claude \u538B\u7F29\u3002`;
    await sendMessageSmart(token, authorId, replyMsg2, usageInfo);
    log("green", `   \u2705 Hook \u538B\u7F29\u9608\u503C\u5DF2\u8BBE\u7F6E\u4E3A ${threshold} \u5B57\u8282`);
    return;
  }
  if (trimmedContent === "hook on" || trimmedContent === "hook off" || trimmedContent === "hook status") {
    const token = await getAccessToken2();
    const usageInfo = incrementMsgIdUsage(authorId);
    let replyMsg2 = "";
    if (trimmedContent === "hook on") {
      setHookNotifyEnabled(true);
      replyMsg2 = `\u2705 Hook \u6D88\u606F\u63A8\u9001\u5DF2\u5F00\u542F

\u6240\u6709 Hook \u6D88\u606F\u5C06\u6B63\u5E38\u63A8\u9001\u5230 QQ\u3002`;
      log("green", `   \u2705 Hook \u6D88\u606F\u63A8\u9001\u5DF2\u5F00\u542F`);
    } else if (trimmedContent === "hook off") {
      setHookNotifyEnabled(false);
      replyMsg2 = `\u{1F515} Hook \u6D88\u606F\u63A8\u9001\u5DF2\u5173\u95ED

Hook \u6D88\u606F\u5C06\u4E0D\u518D\u63A8\u9001\u5230 QQ\uFF0C\u4F46\u4F1A\u7EE7\u7EED\u5728\u540E\u53F0\u5904\u7406\u3002

\u{1F4A1} \u4F7F\u7528 "hook on" \u53EF\u91CD\u65B0\u5F00\u542F\u3002`;
      log("yellow", `   \u{1F515} Hook \u6D88\u606F\u63A8\u9001\u5DF2\u5173\u95ED`);
    } else if (trimmedContent === "hook status") {
      const enabled = getHookNotifyEnabled();
      const status = getHookCacheStatus();
      replyMsg2 = `\u{1F4CB} Hook \u63A8\u9001\u72B6\u6001
`;
      replyMsg2 += `\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
`;
      replyMsg2 += `\u5168\u5C40\u5F00\u5173: ${enabled ? "\u2705 \u5DF2\u5F00\u542F" : "\u{1F515} \u5DF2\u5173\u95ED"}
`;
      replyMsg2 += `\u5F53\u524D\u7F13\u5B58: ${status.totalCachedMessages} \u6761 (${status.cachedUsers} \u4E2A\u7528\u6237)
`;
      replyMsg2 += `
\u{1F4A1} \u547D\u4EE4:
`;
      replyMsg2 += `\u2022 "hook on" - \u5F00\u542F\u63A8\u9001
`;
      replyMsg2 += `\u2022 "hook off" - \u5173\u95ED\u63A8\u9001`;
      log("cyan", `   \u{1F4CB} Hook \u63A8\u9001\u72B6\u6001: ${enabled ? "\u5DF2\u5F00\u542F" : "\u5DF2\u5173\u95ED"}`);
    }
    await sendMessageSmart(token, authorId, replyMsg2, usageInfo);
    return;
  }
  if (trimmedContent === "\u67E5\u770Bhook\u7F13\u5B58") {
    const status = getHookCacheStatus();
    const token = await getAccessToken2();
    const usageInfo = incrementMsgIdUsage(authorId);
    let replyMsg2 = `\u{1F4CB} Hook \u6D88\u606F\u72B6\u6001
`;
    replyMsg2 += `\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
`;
    replyMsg2 += `\u6A21\u5F0F: ${status.mode}
`;
    replyMsg2 += `\u8D85\u65F6: ${status.config.batchTimeoutMs / 1e3} \u79D2
`;
    replyMsg2 += `\u538B\u7F29\u9608\u503C: ${status.config.compressThreshold} \u5B57\u8282
`;
    replyMsg2 += `\u538B\u7F29\u540E\u5927\u5C0F: ${status.config.compressedMaxSize} \u5B57\u8282
`;
    replyMsg2 += `\u5F53\u524D\u7F13\u5B58: ${status.totalCachedMessages} \u6761 (${status.cachedUsers} \u4E2A\u7528\u6237)
`;
    if (status.cacheDetails.length > 0) {
      replyMsg2 += `
\u7F13\u5B58\u8BE6\u60C5:
`;
      for (const detail of status.cacheDetails) {
        replyMsg2 += `  \u2022 ${detail.openid}: ${detail.messageCount} \u6761 (\u7B49\u5F85 ${detail.waitSeconds}s)
`;
      }
    }
    await sendMessageSmart(token, authorId, replyMsg2, usageInfo);
    log("green", `   \u2705 \u5DF2\u8FD4\u56DE Hook \u7F13\u5B58\u72B6\u6001`);
    return;
  }
  const quickAuthKeywords = {
    "\u6388\u6743\u5168\u90E8": { type: "mcpTools", resource: "*", label: "\u5168\u90E8 MCP \u5DE5\u5177" },
    "\u5168\u90E8\u6388\u6743": { type: "mcpTools", resource: "*", label: "\u5168\u90E8 MCP \u5DE5\u5177" },
    "\u6388\u6743mcp": { type: "mcpTools", resource: "*", label: "\u5168\u90E8 MCP \u5DE5\u5177" },
    "\u6388\u6743\u5DE5\u5177": { type: "mcpTools", resource: "*", label: "\u5168\u90E8 MCP \u5DE5\u5177" },
    "\u5141\u8BB8\u5168\u90E8": { type: "mcpTools", resource: "*", label: "\u5168\u90E8 MCP \u5DE5\u5177" },
    "\u5141\u8BB8mcp": { type: "mcpTools", resource: "*", label: "\u5168\u90E8 MCP \u5DE5\u5177" },
    "mcp\u6388\u6743": { type: "mcpTools", resource: "*", label: "\u5168\u90E8 MCP \u5DE5\u5177" }
  };
  if (quickAuthKeywords[trimmedContent]) {
    const auth = quickAuthKeywords[trimmedContent];
    const token = await getAccessToken2();
    const usageInfo = incrementMsgIdUsage(authorId);
    const result = authorizeUser({
      openid: authorId,
      authType: auth.type,
      resource: auth.resource,
      nickname: authorNickname
    });
    replyMsg += `\u5DF2\u6388\u6743: ${auth.label}

`;
    const timeoutSettings = getUserTimeoutSettings(authorId);
    if (result.expiresAt === 0) {
      replyMsg += `\u23F0 \u6709\u6548\u671F: \u6C38\u4E45\u6709\u6548
`;
    } else {
      const expiresDate = new Date(result.expiresAt);
      replyMsg += `\u23F0 \u6709\u6548\u671F\u81F3: ${expiresDate.toLocaleString("zh-CN")}
`;
      const hoursLeft = Math.round((result.expiresAt - Date.now()) / (60 * 60 * 1e3));
      if (hoursLeft > 0) {
        replyMsg += `   (\u5269\u4F59 ${hoursLeft} \u5C0F\u65F6)
`;
      }
    }
    replyMsg += `
\u{1F4A1} \u8BBE\u7F6E\u8D85\u65F6: \u53D1\u9001 "\u8BBE\u7F6E\u6388\u6743\u8D85\u65F6 48" (\u5C0F\u65F6)
`;
    replyMsg += `\u73B0\u5728\u53EF\u4EE5\u4F7F\u7528\u6240\u6709\u529F\u80FD\u4E86\uFF01`;
    await sendMessageSmart(token, authorId, replyMsg, usageInfo);
    log("green", `   \u2705 \u5FEB\u6377\u6388\u6743: ${auth.label}, \u8D85\u65F6: ${result.timeoutHours}h`);
    return;
  }
  if (trimmedContent === "\u67E5\u770B\u6388\u6743" || trimmedContent === "\u6211\u7684\u6388\u6743" || trimmedContent === "\u6388\u6743\u72B6\u6001") {
    const userAuth = getUserAuthorization(authorId);
    const token = await getAccessToken2();
    const usageInfo = incrementMsgIdUsage(authorId);
    const timeoutSettings = getUserTimeoutSettings(authorId);
    let replyMsg2 = `\u{1F4CB} \u6388\u6743\u72B6\u6001
`;
    replyMsg2 += `\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
`;
    if (!userAuth) {
      replyMsg2 += `\u72B6\u6001: \u274C \u672A\u6388\u6743
`;
      replyMsg2 += `
\u26A1 \u5FEB\u6377\u6388\u6743 (\u63A8\u8350):
`;
      replyMsg2 += `\u2022 \u53D1\u9001 "\u6388\u6743\u5168\u90E8" \u6216 "\u6388\u6743mcp"
`;
      replyMsg2 += `
\u{1F4DD} \u8BE6\u7EC6\u8BF4\u660E: \u53D1\u9001 "help auth"`;
    } else {
      replyMsg2 += `\u6388\u6743\u65F6\u95F4: ${new Date(userAuth.authorizedAt).toLocaleString("zh-CN")}
`;
      replyMsg2 += `\u6700\u540E\u66F4\u65B0: ${new Date(userAuth.lastAuthorizedAt).toLocaleString("zh-CN")}
`;
      replyMsg2 += `\u8D85\u65F6\u8BBE\u7F6E: ${timeoutSettings.authTimeoutHours} \u5C0F\u65F6

`;
      const mcpTools = userAuth.authorizations?.mcpTools || [];
      const filePaths = userAuth.authorizations?.filePaths || [];
      const networkDomains = userAuth.authorizations?.networkDomains || [];
      const now = Date.now();
      replyMsg2 += `MCP \u5DE5\u5177 (${mcpTools.length}):
`;
      if (mcpTools.length === 0) {
        replyMsg2 += `  \u65E0
`;
      } else {
        for (const item of mcpTools.slice(0, 5)) {
          const tool = typeof item === "string" ? item : item.resource;
          const expiresAt = typeof item === "object" ? item.expiresAt : null;
          let statusIcon = "\u2705";
          let expireInfo = "";
          if (expiresAt !== null && expiresAt !== 0) {
            if (now >= expiresAt) {
              statusIcon = "\u274C";
              expireInfo = " (\u5DF2\u8FC7\u671F)";
            } else {
              const hoursLeft = Math.round((expiresAt - now) / (60 * 60 * 1e3));
              if (hoursLeft <= 1) {
                statusIcon = "\u26A0\uFE0F";
                expireInfo = ` (\u5269\u4F59 ${Math.round((expiresAt - now) / (60 * 1e3))} \u5206\u949F)`;
              }
            }
          }
          replyMsg2 += `  ${statusIcon} ${tool}${expireInfo}
`;
        }
        if (mcpTools.length > 5) {
          replyMsg2 += `  ... \u8FD8\u6709 ${mcpTools.length - 5} \u4E2A
`;
        }
      }
      replyMsg2 += `
\u6587\u4EF6\u8DEF\u5F84 (${filePaths.length}):
`;
      if (filePaths.length === 0) {
        replyMsg2 += `  \u65E0
`;
      } else {
        for (const path4 of filePaths.slice(0, 3)) {
          replyMsg2 += `  \u2022 ${path4}
`;
        }
        if (filePaths.length > 3) {
          replyMsg2 += `  ... \u8FD8\u6709 ${filePaths.length - 3} \u4E2A
`;
        }
      }
      replyMsg2 += `
\u{1F4A1} \u8BBE\u7F6E\u8D85\u65F6: \u53D1\u9001 "\u8BBE\u7F6E\u6388\u6743\u8D85\u65F6 \u5C0F\u65F6\u6570"
`;
      replyMsg2 += `   \u5F53\u524D\u8BBE\u7F6E: ${timeoutSettings.authTimeoutHours} \u5C0F\u65F6
`;
    }
    await sendMessageSmart(token, authorId, replyMsg2, usageInfo);
    log("green", `   \u2705 \u5DF2\u8FD4\u56DE\u6388\u6743\u72B6\u6001`);
    return;
  }
  const setTimeoutMatch = trimmedContent.match(/^设置授权超时\s*(\d+)(?:\s*小时)?$/);
  if (setTimeoutMatch) {
    const hours = parseInt(setTimeoutMatch[1]);
    const token = await getAccessToken2();
    const usageInfo = incrementMsgIdUsage(authorId);
    if (isNaN(hours) || hours < 0) {
      const replyMsg3 = `\u274C \u65E0\u6548\u7684\u8D85\u65F6\u65F6\u95F4

\u8BF7\u8F93\u5165\u6B63\u6574\u6570\uFF0C\u4F8B\u5982: \u8BBE\u7F6E\u6388\u6743\u8D85\u65F6 48`;
      await sendMessageSmart(token, authorId, replyMsg3, usageInfo);
      return;
    }
    setUserTimeoutSettings(authorId, { authTimeoutHours: hours });
    const timeoutSettings = getUserTimeoutSettings(authorId);
    let replyMsg2 = `\u2705 \u6388\u6743\u8D85\u65F6\u8BBE\u7F6E\u5DF2\u66F4\u65B0

`;
    replyMsg2 += `\u65B0\u6388\u6743\u6709\u6548\u671F: ${hours} \u5C0F\u65F6
`;
    if (hours === 0) {
      replyMsg2 += `(\u6C38\u4E0D\u8FC7\u671F)
`;
    } else {
      replyMsg2 += `(\u7EA6 ${hours / 24} \u5929)
`;
    }
    replyMsg2 += `
\u{1F4A1} \u6B64\u8BBE\u7F6E\u5C06\u5E94\u7528\u4E8E\u540E\u7EED\u7684\u65B0\u6388\u6743
`;
    replyMsg2 += `\u5982\u9700\u5237\u65B0\u73B0\u6709\u6388\u6743\uFF0C\u8BF7\u91CD\u65B0\u53D1\u9001\u6388\u6743\u547D\u4EE4`;
    await sendMessageSmart(token, authorId, replyMsg2, usageInfo);
    log("green", `   \u2705 \u5DF2\u8BBE\u7F6E\u6388\u6743\u8D85\u65F6: ${hours} \u5C0F\u65F6`);
    return;
  }
  const authToolMatch = trimmedContent.match(/^授权工具[:：]\s*(.+)$/);
  if (authToolMatch) {
    const resource = authToolMatch[1].trim();
    const token = await getAccessToken2();
    const usageInfo = incrementMsgIdUsage(authorId);
    authorizeUser({
      openid: authorId,
      authType: "mcpTools",
      resource,
      nickname: authorNickname
    });
    const replyMsg2 = `\u2705 \u5DE5\u5177\u6388\u6743\u6210\u529F

\u5DF2\u6388\u6743: ${resource}

\u73B0\u5728\u53EF\u4EE5\u4F7F\u7528\u8BE5\u5DE5\u5177\u8FDB\u884C\u64CD\u4F5C\u3002`;
    await sendMessageSmart(token, authorId, replyMsg2, usageInfo);
    log("green", `   \u2705 \u5DF2\u6388\u6743\u5DE5\u5177: ${resource}`);
    return;
  }
  const authPathMatch = trimmedContent.match(/^授权路径[:：]\s*(.+)$/);
  if (authPathMatch) {
    const resource = authPathMatch[1].trim();
    const token = await getAccessToken2();
    const usageInfo = incrementMsgIdUsage(authorId);
    authorizeUser({
      openid: authorId,
      authType: "filePaths",
      resource,
      nickname: authorNickname
    });
    const replyMsg2 = `\u2705 \u8DEF\u5F84\u6388\u6743\u6210\u529F

\u5DF2\u6388\u6743: ${resource}

\u73B0\u5728\u53EF\u4EE5\u8BBF\u95EE\u8BE5\u8DEF\u5F84\u4E0B\u7684\u6587\u4EF6\u3002`;
    await sendMessageSmart(token, authorId, replyMsg2, usageInfo);
    log("green", `   \u2705 \u5DF2\u6388\u6743\u8DEF\u5F84: ${resource}`);
    return;
  }
  const setConfigMatch = trimmedContent.match(/^设置配置[:：]\s*(\w+)[=：]\s*(.+)$/);
  if (setConfigMatch) {
    const key = setConfigMatch[1].trim();
    const value = setConfigMatch[2].trim();
    const token = await getAccessToken2();
    const usageInfo = incrementMsgIdUsage(authorId);
    let parsedValue = value;
    if (value === "true") parsedValue = true;
    else if (value === "false") parsedValue = false;
    else if (!isNaN(value) && value !== "") parsedValue = Number(value);
    else if (value.startsWith("[") && value.endsWith("]")) {
      try {
        parsedValue = JSON.parse(value);
      } catch (e) {
      }
    }
    const newConfig = { [key]: parsedValue };
    getOrSetHeadlessConfig(authorId, newConfig);
    const replyMsg2 = `\u2705 \u914D\u7F6E\u5DF2\u66F4\u65B0

${key} = ${JSON.stringify(parsedValue)}`;
    await sendMessageSmart(token, authorId, replyMsg2, usageInfo);
    log("green", `   \u2705 \u5DF2\u66F4\u65B0\u914D\u7F6E: ${key} = ${JSON.stringify(parsedValue)}`);
    return;
  }
  if (trimmedContent === "\u91CD\u7F6E\u914D\u7F6E") {
    const token = await getAccessToken2();
    const usageInfo = incrementMsgIdUsage(authorId);
    resetHeadlessConfig(authorId);
    const replyMsg2 = `\u2705 \u914D\u7F6E\u5DF2\u91CD\u7F6E\u4E3A\u9ED8\u8BA4\u503C

\u6A21\u578B: claude-sonnet-4-6
\u5DE5\u5177: Read, Grep, Glob, Bash`;
    await sendMessageSmart(token, authorId, replyMsg2, usageInfo);
    log("green", `   \u2705 \u5DF2\u91CD\u7F6E\u914D\u7F6E`);
    return;
  }
  if (trimmedContent === "status" || trimmedContent === "\u72B6\u6001") {
    const gatewayState = loadGatewayState();
    const hookConfig = HOOK_MESSAGE_CONFIG;
    const hookCacheStatus = getHookCacheStatus();
    const authStats = getAuthorizationStats();
    let replyMsg2 = `\u{1F4CB} \u7C4B\u5173\u914D\u7F6E\u72B6\u6001
`;
    replyMsg2 += `\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
`;
    replyMsg2 += `\u{1F527} \u8FD0\u884C\u65F6:
`;
    replyMsg2 += `  \u6A21\u5F0F: ${gatewayState.mode}
`;
    replyMsg2 += `  PID: ${gatewayState.pid || process.pid}
`;
    if (gatewayState.startedAt) {
      replyMsg2 += `  \u8FD0\u884C\u65F6\u95F4: ${formatUptime(Date.now() - gatewayState.startedAt)}
`;
    }
    replyMsg2 += `
\u{1F4EC} Hook \u63A8\u9001:
`;
    const hookEnabled = getHookNotifyEnabled();
    replyMsg2 += `  \u5168\u5C40\u5F00\u5173: ${hookEnabled ? "\u2705 \u5F00\u542F" : "\u{1F515} \u5173\u95ED"}
`;
    replyMsg2 += `  \u6279\u91CF\u8D85\u65F6: ${hookConfig.batchTimeoutMs}ms
`;
    replyMsg2 += `  \u6700\u5927\u7B49\u5F85: ${hookConfig.maxBatchWaitMs}ms
`;
    replyMsg2 += `  \u538B\u7F29\u9608\u503C: ${hookConfig.compressThreshold}\u5B57\u8282
`;
    replyMsg2 += `  \u538B\u7F29\u8D85\u65F6: ${hookConfig.compressTimeoutMs}ms
`;
    replyMsg2 += `
\u{1F4E6} \u6D88\u606F\u7F13\u5B58:
`;
    replyMsg2 += `  \u7F13\u5B58\u6D88\u606F: ${hookCacheStatus.totalCachedMessages} \u6761
`;
    replyMsg2 += `  \u7F13\u5B58\u7528\u6237: ${hookCacheStatus.cachedUsers} \u4E2A
`;
    replyMsg2 += `  \u538B\u7F29\u540E\u4E0A\u9650: ${hookCacheStatus.config.compressedMaxSize}\u5B57\u8282
`;
    replyMsg2 += `
\u{1F4E1} Channel \u6A21\u5F0F:
`;
    replyMsg2 += `  \u542F\u7528: ${gatewayState.channel?.enabled ? "\u2705" : "\u274C"}
`;
    replyMsg2 += `  \u6A21\u5F0F: ${gatewayState.channel?.mode || "\u65E0"}
`;
    replyMsg2 += `  \u5DF2\u6CE8\u518C: ${channelRegistry.size} \u4E2A
`;
    replyMsg2 += `
\u{1F510} \u6388\u6743\u7BA1\u7406:
`;
    replyMsg2 += `  \u5DF2\u6388\u6743\u7528\u6237: ${authStats.totalUsers} \u4EBA
`;
    replyMsg2 += `  MCP \u5DE5\u5177\u6388\u6743: ${authStats.mcpToolUsers} \u4EBA
`;
    replyMsg2 += `  \u6587\u4EF6\u8DEF\u5F84\u6388\u6743: ${authStats.filePathUsers} \u4EBA
`;
    replyMsg2 += `  \u767D\u540D\u5355: ${gatewayState.authorization?.whitelist?.length || 0} \u4EBA
`;
    replyMsg2 += `
\u{1F4A1} \u53D1\u9001 "help <\u914D\u7F6E\u9879>" \u67E5\u770B\u8BE6\u7EC6\u8BF4\u660E`;
    replyMsg2 += `
   \u53EF\u7528: help hook, help cache, help channel, help auth`;
    const token = await getAccessToken2();
    const usageInfo = incrementMsgIdUsage(authorId);
    await sendMessageSmart(token, authorId, replyMsg2, usageInfo);
    log("green", `   \u2705 \u5DF2\u8FD4\u56DE\u6269\u5C55\u72B6\u6001`);
    return;
  }
  const helpMatch = trimmedContent.match(/^help\s*(.*)$/i);
  if (helpMatch) {
    const topic = helpMatch[1].toLowerCase().trim();
    let replyMsg2 = "";
    if (!topic || topic === "all") {
      replyMsg2 = `\u{1F4D6} QQ Bot \u7F51\u5173\u5E2E\u52A9
`;
      replyMsg2 += `\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501

`;
      replyMsg2 += `\u26A1 \u5FEB\u6377\u6388\u6743:
`;
      replyMsg2 += `  \u6388\u6743\u5168\u90E8  \u6388\u6743mcp  \u5141\u8BB8\u5168\u90E8

`;
      replyMsg2 += `\u{1F4CB} \u547D\u4EE4\u5217\u8868:
`;
      replyMsg2 += `  status - \u67E5\u770B\u72B6\u6001\u548C\u914D\u7F6E
`;
      replyMsg2 += `  hook on/off/status - Hook \u5F00\u5173\u63A7\u5236
`;
      replyMsg2 += `  \u67E5\u770Bhook\u7F13\u5B58 - \u67E5\u770B\u7F13\u5B58\u8BE6\u60C5
`;
      replyMsg2 += `  \u67E5\u770B\u6388\u6743 - \u67E5\u770B\u6388\u6743\u72B6\u6001
`;
      replyMsg2 += `  \u67E5\u770Bchannel - \u67E5\u770B\u6D3B\u8DC3\u4F1A\u8BDD
`;
      replyMsg2 += `
\u{1F4DA} \u914D\u7F6E\u8BF4\u660E:
`;
      replyMsg2 += `  help hook - Hook \u63A8\u9001\u914D\u7F6E
`;
      replyMsg2 += `  help channel - Channel \u6A21\u5F0F
`;
      replyMsg2 += `  help cache - \u6D88\u606F\u7F13\u5B58
`;
      replyMsg2 += `  help auth - \u6388\u6743\u7BA1\u7406
`;
      replyMsg2 += `  help compress - \u6D88\u606F\u538B\u7F29
`;
    } else if (topic === "hook") {
      replyMsg2 = `\u{1F4D6} Hook \u63A8\u9001\u914D\u7F6E
`;
      replyMsg2 += `\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501

`;
      replyMsg2 += `Hook \u6D88\u606F\u662F Claude Code \u89E6\u53D1\u4E8B\u4EF6\u65F6\u63A8\u9001\u5230 QQ \u7684\u901A\u77E5\u3002

`;
      replyMsg2 += `\u{1F527} \u914D\u7F6E\u9879:
`;
      replyMsg2 += `  \u2022 \u5168\u5C40\u5F00\u5173: hook on/off
`;
      replyMsg2 += `  \u2022 \u6279\u91CF\u8D85\u65F6: \u591A\u5C11\u6BEB\u79D2\u540E\u5408\u5E76\u53D1\u9001
`;
      replyMsg2 += `  \u2022 \u538B\u7F29\u9608\u503C: \u8D85\u8FC7\u591A\u5C11\u5B57\u8282\u542F\u52A8\u538B\u7F29
`;
      replyMsg2 += `  \u2022 \u538B\u7F29\u8D85\u65F6: \u538B\u7F29\u64CD\u4F5C\u6700\u957F\u7B49\u5F85\u65F6\u95F4

`;
      replyMsg2 += `\u{1F4A1} \u793A\u4F8B:
`;
      replyMsg2 += `  hook off - \u4E34\u65F6\u5173\u95ED\u63A8\u9001
`;
      replyMsg2 += `  hook status - \u67E5\u770B\u5F53\u524D\u72B6\u6001`;
    } else if (topic === "channel") {
      replyMsg2 = `\u{1F4D6} Channel \u6A21\u5F0F
`;
      replyMsg2 += `\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501

`;
      replyMsg2 += `Channel \u6A21\u5F0F\u5141\u8BB8\u591A\u4E2A Claude Code \u4F1A\u8BDD\u540C\u65F6\u63A5\u6536 QQ \u6D88\u606F\u3002

`;
      replyMsg2 += `\u{1F4E1} \u5DE5\u4F5C\u539F\u7406:
`;
      replyMsg2 += `  1. MCP Server \u542F\u52A8\u65F6\u6CE8\u518C\u5230 Gateway
`;
      replyMsg2 += `  2. Gateway \u8DEF\u7531\u6D88\u606F\u5230\u5BF9\u5E94 Channel
`;
      replyMsg2 += `  3. \u6BCF\u4E2A Channel \u72EC\u7ACB\u5904\u7406\u6D88\u606F

`;
      replyMsg2 += `\u{1F4AC} \u6D88\u606F\u524D\u7F00:
`;
      replyMsg2 += `  \u53D1\u9001 [\u9879\u76EE\u540D] \u6D88\u606F \u53EF\u6307\u5B9A\u76EE\u6807 Channel
`;
      replyMsg2 += `  \u56DE\u590D\u6D88\u606F\u81EA\u52A8\u6DFB\u52A0 [sessionId] \u524D\u7F00

`;
      replyMsg2 += `\u{1F4A1} \u542F\u52A8\u65B9\u5F0F:
`;
      replyMsg2 += `  /qqbot-service start --mode auto --channel gateway-bridge`;
    } else if (topic === "cache" || topic === "compress") {
      replyMsg2 = `\u{1F4D6} \u6D88\u606F\u7F13\u5B58\u4E0E\u538B\u7F29
`;
      replyMsg2 += `\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501

`;
      replyMsg2 += `Hook \u6D88\u606F\u652F\u6301\u81EA\u52A8\u7F13\u5B58\u548C\u538B\u7F29\uFF0C\u907F\u514D\u53D1\u9001\u8FC7\u957F\u5185\u5BB9\u3002

`;
      replyMsg2 += `\u{1F4E6} \u7F13\u5B58\u673A\u5236:
`;
      replyMsg2 += `  \u2022 \u591A\u6761\u6D88\u606F\u81EA\u52A8\u5408\u5E76
`;
      replyMsg2 += `  \u2022 \u8D85\u8FC7\u6279\u91CF\u8D85\u65F6\u540E\u53D1\u9001
`;
      replyMsg2 += `  \u2022 \u6700\u5927\u7B49\u5F85\u65F6\u95F4\u9650\u5236

`;
      replyMsg2 += `\u{1F5DC}\uFE0F \u538B\u7F29\u6D41\u7A0B:
`;
      replyMsg2 += `  1. \u8D85\u8FC7\u9608\u503C\u542F\u52A8 Claude headless \u538B\u7F29
`;
      replyMsg2 += `  2. \u538B\u7F29\u5931\u8D25\u65F6\u53D1\u9001\u7B80\u5316\u7248\u672C
`;
      replyMsg2 += `  3. \u538B\u7F29\u8D85\u65F6\u81EA\u52A8\u964D\u7EA7

`;
      replyMsg2 += `\u2699\uFE0F \u914D\u7F6E:
`;
      replyMsg2 += `  \u9ED8\u8BA4\u538B\u7F29\u9608\u503C: 300 \u5B57\u8282
`;
      replyMsg2 += `  \u9ED8\u8BA4\u538B\u7F29\u8D85\u65F6: 30000ms`;
    } else if (topic === "auth" || topic === "authorization") {
      replyMsg2 = `\u{1F4D6} \u6388\u6743\u7BA1\u7406 - \u5B8C\u6574\u6307\u5357
`;
      replyMsg2 += `\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501

`;
      replyMsg2 += `\u6388\u6743\u5141\u8BB8 Claude \u5728\u4F60\u7684\u9879\u76EE\u4E2D\u6267\u884C\u64CD\u4F5C\u3002

`;
      replyMsg2 += `\u26A1 \u5FEB\u6377\u6388\u6743 (\u63A8\u8350):
`;
      replyMsg2 += `\u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510
`;
      replyMsg2 += `\u2502  \u53D1\u9001\u4EE5\u4E0B\u4EFB\u4E00\u5173\u952E\u8BCD\u5373\u53EF\u6388\u6743  \u2502
`;
      replyMsg2 += `\u251C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2524
`;
      replyMsg2 += `\u2502  \u6388\u6743\u5168\u90E8  \u6388\u6743mcp  \u5141\u8BB8\u5168\u90E8 \u2502
`;
      replyMsg2 += `\u2502  \u5168\u90E8\u6388\u6743  \u5141\u8BB8mcp  \u6388\u6743\u5DE5\u5177 \u2502
`;
      replyMsg2 += `\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518

`;
      replyMsg2 += `\u{1F510} \u6388\u6743\u8303\u56F4\u8BF4\u660E:
`;
      replyMsg2 += `\u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510
`;
      replyMsg2 += `\u2502 MCP \u5DE5\u5177 (*)                        \u2502
`;
      replyMsg2 += `\u2502  \u2022 \u8BFB\u53D6\u6587\u4EF6 (Read)                  \u2502
`;
      replyMsg2 += `\u2502  \u2022 \u641C\u7D22\u4EE3\u7801 (Grep/Glob)             \u2502
`;
      replyMsg2 += `\u2502  \u2022 \u6267\u884C\u547D\u4EE4 (Bash)                  \u2502
`;
      replyMsg2 += `\u2502  \u2022 \u7F16\u8F91\u6587\u4EF6 (Edit/Write)            \u2502
`;
      replyMsg2 += `\u2502  \u2022 \u6240\u6709 MCP \u6269\u5C55\u5DE5\u5177                \u2502
`;
      replyMsg2 += `\u251C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2524
`;
      replyMsg2 += `\u2502 \u6587\u4EF6\u8DEF\u5F84 (/path/*)                  \u2502
`;
      replyMsg2 += `\u2502  \u2022 \u5141\u8BB8\u8BBF\u95EE\u6307\u5B9A\u76EE\u5F55\u4E0B\u7684\u6587\u4EF6         \u2502
`;
      replyMsg2 += `\u2502  \u2022 \u4F7F\u7528\u901A\u914D\u7B26 * \u5339\u914D\u6240\u6709\u5B50\u76EE\u5F55      \u2502
`;
      replyMsg2 += `\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518

`;
      replyMsg2 += `\u{1F4DD} \u8BE6\u7EC6\u547D\u4EE4:
`;
      replyMsg2 += `  \u6388\u6743\u5DE5\u5177: *           - \u5168\u90E8\u5DE5\u5177
`;
      replyMsg2 += `  \u6388\u6743\u5DE5\u5177: mcp:*       - \u5168\u90E8 MCP \u5DE5\u5177
`;
      replyMsg2 += `  \u6388\u6743\u8DEF\u5F84: /home/user  - \u6307\u5B9A\u76EE\u5F55
`;
      replyMsg2 += `  \u6388\u6743\u8DEF\u5F84: /*          - \u5168\u90E8\u76EE\u5F55

`;
      replyMsg2 += `\u{1F50D} \u67E5\u8BE2\u547D\u4EE4:
`;
      replyMsg2 += `  \u67E5\u770B\u6388\u6743  \u6211\u7684\u6388\u6743  \u6388\u6743\u72B6\u6001

`;
      replyMsg2 += `\u{1F4A1} \u9996\u6B21\u4F7F\u7528\u5EFA\u8BAE\u76F4\u63A5\u53D1\u9001 "\u6388\u6743\u5168\u90E8"`;
    } else {
      replyMsg2 = `\u274C \u672A\u627E\u5230 "${topic}" \u7684\u5E2E\u52A9

`;
      replyMsg2 += `\u{1F4A1} \u53EF\u7528\u4E3B\u9898: hook, channel, cache, auth, compress`;
    }
    const token = await getAccessToken2();
    const usageInfo = incrementMsgIdUsage(authorId);
    await sendMessageSmart(token, authorId, replyMsg2, usageInfo);
    log("green", `   \u2705 \u5DF2\u8FD4\u56DE\u5E2E\u52A9\u4FE1\u606F: ${topic || "all"}`);
    return;
  }
  if (content === "\u67E5\u770Bchannel" || content === "\u67E5\u770Bsession" || content === "channel\u5217\u8868") {
    let replyMsg2 = `\u{1F4E1} \u5DF2\u6CE8\u518C\u7684 Channel:
`;
    replyMsg2 += `\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501

`;
    if (channelRegistry.size === 0) {
      replyMsg2 += `\u6682\u65E0\u6D3B\u8DC3\u7684 Channel

`;
      replyMsg2 += `\u{1F4A1} \u8BF7\u5728 Claude Code \u4E2D\u542F\u52A8 MCP Server \u4EE5\u6CE8\u518C Channel`;
    } else {
      for (const [sessionId, info] of channelRegistry) {
        const displayName = info.displayName || info.projectName || sessionId;
        replyMsg2 += `\u{1F539} ${displayName}
`;
        replyMsg2 += `   sessionId: ${sessionId}
`;
        replyMsg2 += `   \u9879\u76EE: ${info.projectName || "\u672A\u77E5"}
`;
        replyMsg2 += `   \u8DEF\u5F84: ${info.projectPath || "\u672A\u77E5"}
`;
        replyMsg2 += `   ${info.isDefault ? "\u2705 \u9ED8\u8BA4" : ""}
`;
        replyMsg2 += `   \u9C9C\u6D3B: ${Date.now() - info.lastActive < 6e4 ? "\u2705" : "\u26A0\uFE0F \u8D85\u65F6\u672A\u6D3B\u8DC3"}

`;
      }
      replyMsg2 += `
\u{1F4AC} \u4F7F\u7528\u65B9\u5F0F:
`;
      replyMsg2 += `  \u53D1\u9001 [sessionId] \u6D88\u606F\u5185\u5BB9 \u53EF\u6307\u5B9A\u76EE\u6807 Channel
`;
      if (defaultChannelId) {
        replyMsg2 += `  \u65E0\u524D\u7F00\u6D88\u606F\u5C06\u53D1\u9001\u5230\u9ED8\u8BA4 Channel
`;
      }
    }
    const token = await getAccessToken2();
    const usageInfo = incrementMsgIdUsage(authorId);
    await sendMessageSmart(token, authorId, replyMsg2, usageInfo);
    log("green", `   \u2705 \u5DF2\u8FD4\u56DE Channel \u5201\u8868\u4FE1\u606F`);
    return;
  }
  const parsed = parseMessage2(content);
  log("cyan", `   \u89E3\u6790\u7ED3\u679C: \u9879\u76EE=${parsed.projectName || "\u9ED8\u8BA4"}, cwd=${parsed.cwd || "\u65E0"}`);
  if (hasActiveChannels()) {
    const { targetSessionId, cleanContent } = resolveChannel(finalContent);
    if (targetSessionId) {
      addMessageToChannelQueue(targetSessionId, {
        sourceType: type,
        sourceId: type === "group" ? groupId : authorId,
        authorId,
        authorNickname,
        content: cleanContent,
        msgId,
        messageReference
      });
      const channelInfo = channelRegistry.get(targetSessionId);
      log("green", `   \u{1F4E8} \u6D88\u606F\u5DF2\u8DEF\u7531\u5230 Channel: ${targetSessionId} (${channelInfo?.projectName || "\u672A\u77E5\u9879\u76EE"})`);
      log("cyan", `   \u{1F4CA} Channel \u961F\u5217: ${channelQueues.get(targetSessionId)?.length || 0} \u6761\u5F85\u5904\u7406`);
      if (channelRegistry.size > 1) {
        const token = await getAccessToken2();
        const usageInfo = incrementMsgIdUsage(authorId);
        const channelDisplayName = channelInfo?.displayName || channelInfo?.projectName || targetSessionId;
        await sendMessageSmart(token, authorId, `\u2705 \u6D88\u606F\u5DF2\u63A8\u9001\u5230 Channel: ${channelDisplayName}`, usageInfo);
      }
      return;
    } else {
      const gatewayState = loadGatewayState();
      const channelConfigured = gatewayState?.channel?.enabled;
      if (channelConfigured) {
        log("yellow", `   \u26A0\uFE0F Channel \u6A21\u5F0F\u5DF2\u542F\u7528\u4F46\u65E0\u6D3B\u8DC3\u4F1A\u8BDD`);
        const token = await getAccessToken2();
        const usageInfo = incrementMsgIdUsage(authorId);
        await sendMessageSmart(
          token,
          authorId,
          `\u26A0\uFE0F \u5F53\u524D\u6CA1\u6709\u6D3B\u8DC3\u7684 Channel \u4F1A\u8BDD

\u8BF7\u5728 Claude Code \u4E2D\u542F\u52A8 MCP Server \u4EE5\u63A5\u6536\u6D88\u606F\u3002`,
          usageInfo
        );
        return;
      }
      log("yellow", `   \u26A0\uFE0F \u65E0\u53EF\u7528 Channel\uFF0C\u56DE\u9000\u5230 Headless \u6A21\u5F0F`);
    }
  }
  if (mode === "notify") {
    log("yellow", "   \u{1F4E2} \u901A\u77E5\u6A21\u5F0F\uFF1A\u53D1\u9001\u684C\u9762\u901A\u77E5");
    await sendDesktopNotification(
      `QQ Bot ${type === "private" ? "\u79C1\u804A" : "\u7FA4\u804A"}`,
      `[${parsed.projectName || "\u9ED8\u8BA4"}] ${content.slice(0, 50)}`
    );
  } else if (mode === "auto") {
    const taskData = {
      projectName: parsed.projectName || "\u9ED8\u8BA4",
      cwd: parsed.cwd,
      authorId,
      msgId,
      content: finalContent,
      // 使用合并后的内容（包含引用上下文）
      parsed
    };
    enqueueTask(taskData);
    await startQueueProcessing();
  }
}
async function processWithClaude(parsed, authorId, msgId, originalContent) {
  const projectName = parsed.projectName;
  const cwd = parsed.cwd;
  if (!cwd) {
    log("yellow", "   \u26A0\uFE0F \u65E0\u6CD5\u627E\u5230\u9879\u76EE\u76EE\u5F55\uFF0C\u8DF3\u8FC7\u5904\u7406");
    return;
  }
  const { sessionId, isNew } = await getOrCreateHeadlessSessionId(authorId);
  const sessionInfo = isNew ? "\u65B0\u4F1A\u8BDD" : `resume: ${sessionId.slice(0, 12)}...`;
  log("cyan", `   \u{1F916} \u8C03\u7528 Claude Code Headless (cwd: ${cwd}, ${sessionInfo})`);
  const args2 = buildClaudeArgs(parsed, isNew ? null : sessionId);
  const gatewayState = loadGatewayState();
  const channelEnabled = gatewayState?.channel?.enabled === true;
  const channelMode = gatewayState?.channel?.mode || "none";
  const activeChannels = channelRegistry.size;
  const activeChannelList = Array.from(channelRegistry.entries()).map(([id, info]) => `${info.displayName || info.projectName} (${id.slice(0, 8)}...)`).join(", ");
  const commMode = channelEnabled ? `Channel (${channelMode})` : "\u6807\u51C6 WebSocket (Headless)";
  const systemContext = `[\u7CFB\u7EDF\u4E0A\u4E0B\u6587]
- \u901A\u4FE1\u6A21\u5F0F: ${commMode}
- Channel \u5DF2\u542F\u7528: ${channelEnabled ? "\u662F" : "\u5426"}
- \u6D3B\u8DC3 Channel \u6570: ${activeChannels}
` + (activeChannelList ? `- \u6D3B\u8DC3\u5217\u8868: ${activeChannelList}` : "");
  const prompt = "[QQ \u6D88\u606F - \u9879\u76EE: " + projectName + "]\n" + originalContent + "\n\n" + systemContext + "\n\u8BF7\u5904\u7406\u8FD9\u6761\u6D88\u606F\uFF0C\u5E76\u7ED9\u51FA\u7B80\u6D01\u7684\u56DE\u590D\u3002";
  const userActivation = getUserActivation(authorId);
  let cachedToken = null;
  try {
    cachedToken = await getAccessToken2();
  } catch (e) {
    log("yellow", `   \u26A0\uFE0F \u65E0\u6CD5\u83B7\u53D6 token\uFF0C\u5FC3\u8DF3\u529F\u80FD\u5C06\u53D7\u9650`);
  }
  try {
    const child = spawn("claude", args2, {
      cwd,
      env: { ...process.env, CLAUDECODE: void 0 },
      stdio: ["pipe", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    let heartbeatCount = 0;
    let lastHeartbeatContent = "";
    let heartbeatStopped = false;
    const heartbeatInterval = setInterval(async () => {
      if (heartbeatStopped) return;
      heartbeatCount++;
      const elapsedSeconds = heartbeatCount * 30;
      const heartbeatContent = `\u23F3 \u6B63\u5728\u5904\u7406\u4E2D... (${Math.floor(elapsedSeconds / 60)}\u5206${elapsedSeconds % 60}\u79D2)`;
      if (heartbeatContent !== lastHeartbeatContent && cachedToken) {
        lastHeartbeatContent = heartbeatContent;
        try {
          const usageInfo = getUserActivationStatus(authorId);
          if (usageInfo && usageInfo.msgId) {
            await sendC2CMessage2(cachedToken, authorId, heartbeatContent, usageInfo.msgId);
            log("cyan", `   \u{1F493} \u5FC3\u8DF3\u6D88\u606F\u5DF2\u53D1\u9001 (${elapsedSeconds}\u79D2)`);
          }
        } catch (e) {
          log("yellow", `   \u26A0\uFE0F \u5FC3\u8DF3\u6D88\u606F\u53D1\u9001\u5931\u8D25: ${e.message}`);
        }
      }
    }, 3e4);
    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });
    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });
    child.stdin.write(prompt);
    child.stdin.end();
    const timeout = setTimeout(() => {
      heartbeatStopped = true;
      clearInterval(heartbeatInterval);
      log("yellow", `   \u23F0 \u5904\u7406\u8D85\u65F6 (5\u5206\u949F)\uFF0C\u7EC8\u6B62\u8FDB\u7A0B...`);
      child.kill();
    }, 3e5);
    child.on("close", async (code) => {
      heartbeatStopped = true;
      clearTimeout(timeout);
      clearInterval(heartbeatInterval);
      if (code === 0 && stdout.trim()) {
        let replyContent = stdout.trim();
        let extractedSessionId = null;
        try {
          const lines = stdout.split("\n").filter((l) => l.trim());
          const contents = [];
          for (const line of lines) {
            const json = JSON.parse(line);
            if (json.session_id && !extractedSessionId) {
              extractedSessionId = json.session_id;
            }
            if (json.type === "content") {
              if (json.text) {
                contents.push(json.text);
              } else if (json.content) {
                contents.push(json.content);
              }
            } else if (json.type === "result" && json.result) {
              contents.push(json.result);
            }
          }
          if (contents.length > 0) {
            replyContent = contents.join("");
          }
          if (isNew && extractedSessionId) {
            updateHeadlessSessionId(authorId, extractedSessionId);
          }
        } catch (e) {
          if (!stdout.startsWith("{")) {
            replyContent = stdout.trim();
          }
        }
        replyContent = replyContent.trim();
        if (!replyContent || replyContent.length < 2) {
          replyContent = "\u6D88\u606F\u5DF2\u6536\u5230\uFF0C\u5904\u7406\u5B8C\u6210\u3002";
        }
        const hasMediaTags = /<(qqimg|qqvoice|qqvideo|qqfile)>/i.test(replyContent);
        if (!hasMediaTags && replyContent.length > 2e3) {
          replyContent = replyContent.slice(0, 1997) + "...";
        }
        log("green", `   \u751F\u6210\u56DE\u590D: "${replyContent.slice(0, 80)}..."`);
        const usageInfo = incrementMsgIdUsage(authorId);
        if (replyContent.includes("\u6743\u9650\u5C1A\u672A\u6388\u6743") || replyContent.includes("\u5DE5\u5177\u6743\u9650")) {
          log("yellow", `   \u26A0\uFE0F \u68C0\u6D4B\u5230\u6743\u9650\u95EE\u9898\uFF0C\u53D1\u9001\u6388\u6743\u6307\u5F15...`);
          const permissionGuide = `\u26A0\uFE0F \u9700\u8981\u6388\u6743

${replyContent}

\u26A1 \u5FEB\u6377\u6388\u6743: \u53D1\u9001 "\u6388\u6743\u5168\u90E8" \u6216 "\u6388\u6743mcp"`;
          const token2 = await getAccessToken2();
          const permResult = await sendMessageSmart(token2, authorId, permissionGuide, usageInfo);
          if (permResult.success) {
            const methodText = permResult.method === "passive" ? `\u88AB\u52A8\u56DE\u590D (\u5269\u4F59 ${permResult.remaining} \u6B21)` : "\u4E3B\u52A8\u6D88\u606F";
            log("green", `   \u2705 \u6743\u9650\u6307\u5F15\u5DF2\u53D1\u9001 [${methodText}]`);
          } else {
            log("yellow", `   \u26A0\uFE0F \u6743\u9650\u6307\u5F15\u53D1\u9001\u5931\u8D25: ${permResult.error}`);
          }
          return;
        }
        const token = await getAccessToken2();
        const result = await sendRichMessageSmart(token, authorId, replyContent, usageInfo, projectName);
        if (result && result.success) {
          const methodText = result.method === "passive" ? `\u88AB\u52A8\u56DE\u590D (\u5269\u4F59 ${result.remaining} \u6B21)` : "\u4E3B\u52A8\u6D88\u606F";
          log("green", `   \u2705 \u56DE\u590D\u5DF2\u53D1\u9001 [${methodText}]`);
          if (result.id) {
            saveMessageHistory({
              msgId: result.id,
              openid: authorId,
              content: replyContent,
              role: "bot"
            });
          }
        } else {
          log("yellow", `   \u26A0\uFE0F \u56DE\u590D\u53D1\u9001\u5931\u8D25: ${result?.error || JSON.stringify(result)}`);
        }
      } else {
        const errorInfo = classifyHeadlessError(code, stderr, stdout);
        log("yellow", `   \u26A0\uFE0F \u5904\u7406\u5931\u8D25 (${errorInfo.type}): ${errorInfo.reason}`);
        if (stdout.trim()) {
          log("yellow", `   stdout: ${stdout.slice(0, 500)}`);
        } else {
          log("yellow", `   stdout: (\u7A7A)`);
        }
        if (stderr.trim()) {
          log("yellow", `   stderr: ${stderr.slice(0, 500)}`);
        }
        const errorUsageInfo = incrementMsgIdUsage(authorId);
        const token = await getAccessToken2();
        const errorResult = await sendMessageSmart(token, authorId, `[${projectName}] ${errorInfo.userMessage}`, errorUsageInfo);
        if (errorResult.success) {
          const methodText = errorResult.method === "passive" ? `\u88AB\u52A8\u56DE\u590D (\u5269\u4F59 ${errorResult.remaining} \u6B21)` : "\u4E3B\u52A8\u6D88\u606F";
          log("green", `   \u2705 \u9519\u8BEF\u56DE\u590D\u5DF2\u53D1\u9001 [${methodText}]`);
        } else {
          log("yellow", `   \u26A0\uFE0F \u9519\u8BEF\u56DE\u590D\u53D1\u9001\u5931\u8D25: ${errorResult.error}`);
        }
      }
    });
    child.on("error", (err) => {
      clearTimeout(timeout);
      log("red", `   \u274C \u8FDB\u7A0B\u9519\u8BEF: ${err.message}`);
    });
  } catch (error) {
    log("red", `   \u274C \u5904\u7406\u9519\u8BEF: ${error.message}`);
  }
}
async function sendDesktopNotification(title, message) {
  const platform = process.platform;
  if (platform === "linux") {
    try {
      await spawn("notify-send", [title, message]);
    } catch (e) {
    }
  } else if (platform === "darwin") {
    try {
      await spawn("osascript", ["-e", `display notification "${message}" with title "${title}"`]);
    } catch (e) {
    }
  }
}
function stopGateway() {
  running = false;
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
  if (healthCheckTimer) {
    clearInterval(healthCheckTimer);
    healthCheckTimer = null;
  }
  if (expirationCheckTimer) {
    clearInterval(expirationCheckTimer);
    expirationCheckTimer = null;
  }
  stopHookBatchTimer();
  if (ws) {
    ws.close();
    ws = null;
  }
  if (fs3.existsSync(PID_FILE)) {
    fs3.unlinkSync(PID_FILE);
  }
  setGatewayStatus("pending_activation");
  startupAttempts = 0;
  consecutiveFailures = 0;
  log("yellow", "\u{1F44B} \u7F51\u5173\u5DF2\u505C\u6B62");
}
var expirationCheckTimer = null;
function initActivationState() {
  const state = loadActivationState();
  const activeUsers = getActiveUsers();
  if (activeUsers.length > 0) {
    setGatewayStatus("activated");
    log("cyan", `   \u{1F4CB} \u6FC0\u6D3B\u72B6\u6001: \u5DF2\u6709 ${activeUsers.length} \u4E2A\u6FC0\u6D3B\u7528\u6237`);
  } else {
    setGatewayStatus("pending_activation");
    log("cyan", `   \u{1F4CB} \u6FC0\u6D3B\u72B6\u6001: \u7B49\u5F85\u6FC0\u6D3B`);
  }
  cleanupExpiredUsers();
}
function startExpirationChecker() {
  const CHECK_INTERVAL_MS = 30 * 1e3;
  expirationCheckTimer = setInterval(async () => {
    if (!running) return;
    try {
      const usersNeedingReminder = getUsersNeedingReminder();
      for (const { user, reminderPoint } of usersNeedingReminder) {
        log("yellow", `   \u23F0 \u7528\u6237 ${user.nickname || user.openid} \u4F1A\u8BDD\u5373\u5C06\u8FC7\u671F (${reminderPoint} \u5206\u949F)`);
        try {
          const reminder = `\u26A0\uFE0F \u4F1A\u8BDD\u5373\u5C06\u8FC7\u671F

\u60A8\u7684\u4F1A\u8BDD\u5C06\u5728 ${reminderPoint} \u5206\u949F\u540E\u8FC7\u671F\uFF0C\u5C4A\u65F6\u5C06\u65E0\u6CD5\u63A5\u6536\u901A\u77E5\u6D88\u606F\u3002

\u8BF7\u53D1\u9001\u4EFB\u610F\u6D88\u606F\u4FDD\u6301\u6FC0\u6D3B\u72B6\u6001\u3002`;
          const token = await getAccessToken2();
          const usageInfo = incrementMsgIdUsage(user.openid);
          const result = await sendMessageSmart(token, user.openid, reminder, usageInfo);
          if (result.success) {
            markReminderSent(user.openid, reminderPoint);
            const methodText = result.method === "passive" ? "\u88AB\u52A8\u56DE\u590D" : "\u4E3B\u52A8\u6D88\u606F";
            log("green", `   \u2705 \u8FC7\u671F\u63D0\u9192\u5DF2\u53D1\u9001\u7ED9 ${user.nickname || user.openid} [${methodText}] (${reminderPoint} \u5206\u949F)`);
          } else {
            log("yellow", `   \u26A0\uFE0F \u53D1\u9001\u8FC7\u671F\u63D0\u9192\u5931\u8D25: ${result.error}`);
          }
        } catch (err) {
          log("yellow", `   \u26A0\uFE0F \u53D1\u9001\u8FC7\u671F\u63D0\u9192\u5F02\u5E38: ${err.message}`);
        }
      }
      cleanupExpiredUsers();
      await checkAndCompressExpiredMessages();
      const globalConfig = getGlobalTimeoutConfig();
      if (globalConfig.enableExpiryReminder) {
        const expiringAuths = getExpiringAuthorizations(1);
        for (const auth of expiringAuths) {
          if (auth.status === "expired") {
            log("yellow", `   \u26A0\uFE0F \u7528\u6237 ${auth.nickname || auth.openid} \u7684\u6388\u6743\u5DF2\u8FC7\u671F: ${auth.authType}/${auth.resource}`);
          } else {
            const minutesLeft = Math.round((auth.expiresAt - Date.now()) / (60 * 1e3));
            log("yellow", `   \u23F0 \u7528\u6237 ${auth.nickname || auth.openid} \u6388\u6743\u5373\u5C06\u8FC7\u671F (${minutesLeft} \u5206\u949F): ${auth.authType}/${auth.resource}`);
            try {
              const token = await getAccessToken2();
              const usageInfo = incrementMsgIdUsage(auth.openid);
              const reminderMsg = `\u26A0\uFE0F \u6388\u6743\u5373\u5C06\u8FC7\u671F

\u60A8\u6388\u6743\u7684\u300C${auth.resource}\u300D\u5C06\u5728 ${minutesLeft} \u5206\u949F\u540E\u8FC7\u671F\u3002

\u8FC7\u671F\u540E\u9700\u8981\u91CD\u65B0\u6388\u6743\u624D\u80FD\u4F7F\u7528\u76F8\u5173\u529F\u80FD\u3002

\u5982\u9700\u5EF6\u957F\u6709\u6548\u671F\uFF0C\u8BF7\u53D1\u9001:
\u2022 "\u6388\u6743\u5168\u90E8" - \u91CD\u65B0\u6388\u6743\u6240\u6709\u529F\u80FD`;
              const result = await sendMessageSmart(token, auth.openid, reminderMsg, usageInfo);
              if (result.success) {
                log("green", `   \u2705 \u6388\u6743\u8FC7\u671F\u63D0\u9192\u5DF2\u53D1\u9001\u7ED9 ${auth.nickname || auth.openid}`);
              }
            } catch (err) {
              log("yellow", `   \u26A0\uFE0F \u53D1\u9001\u6388\u6743\u8FC7\u671F\u63D0\u9192\u5F02\u5E38: ${err.message}`);
            }
          }
        }
        const cleanedCount = cleanupExpiredAuthorizations();
        if (cleanedCount > 0) {
          log("cyan", `   \u{1F9F9} \u5DF2\u6E05\u7406 ${cleanedCount} \u4E2A\u8FC7\u671F\u6388\u6743`);
        }
      }
    } catch (err) {
      log("red", `   \u274C \u8FC7\u671F\u68C0\u67E5\u51FA\u9519: ${err.message}`);
    }
  }, CHECK_INTERVAL_MS);
  log("cyan", `   \u23F0 \u8FC7\u671F\u68C0\u67E5\u5B9A\u65F6\u5668\u5DF2\u542F\u52A8 (\u95F4\u9694: ${CHECK_INTERVAL_MS / 1e3} \u79D2, \u63D0\u9192\u65F6\u95F4\u70B9: 5/3/1 \u5206\u949F)`);
  log("cyan", `   \u{1F510} \u6388\u6743\u8FC7\u671F\u63D0\u9192: ${getGlobalTimeoutConfig().enableExpiryReminder ? "\u5DF2\u542F\u7528" : "\u5DF2\u7981\u7528"}`);
}
function mergePendingMessages(messages) {
  return messages.map((msg, i) => {
    const time = new Date(msg.createdAt).toLocaleTimeString("zh-CN");
    const source = msg.source === "hook_notification" ? "Hook" : msg.source === "startup_notification" ? "\u542F\u52A8" : msg.source === "system_alert" ? "\u7CFB\u7EDF" : "\u6D88\u606F";
    return `[${i + 1}] ${time} | ${source}
${msg.content}`;
  }).join("\n\n");
}
async function processPendingMessages(openid, msgId) {
  const pendingMessages = getPendingMessages(openid);
  if (pendingMessages.length === 0) {
    return;
  }
  const messageCount = pendingMessages.length;
  log("cyan", `   \u{1F4E4} \u5F00\u59CB\u5904\u7406 ${messageCount} \u6761\u5F85\u53D1\u9001\u6D88\u606F\uFF08\u5408\u5E76\u538B\u7F29\u6A21\u5F0F\uFF09...`);
  try {
    const mergedContent = mergePendingMessages(pendingMessages);
    const mergedBytes = getByteLength(mergedContent);
    let finalContent;
    if (mergedBytes > HOOK_MESSAGE_CONFIG.compressThreshold) {
      log("cyan", `   \u{1F4CA} \u5408\u5E76\u540E ${mergedBytes} \u5B57\u8282 > \u9608\u503C ${HOOK_MESSAGE_CONFIG.compressThreshold}\uFF0C\u8C03\u7528 Claude \u538B\u7F29...`);
      const compressPrompt = `\u8BF7\u5C06\u4EE5\u4E0B ${messageCount} \u6761\u5F85\u53D1\u9001\u6D88\u606F\u538B\u7F29\u6210\u7B80\u6D01\u6458\u8981\u3002

\u683C\u5F0F\u8981\u6C42:
1. \u4F7F\u7528\u4E2D\u6587
2. \u6309\u65F6\u95F4\u987A\u5E8F\uFF0C\u683C\u5F0F: "[\u65F6\u95F4] \u6458\u8981\u5185\u5BB9"
3. \u4FDD\u7559\u91CD\u8981\u4FE1\u606F\uFF08\u9519\u8BEF\u3001\u8B66\u544A\u3001\u5173\u952E\u72B6\u6001\u53D8\u66F4\uFF09
4. \u5220\u9664\u5197\u4F59\u548C\u91CD\u590D\u4FE1\u606F
5. \u603B\u957F\u5EA6\u4E0D\u8D85\u8FC7 800 \u5B57

\u5F85\u538B\u7F29\u5185\u5BB9:
${mergedContent}`;
      try {
        const claudePath = process.env.CLAUDE_CODE_PATH || "claude";
        const compressResult = await new Promise((resolve2, reject) => {
          const child = spawn(claudePath, [
            "--print",
            "--allowedTools",
            "none",
            compressPrompt
          ], {
            timeout: 6e4,
            maxBuffer: 1024 * 1024
          });
          let stdout = "";
          let stderr = "";
          child.stdout.on("data", (data) => {
            stdout += data.toString();
          });
          child.stderr.on("data", (data) => {
            stderr += data.toString();
          });
          child.on("close", (code) => {
            if (code === 0) {
              resolve2(stdout.trim());
            } else {
              reject(new Error(`Claude exited with code ${code}: ${stderr}`));
            }
          });
          child.on("error", reject);
        });
        finalContent = `\u{1F4CB} \u79EF\u538B\u6D88\u606F\u6458\u8981 (${messageCount} \u6761)

${compressResult || "\uFF08\u538B\u7F29\u5931\u8D25\uFF09"}`;
        log("green", `   \u2705 \u6D88\u606F\u538B\u7F29\u5B8C\u6210`);
      } catch (compressErr) {
        log("yellow", `   \u26A0\uFE0F \u6D88\u606F\u538B\u7F29\u5931\u8D25: ${compressErr.message}\uFF0C\u4F7F\u7528\u622A\u65AD\u5185\u5BB9`);
        finalContent = `\u{1F4CB} \u79EF\u538B\u6D88\u606F\u6458\u8981 (${messageCount} \u6761, \u622A\u65AD)

${mergedContent.slice(0, HOOK_MESSAGE_CONFIG.pendingMaxSize)}...`;
      }
    } else {
      log("cyan", `   \u{1F4CA} \u5408\u5E76\u540E ${mergedBytes} \u5B57\u8282 <= \u9608\u503C ${HOOK_MESSAGE_CONFIG.compressThreshold}\uFF0C\u65E0\u9700\u538B\u7F29`);
      finalContent = `\u{1F4CB} \u79EF\u538B\u6D88\u606F\u5408\u5E76 (${messageCount} \u6761)

${mergedContent}`;
    }
    const finalBytes = getByteLength(finalContent);
    if (finalBytes > HOOK_MESSAGE_CONFIG.pendingMaxSize) {
      log("yellow", `   \u2702\uFE0F \u6D88\u606F\u8FC7\u5927 (${finalBytes} \u5B57\u8282)\uFF0C\u622A\u65AD\u81F3 ${HOOK_MESSAGE_CONFIG.pendingMaxSize} \u5B57\u8282`);
      finalContent = finalContent.slice(0, HOOK_MESSAGE_CONFIG.pendingMaxSize) + "\n\n... (\u5185\u5BB9\u5DF2\u622A\u65AD)";
    }
    const token = await getAccessToken2();
    const usageInfo = msgId ? { canUse: true, msgId, remaining: null } : { canUse: false };
    const result = await sendMessageSmart(token, openid, finalContent, usageInfo);
    if (result.success) {
      for (const msg of pendingMessages) {
        removePendingMessage(msg.id);
      }
      const methodText = result.method === "passive" ? "\u88AB\u52A8\u56DE\u590D" : "\u4E3B\u52A8\u6D88\u606F";
      log("green", `   \u2705 \u79EF\u538B\u6D88\u606F\u5DF2\u53D1\u9001 [${methodText}]\uFF0C\u5171 ${messageCount} \u6761`);
    } else {
      log("red", `   \u274C \u79EF\u538B\u6D88\u606F\u53D1\u9001\u5931\u8D25: ${result.error}\uFF0C\u6D88\u606F\u4FDD\u7559\u5728\u961F\u5217\u4E2D`);
    }
  } catch (err) {
    log("red", `   \u274C \u5904\u7406\u5F85\u53D1\u9001\u6D88\u606F\u5F02\u5E38: ${err.message}`);
  }
}
async function compressExpiredMessages(openid) {
  const compressibleMsgs = getCompressibleMessages(openid);
  const expiredFiles = getExpiredFiles(openid);
  if (compressibleMsgs.length === 0 && expiredFiles.length === 0) {
    return false;
  }
  log("cyan", `   \u{1F5DC}\uFE0F \u5F00\u59CB\u538B\u7F29 ${compressibleMsgs.length} \u6761\u8FC7\u671F\u6D88\u606F\u548C ${expiredFiles.length} \u4E2A\u8FC7\u671F\u6587\u4EF6...`);
  const textMessages = compressibleMsgs.filter((msg) => !msg.attachment);
  const attachmentMessages = compressibleMsgs.filter((msg) => msg.attachment);
  let messagesText = "";
  if (textMessages.length > 0) {
    messagesText += `\u6587\u672C\u6D88\u606F (${textMessages.length} \u6761):
`;
    messagesText += textMessages.map((msg, i) => `[${i + 1}] ${new Date(msg.createdAt).toLocaleString("zh-CN")}
${msg.content}`).join("\n\n---\n\n");
  }
  if (attachmentMessages.length > 0) {
    if (messagesText) messagesText += "\n\n---\n\n";
    messagesText += `\u9644\u4EF6\u6D88\u606F (${attachmentMessages.length} \u6761):
`;
    messagesText += attachmentMessages.map((msg, i) => {
      const att = msg.attachment;
      return `[${i + 1}] ${new Date(msg.createdAt).toLocaleString("zh-CN")}
\u7C7B\u578B: ${att.type}, \u6587\u4EF6\u540D: ${att.filename}, \u5927\u5C0F: ${Math.round(att.size / 1024)}KB
${msg.content || "(\u65E0\u6587\u5B57\u5185\u5BB9)"}`;
    }).join("\n\n");
  }
  if (expiredFiles.length > 0) {
    if (messagesText) messagesText += "\n\n---\n\n";
    messagesText += `\u5DF2\u8FC7\u671F\u7684\u7F13\u5B58\u6587\u4EF6 (${expiredFiles.length} \u4E2A):
`;
    messagesText += expiredFiles.map((file, i) => `[${i + 1}] ${file.filename} (${file.type}, ${Math.round(file.size / 1024)}KB) - \u5DF2\u6E05\u7406`).join("\n");
  }
  const compressPrompt = `\u8BF7\u5C06\u4EE5\u4E0B\u6D88\u606F\u548C\u6587\u4EF6\u8BB0\u5F55\u538B\u7F29\u6210\u4E00\u4E2A\u7B80\u6D01\u7684\u6458\u8981\u3002\u683C\u5F0F\u8981\u6C42\uFF1A
1. \u4F7F\u7528\u4E2D\u6587
2. \u6309\u65F6\u95F4\u987A\u5E8F\u6392\u5217\uFF0C\u683C\u5F0F\uFF1A"[\u65F6\u95F4] \u6458\u8981\u5185\u5BB9"
3. \u5BF9\u4E8E\u9644\u4EF6\u6D88\u606F\uFF0C\u6807\u6CE8\u6587\u4EF6\u7C7B\u578B\u548C\u540D\u79F0
4. \u5BF9\u4E8E\u5DF2\u6E05\u7406\u7684\u6587\u4EF6\uFF0C\u8BF4\u660E"\u6587\u4EF6\u5DF2\u8FC7\u671F\u6E05\u7406"
5. \u4FDD\u7559\u6240\u6709\u91CD\u8981\u4FE1\u606F\uFF0C\u5220\u9664\u5197\u4F59\u5185\u5BB9
6. \u603B\u957F\u5EA6\u4E0D\u8D85\u8FC7 500 \u5B57

\u5F85\u538B\u7F29\u5185\u5BB9\uFF1A
${messagesText}`;
  try {
    const claudePath = process.env.CLAUDE_CODE_PATH || "claude";
    const compressResult = await new Promise((resolve2, reject) => {
      const child = spawn(claudePath, [
        "--print",
        "--allowedTools",
        "none",
        compressPrompt
      ], {
        timeout: 6e4,
        // 1 分钟超时
        maxBuffer: 1024 * 1024
        // 1MB buffer
      });
      let stdout = "";
      let stderr = "";
      child.stdout.on("data", (data) => {
        stdout += data.toString();
      });
      child.stderr.on("data", (data) => {
        stderr += data.toString();
      });
      child.on("close", (code) => {
        if (code === 0) {
          resolve2(stdout.trim());
        } else {
          reject(new Error(`Claude exited with code ${code}: ${stderr}`));
        }
      });
      child.on("error", reject);
    });
    if (compressResult) {
      const cleanedFiles = cleanupExpiredFiles(openid);
      const compressedMessage = {
        id: `compressed_${Date.now()}`,
        targetOpenid: openid,
        content: `\u{1F4CB} \u6D88\u606F\u6458\u8981 (${compressibleMsgs.length} \u6761\u6D88\u606F${cleanedFiles > 0 ? `, ${cleanedFiles} \u4E2A\u6587\u4EF6\u5DF2\u6E05\u7406` : ""})

${compressResult}`,
        source: "system_alert",
        createdAt: Date.now(),
        priority: 20,
        // 较低优先级
        expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1e3
        // 7 天后过期
      };
      replacePendingMessages(openid, [compressedMessage]);
      log("green", `   \u2705 \u6D88\u606F\u538B\u7F29\u5B8C\u6210: ${compressibleMsgs.length} \u6761 -> 1 \u6761\u6458\u8981${cleanedFiles > 0 ? `, \u6E05\u7406 ${cleanedFiles} \u4E2A\u6587\u4EF6` : ""}`);
      return true;
    }
  } catch (err) {
    log("red", `   \u274C \u6D88\u606F\u538B\u7F29\u5931\u8D25: ${err.message}`);
    clearExpiredMessages(openid);
    cleanupExpiredFiles(openid);
  }
  return false;
}
async function checkAndCompressExpiredMessages() {
  const activeUsers = getActiveUsers();
  for (const user of activeUsers) {
    const expired = getExpiredMessages(user.openid);
    const expiredFiles = getExpiredFiles(user.openid);
    if (expired.length > 0 || expiredFiles.length > 0) {
      log("yellow", `   \u26A0\uFE0F \u7528\u6237 ${user.nickname || user.openid} \u6709 ${expired.length} \u6761\u8FC7\u671F\u6D88\u606F, ${expiredFiles.length} \u4E2A\u8FC7\u671F\u6587\u4EF6`);
      await compressExpiredMessages(user.openid);
    }
  }
}
async function sendStartupNotificationWithRetry(botUsername, retryCount = 0) {
  const maxRetries = 3;
  const delay = Math.min(1e3 * Math.pow(2, retryCount), 1e4);
  try {
    const projectsData = loadProjects();
    const defaultProject = projectsData.defaultProject;
    if (!defaultProject) {
      return;
    }
    const botConfig = getProjectBotConfig(defaultProject);
    if (!botConfig?.testTargetId) {
      return;
    }
    const modeText = mode === "auto" ? "\u81EA\u52A8\u56DE\u590D" : "\u901A\u77E5";
    const notification = `\u2705 QQ Bot \u7F51\u5173\u5DF2\u542F\u52A8
\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
\u{1F916} \u673A\u5668\u4EBA: ${botUsername || "\u672A\u77E5"}
\u{1F4C1} \u9879\u76EE: ${defaultProject}
\u2699\uFE0F \u6A21\u5F0F: ${modeText}
\u{1F522} PID: ${process.pid}`;
    const usageInfo = incrementMsgIdUsage(botConfig.testTargetId);
    const result = await sendMessageSmart(accessToken, botConfig.testTargetId, notification, usageInfo);
    if (result.success) {
      const methodText = result.method === "passive" ? `\u88AB\u52A8\u56DE\u590D (\u5269\u4F59 ${result.remaining} \u6B21)` : "\u4E3B\u52A8\u6D88\u606F";
      log("green", `   \u2705 \u542F\u52A8\u901A\u77E5\u5DF2\u53D1\u9001 [${methodText}]`);
    } else {
      addPendingMessage({
        targetOpenid: botConfig.testTargetId,
        content: notification,
        source: "startup_notification",
        priority: 1
      });
      log("yellow", `   \u26A0\uFE0F \u542F\u52A8\u901A\u77E5\u53D1\u9001\u5931\u8D25\uFF0C\u5DF2\u7F13\u5B58: ${result.error}`);
    }
  } catch (notifyErr) {
    if (retryCount < maxRetries) {
      log("yellow", `   \u26A0\uFE0F \u53D1\u9001\u542F\u52A8\u901A\u77E5\u5931\u8D25 (\u5C1D\u8BD5 ${retryCount + 1}/${maxRetries}): ${notifyErr.message}`);
      await new Promise((resolve2) => setTimeout(resolve2, delay));
      await sendStartupNotificationWithRetry(botUsername, retryCount + 1);
    } else {
      log("yellow", `   \u26A0\uFE0F \u53D1\u9001\u542F\u52A8\u901A\u77E5\u6700\u7EC8\u5931\u8D25: ${notifyErr.message}`);
    }
  }
}
var command = process.argv[2];
var args = process.argv.slice(3);
switch (command) {
  case "start": {
    const cwdIndex = args.indexOf("--cwd");
    const startProjectPath = cwdIndex !== -1 ? args[cwdIndex + 1] : process.cwd();
    const projectName2 = path3.basename(startProjectPath);
    const projectBotConfig = syncProjectConfig(startProjectPath);
    if (projectBotConfig) {
      registerProject(startProjectPath, projectName2, projectBotConfig);
      log("green", `\u2705 \u9879\u76EE "${projectName2}" \u5DF2\u6CE8\u518C\uFF0C\u673A\u5668\u4EBA\u914D\u7F6E\u5DF2\u4FDD\u5B58`);
      log("cyan", `   APP_ID: ${projectBotConfig.appId}`);
    } else {
      const data = loadProjects();
      if (!data.projects[projectName2]) {
        registerProject(startProjectPath, projectName2, null);
        log("yellow", `\u26A0\uFE0F \u9879\u76EE "${projectName2}" \u672A\u68C0\u6D4B\u5230 .env \u914D\u7F6E\uFF0C\u5C06\u4F7F\u7528\u5168\u5C40\u73AF\u5883\u53D8\u91CF`);
      }
    }
    if (fs3.existsSync(PID_FILE)) {
      const existingPid = parseInt(fs3.readFileSync(PID_FILE, "utf-8"));
      try {
        process.kill(existingPid, 0);
        log("yellow", "\u26A0\uFE0F \u7F51\u5173\u5DF2\u5728\u8FD0\u884C\u4E2D");
        log("cyan", `   PID: ${existingPid}`);
        log("cyan", "   \u9879\u76EE\u5DF2\u6CE8\u518C\uFF0C\u5904\u7406\u6D88\u606F\u65F6\u5C06\u4F7F\u7528\u9879\u76EE\u4E13\u5C5E\u914D\u7F6E");
        log("cyan", '   \u4F7F\u7528 "node qqbot-gateway.js status" \u67E5\u770B\u8BE6\u60C5');
        process.exit(0);
      } catch (e) {
        fs3.unlinkSync(PID_FILE);
      }
    }
    const modeIndex = args.indexOf("--mode");
    const modeValue = modeIndex !== -1 ? args[modeIndex + 1] : null;
    const startMode = args.includes("--auto") || modeValue === "auto" ? "auto" : "notify";
    const channelIndex = args.indexOf("--channel");
    const channelMode = channelIndex !== -1 ? args[channelIndex + 1] : null;
    startGateway(startMode, channelMode).catch((err) => {
      log("red", `\u274C \u542F\u52A8\u5931\u8D25: ${err.message}`);
      process.exit(1);
    });
    break;
  }
  case "stop":
    if (fs3.existsSync(PID_FILE)) {
      const pid = parseInt(fs3.readFileSync(PID_FILE, "utf-8"));
      try {
        process.kill(pid, "SIGTERM");
        fs3.unlinkSync(PID_FILE);
        if (fs3.existsSync(GATEWAY_STATE_FILE)) {
          fs3.unlinkSync(GATEWAY_STATE_FILE);
        }
        log("green", "\u2705 \u7F51\u5173\u5DF2\u505C\u6B62");
      } catch (e) {
        log("yellow", "\u26A0\uFE0F \u8FDB\u7A0B\u4E0D\u5B58\u5728\u6216\u5DF2\u505C\u6B62");
        fs3.unlinkSync(PID_FILE);
        if (fs3.existsSync(GATEWAY_STATE_FILE)) {
          fs3.unlinkSync(GATEWAY_STATE_FILE);
        }
      }
    } else {
      log("yellow", "\u26A0\uFE0F \u7F51\u5173\u672A\u8FD0\u884C");
    }
    break;
  case "status": {
    console.log("\n\u{1F916} QQ Bot \u7F51\u5173\u72B6\u6001");
    console.log("\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501");
    const colors2 = {
      reset: "\x1B[0m",
      green: "\x1B[32m",
      yellow: "\x1B[33m",
      red: "\x1B[31m",
      cyan: "\x1B[36m",
      dim: "\x1B[2m",
      bold: "\x1B[1m"
    };
    let pid = null;
    let isRunning = false;
    let uptime = null;
    if (fs3.existsSync(PID_FILE)) {
      pid = parseInt(fs3.readFileSync(PID_FILE, "utf-8"));
      try {
        process.kill(pid, 0);
        isRunning = true;
        const pidStat = fs3.statSync(PID_FILE);
        uptime = Date.now() - pidStat.birthtimeMs;
      } catch (e) {
        isRunning = false;
      }
    }
    console.log(`${colors2.bold}\u670D\u52A1\u72B6\u6001${colors2.reset}`);
    if (isRunning) {
      console.log(`  ${colors2.green}\u2705 \u8FD0\u884C\u4E2D${colors2.reset} (PID: ${pid})`);
      if (uptime) {
        const hours = Math.floor(uptime / 36e5);
        const minutes = Math.floor(uptime % 36e5 / 6e4);
        console.log(`  ${colors2.dim}\u8FD0\u884C\u65F6\u95F4: ${hours}\u5C0F\u65F6 ${minutes}\u5206\u949F${colors2.reset}`);
      }
    } else {
      console.log(`  ${colors2.red}\u274C \u5DF2\u505C\u6B62${colors2.reset}`);
      if (pid) {
        console.log(`  ${colors2.yellow}\u26A0\uFE0F  PID \u6587\u4EF6\u5B58\u5728\u4F46\u8FDB\u7A0B\u4E0D\u5B58\u5728\uFF08\u50F5\u5C38\u72B6\u6001\uFF09${colors2.reset}`);
      }
    }
    console.log(`
${colors2.bold}\u65E5\u5FD7\u72B6\u6001${colors2.reset}`);
    if (fs3.existsSync(LOG_FILE)) {
      const logStat = fs3.statSync(LOG_FILE);
      const logSizeMB = (logStat.size / 1024 / 1024).toFixed(2);
      const lastModified = new Date(logStat.mtime).toLocaleString();
      console.log(`  \u6587\u4EF6\u5927\u5C0F: ${logSizeMB} MB`);
      console.log(`  ${colors2.dim}\u6700\u540E\u66F4\u65B0: ${lastModified}${colors2.reset}`);
    } else {
      console.log(`  ${colors2.yellow}\u26A0\uFE0F  \u65E5\u5FD7\u6587\u4EF6\u4E0D\u5B58\u5728${colors2.reset}`);
    }
    const data = loadProjects();
    const currentCwd = process.cwd();
    console.log(`
${colors2.bold}\u5DF2\u6CE8\u518C\u9879\u76EE (${Object.keys(data.projects).length})${colors2.reset}`);
    if (Object.keys(data.projects).length === 0) {
      console.log(`  ${colors2.dim}\u6682\u65E0\u6CE8\u518C\u9879\u76EE${colors2.reset}`);
    } else {
      for (const [name, project] of Object.entries(data.projects)) {
        const isDefault = data.defaultProject === name;
        const isCurrent = project.path === currentCwd;
        const session = loadSession(name);
        const markers = [];
        if (isDefault) markers.push("\u2605 \u9ED8\u8BA4");
        if (isCurrent) markers.push("\u25B6 \u5F53\u524D");
        console.log(`
  ${colors2.cyan}${name}${colors2.reset} ${markers.length > 0 ? colors2.yellow + "(" + markers.join(", ") + ")" + colors2.reset : ""}`);
        console.log(`    \u8DEF\u5F84: ${project.path}`);
        if (session) {
          console.log(`    \u4F1A\u8BDD: ${session.sessionId || "\u672A\u5EFA\u7ACB"}`);
          if (session.lastSeq !== void 0) {
            console.log(`    ${colors2.dim}\u6D88\u606F\u5E8F\u53F7: ${session.lastSeq}${colors2.reset}`);
          }
          if (session.lastConnectedAt) {
            const lastConn = new Date(session.lastConnectedAt).toLocaleString();
            console.log(`    ${colors2.dim}\u6700\u540E\u8FDE\u63A5: ${lastConn}${colors2.reset}`);
          }
        } else {
          console.log(`    \u4F1A\u8BDD: ${colors2.dim}\u65E0${colors2.reset}`);
        }
      }
    }
    const currentProject = Object.entries(data.projects || {}).find(([_, p]) => p.path === currentCwd);
    console.log(`
${colors2.bold}\u5F53\u524D\u76EE\u5F55\u72B6\u6001${colors2.reset}`);
    if (currentProject) {
      const isDefault = data.defaultProject === currentProject[0];
      console.log(`  ${colors2.green}\u2705 \u5DF2\u6CE8\u518C\u4E3A "${currentProject[0]}"${colors2.reset}`);
      if (!isDefault) {
        console.log(`  ${colors2.yellow}\u{1F4A1} \u8FD0\u884C "/qqbot-service switch ${currentProject[0]}" \u8BBE\u4E3A\u9ED8\u8BA4${colors2.reset}`);
      }
    } else {
      console.log(`  ${colors2.yellow}\u26A0\uFE0F  \u5F53\u524D\u9879\u76EE\u672A\u6CE8\u518C${colors2.reset}`);
      if (isRunning) {
        console.log(`  ${colors2.dim}\u{1F4A1} \u8FD0\u884C "/qqbot-service start" \u6CE8\u518C\u5F53\u524D\u9879\u76EE${colors2.reset}`);
      }
    }
    console.log(`
${colors2.bold}\u5FEB\u901F\u64CD\u4F5C${colors2.reset}`);
    if (!isRunning) {
      console.log(`  \u2022 \u542F\u52A8\u670D\u52A1: /qqbot-service start`);
    } else {
      console.log(`  \u2022 \u67E5\u770B\u4EFB\u52A1: /qqbot-tasks`);
      console.log(`  \u2022 \u53D1\u9001\u6D88\u606F: /qqbot-send <targetId> <message>`);
      console.log(`  \u2022 \u505C\u6B62\u670D\u52A1: /qqbot-service stop`);
    }
    console.log(`  \u2022 \u8BCA\u65AD\u95EE\u9898: /qqbot-doctor`);
    console.log(`  \u2022 \u68C0\u67E5\u72B6\u6001: /qqbot-check`);
    console.log("");
    break;
  }
  case "register":
    const projectPath = args[0];
    if (!projectPath) {
      console.log("\u7528\u6CD5: qqbot-gateway register <projectPath> [--name <name>]");
      process.exit(1);
    }
    const nameIndex = args.indexOf("--name");
    const projectName = nameIndex !== -1 ? args[nameIndex + 1] : null;
    registerProject(path3.resolve(projectPath), projectName);
    break;
  case "unregister":
    if (!args[0]) {
      console.log("\u7528\u6CD5: qqbot-gateway unregister <projectName>");
      process.exit(1);
    }
    unregisterProject(args[0]);
    break;
  case "switch":
    if (!args[0]) {
      console.log("\u7528\u6CD5: qqbot-gateway switch <projectName>");
      process.exit(1);
    }
    switchDefaultProject(args[0]);
    break;
  case "init-session":
    const sessionProject = args[0];
    if (!sessionProject) {
      console.log("\u7528\u6CD5: qqbot-gateway init-session <projectName> [--prompt <prompt>]");
      process.exit(1);
    }
    const promptIndex = args.indexOf("--prompt");
    const initPrompt = promptIndex !== -1 ? args[promptIndex + 1] : null;
    initializeSession(sessionProject, initPrompt).then((session) => {
      console.log(`\u2705 \u4F1A\u8BDD\u5DF2\u521D\u59CB\u5316: ${session.sessionId}`);
    }).catch((err) => {
      console.log(`\u274C \u521D\u59CB\u5316\u5931\u8D25: ${err.message}`);
      process.exit(1);
    });
    break;
  default:
    console.log(`
QQ Bot \u5168\u5C40\u7F51\u5173

\u7528\u6CD5:
  qqbot-gateway start [--auto]     \u542F\u52A8\u7F51\u5173 (--auto: \u81EA\u52A8\u56DE\u590D\u6A21\u5F0F)
  qqbot-gateway stop               \u505C\u6B62\u7F51\u5173
  qqbot-gateway status             \u67E5\u770B\u72B6\u6001
  qqbot-gateway register <path> [--name <name>]   \u6CE8\u518C\u9879\u76EE
  qqbot-gateway unregister <name>  \u6CE8\u9500\u9879\u76EE
  qqbot-gateway switch <name>      \u5207\u6362\u9ED8\u8BA4\u9879\u76EE
  qqbot-gateway init-session <name> [--prompt <prompt>]  \u521D\u59CB\u5316\u4F1A\u8BDD
`);
}
process.on("SIGINT", () => {
  stopGateway();
  process.exit(0);
});
process.on("SIGTERM", () => {
  stopGateway();
  process.exit(0);
});
