/**
 * Minecraft NBT (Named Binary Tag) Parser
 *
 * Simplified browser-based parser for Minecraft NBT format files.
 * Handles big-endian byte order per the Minecraft NBT specification.
 *
 * Tag type IDs:
 *   0  - TAG_End
 *   1  - TAG_Byte
 *   2  - TAG_Short
 *   3  - TAG_Int
 *   4  - TAG_Long
 *   5  - TAG_Float
 *   6  - TAG_Double
 *   7  - TAG_Byte_Array
 *   8  - TAG_String
 *   9  - TAG_List
 *   10 - TAG_Compound
 *   11 - TAG_Int_Array
 *   12 - TAG_Long_Array
 */

const NbtParser = (() => {
  'use strict';

  // ------------------------------------------------------------------ //
  //  Tag type constants & human-readable name mapping
  // ------------------------------------------------------------------ //

  const TAG_END         = 0;
  const TAG_BYTE        = 1;
  const TAG_SHORT       = 2;
  const TAG_INT         = 3;
  const TAG_LONG        = 4;
  const TAG_FLOAT       = 5;
  const TAG_DOUBLE      = 6;
  const TAG_BYTE_ARRAY  = 7;
  const TAG_STRING      = 8;
  const TAG_LIST        = 9;
  const TAG_COMPOUND    = 10;
  const TAG_INT_ARRAY   = 11;
  const TAG_LONG_ARRAY  = 12;

  const TAG_TYPES = {
    [TAG_END]:        'TAG_End',
    [TAG_BYTE]:       'TAG_Byte',
    [TAG_SHORT]:      'TAG_Short',
    [TAG_INT]:        'TAG_Int',
    [TAG_LONG]:       'TAG_Long',
    [TAG_FLOAT]:      'TAG_Float',
    [TAG_DOUBLE]:     'TAG_Double',
    [TAG_BYTE_ARRAY]: 'TAG_Byte_Array',
    [TAG_STRING]:     'TAG_String',
    [TAG_LIST]:       'TAG_List',
    [TAG_COMPOUND]:   'TAG_Compound',
    [TAG_INT_ARRAY]:  'TAG_Int_Array',
    [TAG_LONG_ARRAY]: 'TAG_Long_Array',
  };

  // ------------------------------------------------------------------ //
  //  Helpers
  // ------------------------------------------------------------------ //

  /**
   * Read a signed 64-bit integer from a DataView.
   * JavaScript Numbers cannot safely represent all 64-bit integers,
   * so we fall back to BigInt when the value exceeds Number.MAX_SAFE_INTEGER.
   */
  function _readInt64BE(view, offset) {
    const hi = view.getInt32(offset, false);       // big-endian high 32 bits
    const lo = view.getUint32(offset + 4, false);  // big-endian low 32 bits
    // Combine into a signed BigInt: ((hi << 32n) + lo)
    const big = (BigInt(hi) << 32n) + BigInt(lo >>> 0);
    // If it fits in safe integer range, return as Number for convenience
    if (big >= BigInt(Number.MIN_SAFE_INTEGER) && big <= BigInt(Number.MAX_SAFE_INTEGER)) {
      return Number(big);
    }
    return big;
  }

  /**
   * Read a length-prefixed UTF-8 string (2-byte unsigned short length + bytes).
   */
  function _readStringPayload(view, offset) {
    const length = view.getUint16(offset, false);
    offset += 2;
    const bytes = new Uint8Array(view.buffer, view.byteOffset + offset, length);
    const str = new TextDecoder('utf-8').decode(bytes);
    return { value: str, offset: offset + length };
  }

  // ------------------------------------------------------------------ //
  //  Core parse helpers
  // ------------------------------------------------------------------ //

  /**
   * Read a single tag header (type byte + name) and return
   * { type, name, offset } where offset points past the name.
   */
  function _readTagHeader(view, offset) {
    const typeByte = view.getUint8(offset);
    offset += 1;

    if (typeByte === TAG_END) {
      return { type: TAG_END, name: '', offset };
    }

    const nameResult = _readStringPayload(view, offset);
    return { type: typeByte, name: nameResult.value, offset: nameResult.offset };
  }

  /**
   * Read the payload for the given tag type starting at offset.
   * Returns { value, offset }.
   */
  function _readPayload(view, offset, type) {
    switch (type) {
      // ---- Primitive types ----
      case TAG_BYTE:
        return { value: view.getInt8(offset), offset: offset + 1 };

      case TAG_SHORT:
        return { value: view.getInt16(offset, false), offset: offset + 2 };

      case TAG_INT:
        return { value: view.getInt32(offset, false), offset: offset + 4 };

      case TAG_LONG:
        return { value: _readInt64BE(view, offset), offset: offset + 8 };

      case TAG_FLOAT:
        return { value: view.getFloat32(offset, false), offset: offset + 4 };

      case TAG_DOUBLE:
        return { value: view.getFloat64(offset, false), offset: offset + 8 };

      // ---- Array types ----
      case TAG_BYTE_ARRAY: {
        const length = view.getInt32(offset, false);
        offset += 4;
        const arr = [];
        for (let i = 0; i < length; i++) {
          arr.push(view.getInt8(offset));
          offset += 1;
        }
        return { value: arr, offset };
      }

      case TAG_INT_ARRAY: {
        const length = view.getInt32(offset, false);
        offset += 4;
        const arr = [];
        for (let i = 0; i < length; i++) {
          arr.push(view.getInt32(offset, false));
          offset += 4;
        }
        return { value: arr, offset };
      }

      case TAG_LONG_ARRAY: {
        const length = view.getInt32(offset, false);
        offset += 4;
        const arr = [];
        for (let i = 0; i < length; i++) {
          arr.push(_readInt64BE(view, offset));
          offset += 8;
        }
        return { value: arr, offset };
      }

      // ---- String ----
      case TAG_STRING: {
        return _readStringPayload(view, offset);
      }

      // ---- List ----
      case TAG_LIST: {
        const elementType = view.getUint8(offset);
        offset += 1;
        const length = view.getInt32(offset, false);
        offset += 4;

        const items = [];
        for (let i = 0; i < length; i++) {
          if (elementType === TAG_END) {
            // Lists of TAG_End have no payload per element
            items.push(null);
            continue;
          }
          const result = _readPayload(view, offset, elementType);
          items.push(result.value);
          offset = result.offset;
        }
        return { value: items, offset, listElementType: elementType };
      }

      // ---- Compound ----
      case TAG_COMPOUND: {
        const children = {};
        while (true) {
          const header = _readTagHeader(view, offset);
          offset = header.offset;

          if (header.type === TAG_END) {
            break;
          }

          const payload = _readPayload(view, offset, header.type);
          children[header.name] = payload.value;
          offset = payload.offset;
        }
        return { value: children, offset };
      }

      default:
        throw new Error(`Unknown NBT tag type: ${type} (0x${type.toString(16)}) at offset ${offset}`);
    }
  }

  // ------------------------------------------------------------------ //
  //  Decompression
  // ------------------------------------------------------------------ //

  /**
   * Decompress a GZip-compressed ArrayBuffer using the browser
   * DecompressionStream API (available in all modern browsers).
   */
  async function _decompressGzip(buffer) {
    const ds = new DecompressionStream('gzip');
    const writer = ds.writable.getWriter();
    const reader = ds.readable.getReader();

    writer.write(new Uint8Array(buffer));
    writer.close();

    const chunks = [];
    let totalLength = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      totalLength += value.length;
    }

    const result = new Uint8Array(totalLength);
    let pos = 0;
    for (const chunk of chunks) {
      result.set(chunk, pos);
      pos += chunk.length;
    }

    return result.buffer;
  }

  /**
   * Decompress a Zlib-compressed ArrayBuffer using the browser
   * DecompressionStream API.
   */
  async function _decompressZlib(buffer) {
    const ds = new DecompressionStream('deflate');
    const writer = ds.writable.getWriter();
    const reader = ds.readable.getReader();

    // Zlib data starts with a 2-byte header (CMF + FLG).
    // DecompressionStream('deflate') expects raw deflate without the header,
    // so we skip the first 2 bytes (78 xx is the standard zlib header).
    const data = new Uint8Array(buffer);
    writer.write(data.slice(2));
    writer.close();

    const chunks = [];
    let totalLength = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      totalLength += value.length;
    }

    const result = new Uint8Array(totalLength);
    let pos = 0;
    for (const chunk of chunks) {
      result.set(chunk, pos);
      pos += chunk.length;
    }

    return result.buffer;
  }

  // ------------------------------------------------------------------ //
  //  Public API
  // ------------------------------------------------------------------ //

  /**
   * Parse an NBT file from an ArrayBuffer.
   *
   * Detects GZip (0x1f 0x8b) and Zlib (0x78) compression automatically
   * and decompresses before parsing.
   *
   * @param {ArrayBuffer} buffer - The raw file bytes.
   * @returns {Promise<Object>} The parsed NBT root tag.
   */
  async function parse(buffer) {
    const bytes = new Uint8Array(buffer);

    // Detect compression
    if (bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b) {
      buffer = await _decompressGzip(buffer);
    } else if (bytes.length >= 2 && bytes[0] === 0x78) {
      // Common zlib headers: 0x78 0x01 (low), 0x78 0x5e (default), 0x78 0x9c (default), 0x78 0xda (best)
      buffer = await _decompressZlib(buffer);
    }

    const view = new DataView(buffer);
    const header = _readTagHeader(view, 0);
    const payload = _readPayload(view, header.offset, header.type);

    return {
      type: header.type,
      name: header.name,
      value: payload.value,
    };
  }

  /**
   * Convert a parsed NBT structure to a clean, JSON-serializable object.
   *
   * Strips all tag-type metadata, converts TAG_Compound to plain objects,
   * and TAG_List to plain arrays.
   *
   * @param {*} nbtData - The output of NbtParser.parse() or a sub-value.
   * @returns {*} A clean JavaScript value suitable for JSON.stringify.
   */
  function toJSON(nbtData) {
    if (nbtData === null || nbtData === undefined) {
      return nbtData;
    }

    // Root tag object from parse()
    if (
      typeof nbtData === 'object' &&
      nbtData !== null &&
      'type' in nbtData &&
      'value' in nbtData
    ) {
      return toJSON(nbtData.value);
    }

    // Array (from TAG_List, TAG_Byte_Array, etc.)
    if (Array.isArray(nbtData)) {
      return nbtData.map((item) => toJSON(item));
    }

    // Plain object (from TAG_Compound)
    if (typeof nbtData === 'object' && nbtData !== null) {
      const out = {};
      for (const key of Object.keys(nbtData)) {
        out[key] = toJSON(nbtData[key]);
      }
      return out;
    }

    // Primitives (number, string, boolean) pass through
    return nbtData;
  }

  // ------------------------------------------------------------------ //
  //  Serialization helpers (toNBT)
  // ------------------------------------------------------------------ //

  function _getTypeOfValue(value) {
    if (typeof value === 'number') {
      // Check if it's an integer and fits in certain ranges
      if (Number.isInteger(value)) {
        if (value >= -128 && value <= 127) return TAG_BYTE;
        if (value >= -32768 && value <= 32767) return TAG_SHORT;
        if (value >= -2147483648 && value <= 2147483647) return TAG_INT;
        return TAG_LONG;
      }
      // Floating point - use double by default for precision
      return TAG_DOUBLE;
    }
    if (typeof value === 'string') return TAG_STRING;
    if (typeof value === 'bigint') return TAG_LONG;
    if (Array.isArray(value)) return _detectListType(value);
    if (typeof value === 'object' && value !== null) return TAG_COMPOUND;
    return TAG_BYTE; // fallback
  }

  function _detectListType(arr) {
    if (arr.length === 0) return TAG_BYTE; // default for empty lists
    return _getTypeOfValue(arr[0]);
  }

  function _writeTagHeader(type, name, encoder) {
    encoder.push(type);
    _writeString(name, encoder);
  }

  function _writeString(str, encoder) {
    const bytes = new TextEncoder().encode(str);
    encoder.push((bytes.length >> 8) & 0xff);
    encoder.push(bytes.length & 0xff);
    for (let i = 0; i < bytes.length; i++) {
      encoder.push(bytes[i]);
    }
  }

  function _writePayload(value, type, encoder) {
    switch (type) {
      case TAG_BYTE: {
        const b = typeof value === 'bigint' ? Number(value) : value;
        encoder.push(b & 0xff);
        break;
      }
      case TAG_SHORT: {
        const v = typeof value === 'bigint' ? Number(value) : value;
        encoder.push((v >> 8) & 0xff);
        encoder.push(v & 0xff);
        break;
      }
      case TAG_INT: {
        const v = typeof value === 'bigint' ? Number(value) : value;
        encoder.push((v >> 24) & 0xff);
        encoder.push((v >> 16) & 0xff);
        encoder.push((v >> 8) & 0xff);
        encoder.push(v & 0xff);
        break;
      }
      case TAG_LONG: {
        let v;
        if (typeof value === 'bigint') {
          v = value;
        } else {
          v = BigInt(value);
        }
        // Write as two 32-bit halves (big-endian)
        const hi = Number((v >> 32n) & 0xffffffffn);
        const lo = Number(v & 0xffffffffn);
        encoder.push((hi >> 24) & 0xff);
        encoder.push((hi >> 16) & 0xff);
        encoder.push((hi >> 8) & 0xff);
        encoder.push(hi & 0xff);
        encoder.push((lo >> 24) & 0xff);
        encoder.push((lo >> 16) & 0xff);
        encoder.push((lo >> 8) & 0xff);
        encoder.push(lo & 0xff);
        break;
      }
      case TAG_FLOAT: {
        const buf = new ArrayBuffer(4);
        new DataView(buf).setFloat32(0, value, false);
        const bytes = new Uint8Array(buf);
        for (let i = 0; i < 4; i++) encoder.push(bytes[i]);
        break;
      }
      case TAG_DOUBLE: {
        const buf = new ArrayBuffer(8);
        new DataView(buf).setFloat64(0, value, false);
        const bytes = new Uint8Array(buf);
        for (let i = 0; i < 8; i++) encoder.push(bytes[i]);
        break;
      }
      case TAG_BYTE_ARRAY: {
        const arr = value;
        const len = arr.length;
        encoder.push((len >> 24) & 0xff);
        encoder.push((len >> 16) & 0xff);
        encoder.push((len >> 8) & 0xff);
        encoder.push(len & 0xff);
        for (let i = 0; i < len; i++) {
          encoder.push(arr[i] & 0xff);
        }
        break;
      }
      case TAG_STRING: {
        _writeString(value, encoder);
        break;
      }
      case TAG_LIST: {
        const arr = value;
        const listType = arr.length > 0 ? _getTypeOfValue(arr[0]) : TAG_BYTE;
        encoder.push(listType);
        encoder.push((arr.length >> 24) & 0xff);
        encoder.push((arr.length >> 16) & 0xff);
        encoder.push((arr.length >> 8) & 0xff);
        encoder.push(arr.length & 0xff);
        for (let i = 0; i < arr.length; i++) {
          _writePayload(arr[i], listType, encoder);
        }
        break;
      }
      case TAG_INT_ARRAY: {
        const arr = value;
        const len = arr.length;
        encoder.push((len >> 24) & 0xff);
        encoder.push((len >> 16) & 0xff);
        encoder.push((len >> 8) & 0xff);
        encoder.push(len & 0xff);
        for (let i = 0; i < len; i++) {
          const v = arr[i];
          encoder.push((v >> 24) & 0xff);
          encoder.push((v >> 16) & 0xff);
          encoder.push((v >> 8) & 0xff);
          encoder.push(v & 0xff);
        }
        break;
      }
      case TAG_LONG_ARRAY: {
        const arr = value;
        const len = arr.length;
        encoder.push((len >> 24) & 0xff);
        encoder.push((len >> 16) & 0xff);
        encoder.push((len >> 8) & 0xff);
        encoder.push(len & 0xff);
        for (let i = 0; i < len; i++) {
          let v;
          if (typeof arr[i] === 'bigint') {
            v = arr[i];
          } else {
            v = BigInt(arr[i]);
          }
          const hi = Number((v >> 32n) & 0xffffffffn);
          const lo = Number(v & 0xffffffffn);
          encoder.push((hi >> 24) & 0xff);
          encoder.push((hi >> 16) & 0xff);
          encoder.push((hi >> 8) & 0xff);
          encoder.push(hi & 0xff);
          encoder.push((lo >> 24) & 0xff);
          encoder.push((lo >> 16) & 0xff);
          encoder.push((lo >> 8) & 0xff);
          encoder.push(lo & 0xff);
        }
        break;
      }
      case TAG_COMPOUND: {
        const obj = value;
        const keys = Object.keys(obj);
        for (const key of keys) {
          const childValue = obj[key];
          const childType = _getTypeOfValue(childValue);
          _writeTagHeader(childType, key, encoder);
          _writePayload(childValue, childType, encoder);
        }
        // TAG_End
        encoder.push(TAG_END);
        break;
      }
      default:
        throw new Error(`Cannot serialize unknown tag type: ${type}`);
    }
  }

  /**
   * Convert a JavaScript object to NBT binary format.
   *
   * @param {Object} json - The JavaScript object to serialize.
   * @param {string} [name=''] - The root TAG_Compound name.
   * @returns {Uint8Array} The serialized NBT binary data.
   */
  function toNBT(json, name) {
    if (typeof name !== 'string') name = '';
    const encoder = [];

    // Root tag header
    _writeTagHeader(TAG_COMPOUND, name, encoder);

    // Root compound payload
    _writePayload(json, TAG_COMPOUND, encoder);

    return new Uint8Array(encoder);
  }

  // ------------------------------------------------------------------ //
  //  Exports
  // ------------------------------------------------------------------ //

  return Object.freeze({
    TAG_TYPES,
    parse,
    _readTagHeader,
    _readPayload,
    _decompressGzip,
    _decompressZlib,
    toJSON,
    toNBT,
  });
})();

// Support both browser (global) and module environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = NbtParser;
}
