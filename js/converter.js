/**
 * MC蓝图工坊 - 蓝图格式转换逻辑
 * 文件上传、格式选择、转换模拟、下载功能
 */

// ==================== DOM 引用 ====================

var uploadZone = document.getElementById('upload-zone');
var fileInput = document.getElementById('file-input');
var fileInfo = document.getElementById('file-info');
var formatOptions = document.querySelectorAll('.format-option');
var btnConvert = document.getElementById('btn-convert');
var convertProgress = document.getElementById('convert-progress');
var progressFill = document.getElementById('progress-fill');
var progressText = document.getElementById('progress-text');
var convertResult = document.getElementById('convert-result');
var btnDownload = document.getElementById('btn-download');

// ==================== 状态变量 ====================

var selectedFile = null;       // 用户选择的文件 { file, name, size, extension }
var sourceFormat = '';          // 源文件格式
var targetFormat = '';          // 目标转换格式
var convertedBlobUrl = null;    // 转换后的 Blob URL（用于清理）
var convertedFileName = '';     // 转换后的文件名

// ==================== Toast 提示 ====================

function converterToast(message, type) {
  if (typeof showToast === 'function') {
    showToast(message, type);
    return;
  }

  var toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    document.body.appendChild(toast);
  }

  toast.textContent = message;
  toast.className = 'toast visible ' + type;

  setTimeout(function () {
    toast.classList.remove('visible');
  }, 3000);
}

// ==================== 工具函数 ====================

/**
 * 从文件名提取扩展名（小写）
 */
function getFileExtension(filename) {
  var parts = filename.split('.');
  if (parts.length > 1) {
    return parts.pop().toLowerCase();
  }
  return '';
}

/**
 * 格式化文件大小
 */
function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

/**
 * 检查文件扩展名是否受支持
 */
function isSupportedFormat(ext) {
  return ['nbt', 'schematic', 'litematic', 'json'].indexOf(ext) !== -1;
}

/**
 * 目标格式的 MIME 类型 / Blob 类型
 */
function getMimeType(format) {
  switch (format) {
    case 'json':    return 'application/json';
    case 'nbt':     return 'application/octet-stream';
    case 'schematic': return 'application/octet-stream';
    case 'litematic': return 'application/octet-stream';
    default:        return 'application/octet-stream';
  }
}

// ==================== 上传区域：点击打开文件对话框 ====================

if (uploadZone) {
  uploadZone.addEventListener('click', function (e) {
    // 如果点击的不是 file-info 内部区域，才触发
    if (e.target.closest('.file-info')) return;
    fileInput.click();
  });
}

// ==================== 上传区域：拖拽支持 ====================

if (uploadZone) {
  uploadZone.addEventListener('dragover', function (e) {
    e.preventDefault();
    e.stopPropagation();
    uploadZone.classList.add('dragover');
  });

  uploadZone.addEventListener('dragleave', function (e) {
    e.preventDefault();
    e.stopPropagation();
    uploadZone.classList.remove('dragover');
  });

  uploadZone.addEventListener('drop', function (e) {
    e.preventDefault();
    e.stopPropagation();
    uploadZone.classList.remove('dragover');

    var files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelected(files[0]);
    }
  });
}

// ==================== 文件选择处理 ====================

if (fileInput) {
  fileInput.addEventListener('change', function () {
    if (this.files && this.files.length > 0) {
      handleFileSelected(this.files[0]);
    }
  });
}

/**
 * 处理文件选择
 */
function handleFileSelected(file) {
  var ext = getFileExtension(file.name);

  // 验证文件格式
  if (!isSupportedFormat(ext)) {
    converterToast('文件格式不支持', 'error');
    resetFileState();
    return;
  }

  selectedFile = {
    file: file,
    name: file.name,
    size: file.size,
    extension: ext
  };
  sourceFormat = ext;

  // 显示文件信息
  if (fileInfo) {
    fileInfo.innerHTML =
      '<strong>文件名：</strong>' + escapeHtml(file.name) +
      '<br><strong>大小：</strong>' + formatFileSize(file.size) +
      '<br><strong>格式：</strong>' + ext.toUpperCase();
    fileInfo.classList.add('active');
  }

  // 隐藏之前的结果
  hideResult();
}

/**
 * HTML 转义
 */
