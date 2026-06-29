/**
 * MC蓝图工坊 - 蓝图上传逻辑
 * 文件上传、表单验证、提交到 Cloudflare Worker
 */

// ==================== DOM 引用 ====================

var uploadZone = document.getElementById('upload-zone');
var fileInput = document.getElementById('file-input');
var fileInfo = document.getElementById('file-info');
var previewZone = document.getElementById('preview-zone');
var previewInput = document.getElementById('preview-input');
var previewInfo = document.getElementById('preview-info');
var uploadForm = document.getElementById('upload-form');
var btnUpload = document.getElementById('btn-upload');
var uploadProgress = document.getElementById('upload-progress');
var progressFill = document.getElementById('upload-progress-fill');
var progressText = document.getElementById('upload-progress-text');
var uploadResult = document.getElementById('upload-result');

// ==================== 状态变量 ====================

var selectedFile = null;
var selectedPreview = null;
var isUploading = false;

// ==================== Toast 提示 ====================

function uploadToast(message, type) {
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

function getFileExtension(filename) {
  var parts = filename.split('.');
  if (parts.length > 1) {
    return parts.pop().toLowerCase();
  }
  return '';
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

function isSupportedFormat(ext) {
  return ['nbt', 'schematic', 'litematic', 'json'].indexOf(ext) !== -1;
}

// ==================== 上传区域：点击打开文件对话框 ====================

if (uploadZone) {
  uploadZone.addEventListener('click', function (e) {
    if (e.target.closest('.file-info')) return;
    fileInput.click();
  });
}

// ==================== 预览图上传区域：点击 ====================

if (previewZone) {
  previewZone.addEventListener('click', function (e) {
    if (e.target.closest('.preview-info')) return;
    previewInput.click();
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

if (previewInput) {
  previewInput.addEventListener('change', function () {
    if (this.files && this.files.length > 0) {
      handlePreviewSelected(this.files[0]);
    }
  });
}

function handleFileSelected(file) {
  var ext = getFileExtension(file.name);

  if (!isSupportedFormat(ext)) {
    uploadToast('文件格式不支持', 'error');
    resetFileState();
    return;
  }

  if (file.size > 10 * 1024 * 1024) {
    uploadToast('文件大小超过限制（最大 10MB）', 'error');
    resetFileState();
    return;
  }

  selectedFile = file;

  if (fileInfo) {
    fileInfo.innerHTML =
      '<strong>文件名：</strong>' + file.name +
      '<br><strong>大小：</strong>' + formatFileSize(file.size) +
      '<br><strong>格式：</strong>' + ext.toUpperCase();
    fileInfo.classList.add('active');
  }

  hideResult();
}

function handlePreviewSelected(file) {
  var ext = getFileExtension(file.name);

  if (['png', 'jpg', 'jpeg'].indexOf(ext) === -1) {
    uploadToast('预览图格式不支持（仅支持 PNG/JPG）', 'error');
    selectedPreview = null;
    if (previewInfo) {
      previewInfo.innerHTML = '';
      previewInfo.classList.remove('active');
    }
    return;
  }

  if (file.size > 5 * 1024 * 1024) {
    uploadToast('预览图大小超过限制（最大 5MB）', 'error');
    selectedPreview = null;
    return;
  }

  selectedPreview = file;

  if (previewInfo) {
    previewInfo.innerHTML =
      '<strong>文件名：</strong>' + file.name +
      '<br><strong>大小：</strong>' + formatFileSize(file.size);

    // 显示预览图缩略图
    if (window.FileReader) {
      var reader = new FileReader();
      reader.onload = function (e) {
        previewInfo.innerHTML +=
          '<br><img src="' + e.target.result + '" class="preview-thumb" alt="预览">';
      };
      reader.readAsDataURL(file);
    }

    previewInfo.classList.add('active');
  }
}

function resetFileState() {
  selectedFile = null;
  if (fileInput) fileInput.value = '';
  if (fileInfo) {
    fileInfo.innerHTML = '';
    fileInfo.classList.remove('active');
  }
  hideResult();
}

// ==================== 表单提交 ====================

if (uploadForm) {
  uploadForm.addEventListener('submit', function (e) {
    e.preventDefault();

    if (!selectedFile) {
      uploadToast('请先选择蓝图文件', 'error');
      return;
    }

    if (isUploading) {
      return;
    }

    submitUpload();
  });
}

// ==================== 提交上传 ====================

async function submitUpload() {
  isUploading = true;
  btnUpload.disabled = true;
  btnUpload.textContent = '上传中...';

  showProgress();
  updateProgress(10, '准备上传...');

  try {
    var formData = new FormData();
    formData.append('blueprint_file', selectedFile);

    // 添加预览图（如果有）
    if (selectedPreview) {
      formData.append('preview_image', selectedPreview);
    }

    var formElements = uploadForm.elements;
    for (var i = 0; i < formElements.length; i++) {
      var elem = formElements[i];
      if (elem.name) {
        if (elem.type === 'checkbox') {
          if (elem.checked) {
            formData.append(elem.name + '[]', elem.value);
          }
        } else {
          formData.append(elem.name, elem.value);
        }
      }
    }

    updateProgress(20, '正在上传文件...');

    var response = await fetch('https://qq-auth.wqclo.workers.dev/upload', {
      method: 'POST',
      body: formData
    });

    updateProgress(80, '处理上传数据...');

    var result = await response.json();

    if (!response.ok || result.error) {
      throw new Error(result.error || '上传失败');
    }

    updateProgress(100, '上传完成！');

    setTimeout(function () {
      hideProgress();
      showResult();
      btnUpload.disabled = false;
      btnUpload.textContent = '提交上传';
      isUploading = false;
      uploadToast('上传成功！', 'success');
    }, 500);

  } catch (err) {
    console.error('上传失败:', err);
    uploadToast('上传失败：' + err.message, 'error');
    hideProgress();
    btnUpload.disabled = false;
    btnUpload.textContent = '提交上传';
    isUploading = false;
  }
}

// ==================== 进度更新 ====================

function showProgress() {
  if (uploadProgress) {
    uploadProgress.classList.add('active');
  }
}

function hideProgress() {
  if (uploadProgress) {
    uploadProgress.classList.remove('active');
  }
}

function updateProgress(percent, text) {
  if (progressFill) {
    progressFill.style.width = percent + '%';
  }
  if (progressText) {
    progressText.textContent = text;
  }
}

function showResult() {
  if (uploadResult) {
    uploadResult.classList.add('active');
  }
}

function hideResult() {
  if (uploadResult) {
    uploadResult.classList.remove('active');
  }
}