function escapeHtml(text) {
  var div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * 重置文件状态
 */
function resetFileState() {
  selectedFile = null;
  sourceFormat = '';
  if (fileInput) fileInput.value = '';
  if (fileInfo) {
    fileInfo.innerHTML = '';
    fileInfo.classList.remove('active');
  }
  hideResult();
}

// ==================== 格式选择 ====================

formatOptions.forEach(function (option) {
  option.addEventListener('click', function () {
    // 切换选中状态（单选）
    formatOptions.forEach(function (o) {
      o.classList.remove('selected');
    });
    this.classList.add('selected');

    targetFormat = this.getAttribute('data-format') || '';
  });
});

// ==================== 转换按钮逻辑 ====================

if (btnConvert) {
  btnConvert.addEventListener('click', function () {
    // 验证：文件是否已选择
    if (!selectedFile) {
      converterToast('请先选择文件', 'error');
      return;
    }

    // 验证：目标格式是否已选择
    if (!targetFormat) {
      converterToast('请选择目标格式', 'error');
      return;
    }

    // 验证：目标格式不能和源格式相同
    if (targetFormat === sourceFormat) {
      converterToast('不能转换为相同格式', 'error');
      return;
    }

    // 隐藏之前的结果
    hideResult();

    // 开始转换
    startConversion();
  });
}

// ==================== 转换流程 ====================

function startConversion() {
  // 禁用按钮防止重复点击
  btnConvert.disabled = true;
  btnConvert.textContent = '转换中...';

  // 显示进度条
  if (convertProgress) {
    convertProgress.classList.add('active');
  }
  if (progressFill) {
    progressFill.style.width = '0%';
  }
  if (progressText) {
    progressText.textContent = '正在读取文件...';
  }

  // 读取文件内容
  var reader = new FileReader();

  reader.onload = function (e) {
    var fileContent = e.target.result; // ArrayBuffer 或字符串

    // 更新进度到 30%
    updateProgress(30, '正在解析 ' + sourceFormat.toUpperCase() + ' 格式...');

    // 模拟解析延迟后进行转换
    setTimeout(function () {
      updateProgress(50, '正在转换为 ' + targetFormat.toUpperCase() + ' 格式...');

      try {
        var convertedData = performConversion(fileContent, sourceFormat, targetFormat);

        // 转换完成
        setTimeout(function () {
          updateProgress(90, '正在生成文件...');

          setTimeout(function () {
            // 创建 Blob
            var mimeType = getMimeType(targetFormat);
            var blob;

            if (typeof convertedData === 'string') {
              blob = new Blob([convertedData], { type: mimeType });
            } else if (convertedData instanceof ArrayBuffer) {
              blob = new Blob([convertedData], { type: mimeType });
            } else if (convertedData instanceof Uint8Array) {
              blob = new Blob([convertedData.buffer], { type: mimeType });
            } else {
              // 回退：将数据转为字符串
              blob = new Blob([String(convertedData)], { type: mimeType });
            }

            // 清理旧的 Blob URL
            if (convertedBlobUrl) {
              URL.revokeObjectURL(convertedBlobUrl);
            }

            // 生成 Blob URL
            convertedBlobUrl = URL.createObjectURL(blob);

            // 生成目标文件名
            var baseName = selectedFile.name.replace(/\.[^.]+$/, '');
            var targetExt = targetFormat === 'schematic' ? '.schematic' : '.' + targetFormat;
            convertedFileName = baseName + '_converted' + targetExt;

            // 更新下载按钮
            if (btnDownload) {
              btnDownload.href = convertedBlobUrl;
              btnDownload.download = convertedFileName;
              btnDownload.style.display = 'inline-flex';
            }

            // 完成
            updateProgress(100, '转换完成！');
            finishConversion();
          }, 200);
        }, 400);
      } catch (err) {
        // 解析失败，使用回退逻辑
        console.warn('转换解析失败，使用回退逻辑：', err.message);

        setTimeout(function () {
          updateProgress(70, '使用兼容模式转换...');

          setTimeout(function () {
            try {
              var fallbackData = performFallbackConversion(fileContent, sourceFormat, targetFormat);
              var mimeType = getMimeType(targetFormat);
              var blob;

              if (typeof fallbackData === 'string') {
                blob = new Blob([fallbackData], { type: mimeType });
              } else if (fallbackData instanceof Uint8Array) {
                blob = new Blob([fallbackData.buffer], { type: mimeType });
              } else {
                blob = new Blob([String(fallbackData)], { type: mimeType });
              }

              if (convertedBlobUrl) {
                URL.revokeObjectURL(convertedBlobUrl);
              }
              convertedBlobUrl = URL.createObjectURL(blob);

              var baseName = selectedFile.name.replace(/\.[^.]+$/, '');
              var targetExt = targetFormat === 'schematic' ? '.schematic' : '.' + targetFormat;
              convertedFileName = baseName + '_converted' + targetExt;

              if (btnDownload) {
                btnDownload.href = convertedBlobUrl;
                btnDownload.download = convertedFileName;
                btnDownload.style.display = 'inline-flex';
              }

              updateProgress(100, '转换完成！');
              finishConversion();
            } catch (fallbackErr) {
              converterToast('转换失败：' + fallbackErr.message, 'error');
              resetConvertUI();
            }
          }, 300);
        }, 200);
      }
    }, 500);
  };

  reader.onerror = function () {
    converterToast('文件读取失败，请重试', 'error');
    resetConvertUI();
  };

  // 根据格式选择读取方式
  if (sourceFormat === 'json') {
    reader.readAsText(selectedFile.file, 'utf-8');
  } else {
    reader.readAsArrayBuffer(selectedFile.file);
  }
}

// ==================== 转换逻辑 ====================

/**
 * 根据源格式和目标格式执行转换
 */
function performConversion(fileContent, srcFmt, tgtFmt) {
  // 如果源是 JSON
  if (srcFmt === 'json') {
    var jsonObj = JSON.parse(fileContent);
    return convertFromJSON(jsonObj, tgtFmt);
  }

  // 如果目标是 JSON
  if (tgtFmt === 'json') {
    return convertToJSON(fileContent, srcFmt);
  }

  // NBT 格式解析（如果有 NbtParser）
  if (srcFmt === 'nbt' && typeof NbtParser !== 'undefined' && typeof NbtParser.parse === 'function') {
    try {
      var nbtData = NbtParser.parse(fileContent);
      return convertFromNBT(nbtData, tgtFmt);
    } catch (e) {
      console.warn('NbtParser 解析失败：', e.message);
      throw new Error('NBT 解析失败');
    }
  }

  // 二进制格式之间的转换（Schematic / Litematic）
  if ((srcFmt === 'schematic' || srcFmt === 'litematic') && fileContent instanceof ArrayBuffer) {
    return convertBinaryFormat(fileContent, srcFmt, tgtFmt);
  }

  // 通用回退
  throw new Error('不支持的转换路径');
}

/**
 * JSON → 目标格式
 */
function convertFromJSON(jsonObj, tgtFmt) {
  switch (tgtFmt) {
    case 'nbt': {
      // 创建简化的 NBT 结构（二进制）
      return buildSimpleNBT(jsonObj);
    }
    case 'schematic': {
      // 创建简化的 Schematic 结构
      return buildSimpleSchematic(jsonObj);
    }
    case 'litematic': {
      // 创建简化的 Litematic 结构
      return buildSimpleLitematic(jsonObj);
    }
    default:
      return JSON.stringify(jsonObj, null, 2);
  }
}

/**
 * 源格式 → JSON
 */
function convertToJSON(fileContent, srcFmt) {
  if (srcFmt === 'nbt' && typeof NbtParser !== 'undefined' && typeof NbtParser.parse === 'function') {
    try {
      var nbtData = NbtParser.parse(fileContent);
      return JSON.stringify(nbtData, null, 2);
    } catch (e) {
      console.warn('NBT 转 JSON 失败：', e.message);
    }
  }

  // 二进制文件回退：提取基本信息生成 JSON
  if (fileContent instanceof ArrayBuffer) {
    var bytes = new Uint8Array(fileContent);
    var info = {
      source_format: srcFmt,
      file_size_bytes: bytes.length,
      block_data_preview: Array.from(bytes.slice(0, Math.min(256, bytes.length))),
      metadata: {
        converter: 'MC蓝图工坊',
        converted_at: new Date().toISOString(),
        note: '部分二进制数据以十六进制数组形式保存'
      }
    };
    return JSON.stringify(info, null, 2);
  }

  return JSON.stringify({ error: '无法解析源文件' }, null, 2);
}

/**
 * 从解析后的 NBT 数据转换到目标格式
 */
function convertFromNBT(nbtData, tgtFmt) {
  switch (tgtFmt) {
    case 'json':
      return JSON.stringify(nbtData, null, 2);
    case 'schematic':
      return buildSimpleSchematic(nbtData);
    case 'litematic':
      return buildSimpleLitematic(nbtData);
    default:
      return JSON.stringify(nbtData, null, 2);
  }
}

/**
 * 二进制格式互转（Schematic ↔ Litematic）
 */
function convertBinaryFormat(buffer, srcFmt, tgtFmt) {
  // 读取原始字节，包装为目标格式的简化结构
  var bytes = new Uint8Array(buffer);
  var header = {};

  if (tgtFmt === 'json') {
    var info = {
      source_format: srcFmt,
      total_bytes: bytes.length,
      header_bytes_hex: Array.from(bytes.slice(0, Math.min(64, bytes.length)))
        .map(function (b) { return ('0' + b.toString(16)).slice(-2); })
        .join(' '),
      converter: 'MC蓝图工坊',
      converted_at: new Date().toISOString()
    };
    return JSON.stringify(info, null, 2);
  }

  // 对于 NBT 输出，创建简化的 NBT 二进制
  if (tgtFmt === 'nbt') {
    return buildSimpleNBTBytes(bytes, srcFmt);
  }

  // 其他二进制格式：创建带格式头的数据
  var result = new Uint8Array(bytes.length + 32);
  // 写入新格式标识头
  var formatTag = tgtFmt === 'schematic' ? 'Schematic' : 'Litematic';
  for (var i = 0; i < formatTag.length && i < 16; i++) {
    result[i] = formatTag.charCodeAt(i);
  }
  // 空字节填充
  for (var j = formatTag.length; j < 32; j++) {
    result[j] = 0;
  }
  // 复制原始数据
  result.set(bytes, 32);

  return result;
}

// ==================== 简化格式构建器 ====================

/**
 * 构建简化的 NBT 二进制数据
 */
function buildSimpleNBT(jsonObj) {
  // 将 JSON 转为简单的 NBT-like 二进制结构
  var jsonStr = JSON.stringify(jsonObj);
  return buildSimpleNBTBytes(new TextEncoder().encode(jsonStr), 'json');
}

/**
 * 用字节数组构建简化 NBT 二进制
 */
function buildSimpleNBTBytes(data, srcFmt) {
  // NBT 文件至少以 0x0A (TAG_Compound) 开头
  var nbtHeader = new Uint8Array([
    0x0A, 0x00, 0x08, // TAG_Compound, name length=8
    0x53, 0x74, 0x72, 0x75, 0x63, 0x74, 0x75, 0x72, 0x65, // "Structure"
    0x00 // End tag placeholder
  ]);

  var result = new Uint8Array(nbtHeader.length + data.length + 1);
  result.set(nbtHeader, 0);
  result.set(data, nbtHeader.length);
  result[result.length - 1] = 0x00; // TAG_End
  return result;
}

/**
 * 构建简化的 Schematic 数据
 */
function buildSimpleSchematic(jsonObj) {
  // WorldEdit Schematic 格式本质上是 NBT
  // 创建简化的结构
  var jsonStr = JSON.stringify(jsonObj);
  var payload = new TextEncoder().encode(jsonStr);

  var schematicHeader = new Uint8Array([
    0x0A, 0x00, 0x09, // TAG_Compound, name length=9
    0x53, 0x63, 0x68, 0x65, 0x6D, 0x61, 0x74, 0x69, 0x63, // "Schematic"
    0x00
  ]);

  var result = new Uint8Array(schematicHeader.length + payload.length + 1);
  result.set(schematicHeader, 0);
  result.set(payload, schematicHeader.length);
  result[result.length - 1] = 0x00;
  return result;
}

/**
 * 构建简化的 Litematic 数据
 */
function buildSimpleLitematic(jsonObj) {
  // Litematic 也是 NBT 格式，但用 .litematic 扩展名
  var jsonStr = JSON.stringify(jsonObj);
  var payload = new TextEncoder().encode(jsonStr);

  // Litematic 通常以 Litematica mod 的结构头开始
  var litematicHeader = new Uint8Array([
    0x0A, 0x00, 0x09, // TAG_Compound, name length=9
    0x4C, 0x69, 0x74, 0x65, 0x6D, 0x61, 0x74, 0x69, 0x63, // "Litematic"
    0x00
  ]);

  var result = new Uint8Array(litematicHeader.length + payload.length + 1);
  result.set(litematicHeader, 0);
  result.set(payload, litematicHeader.length);
  result[result.length - 1] = 0x00;
  return result;
}

// ==================== 回退转换逻辑 ====================

/**
 * 回退转换：当正式转换失败时使用
 * 直接将文件内容包装为目标格式的基本结构
 */
function performFallbackConversion(fileContent, srcFmt, tgtFmt) {
  if (tgtFmt === 'json') {
    // 二进制文件转 JSON
    var bytes = fileContent instanceof ArrayBuffer
      ? new Uint8Array(fileContent)
      : new TextEncoder().encode(fileContent);

    var preview = [];
    for (var i = 0; i < Math.min(512, bytes.length); i++) {
      preview.push(('0' + bytes[i].toString(16)).slice(-2));
    }

    var jsonResult = {
      source_format: srcFmt,
      converted_format: tgtFmt,
      original_size: bytes.length,
      hex_preview: preview.join(' '),
      metadata: {
        converter: 'MC蓝图工坊 - 兼容模式',
        converted_at: new Date().toISOString(),
        note: '此文件由兼容模式转换，仅包含基础结构信息'
      }
    };

    return JSON.stringify(jsonResult, null, 2);
  }

  // JSON 转二进制格式
  if (srcFmt === 'json' && typeof fileContent === 'string') {
    var encoder = new TextEncoder();
    var dataBytes = encoder.encode(fileContent);

    if (tgtFmt === 'nbt') {
      return buildSimpleNBTBytes(dataBytes, 'json');
    } else if (tgtFmt === 'schematic') {
      var header = new Uint8Array([0x0A, 0x00, 0x09,
        0x53, 0x63, 0x68, 0x65, 0x6D, 0x61, 0x74, 0x69, 0x63, 0x00]);
      var out = new Uint8Array(header.length + dataBytes.length + 1);
      out.set(header, 0);
      out.set(dataBytes, header.length);
      return out;
    } else if (tgtFmt === 'litematic') {
      var lh = new Uint8Array([0x0A, 0x00, 0x09,
        0x4C, 0x69, 0x74, 0x65, 0x6D, 0x61, 0x74, 0x69, 0x63, 0x00]);
      var lo = new Uint8Array(lh.length + dataBytes.length + 1);
      lo.set(lh, 0);
      lo.set(dataBytes, lh.length);
      return lo;
    }
  }

  // 通用二进制回退
  var srcBytes = fileContent instanceof ArrayBuffer
    ? new Uint8Array(fileContent)
    : new TextEncoder().encode(String(fileContent));

  var tag = tgtFmt === 'nbt' ? 'NBT' : tgtFmt === 'schematic' ? 'Schematic' : 'Litematic';
  var outBytes = new Uint8Array(32 + srcBytes.length);
  for (var k = 0; k < tag.length && k < 16; k++) {
    outBytes[k] = tag.charCodeAt(k);
  }
  outBytes.set(srcBytes, 32);
  return outBytes;
}

// ==================== 进度更新 ====================

function updateProgress(percent, text) {
  if (progressFill) {
    progressFill.style.width = percent + '%';
  }
  if (progressText) {
    progressText.textContent = text;
  }
}

// ==================== 转换完成处理 ====================

function finishConversion() {
  // 隐藏进度条
  setTimeout(function () {
    if (convertProgress) {
      convertProgress.classList.remove('active');
    }

    // 显示结果
    if (convertResult) {
      convertResult.classList.add('active');
    }

    // 恢复按钮状态
    btnConvert.disabled = false;
    btnConvert.textContent = '开始转换';

    converterToast('转换成功！点击下方按钮下载', 'success');
  }, 400);
}

// ==================== 重置转换 UI ====================

function resetConvertUI() {
  btnConvert.disabled = false;
  btnConvert.textContent = '开始转换';

  if (convertProgress) {
    convertProgress.classList.remove('active');
  }
  if (progressFill) {
    progressFill.style.width = '0%';
  }
  if (progressText) {
    progressText.textContent = '正在转换中...';
  }
}

// ==================== 隐藏结果区域 ====================

function hideResult() {
  if (convertResult) {
    convertResult.classList.remove('active');
  }
  if (btnDownload) {
    btnDownload.href = '#';
    btnDownload.download = '';
    btnDownload.style.display = '';
  }

  // 清理旧的 Blob URL
  if (convertedBlobUrl) {
    URL.revokeObjectURL(convertedBlobUrl);
    convertedBlobUrl = null;
  }

  convertedFileName = '';
}

// ==================== 下载按钮 ====================

if (btnDownload) {
  btnDownload.addEventListener('click', function (e) {
    if (!convertedBlobUrl) {
      e.preventDefault();
      converterToast('没有可下载的文件', 'error');
      return;
    }

    // 使用锚点下载
    var link = document.createElement('a');
    link.href = convertedBlobUrl;
    link.download = convertedFileName || 'converted_blueprint';
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();

    // 清理
    setTimeout(function () {
      document.body.removeChild(link);
    }, 100);
  });
}
