/**
 * MC蓝图工坊 - 蓝图库逻辑
 * 蓝图数据、卡片渲染、模态框、搜索与筛选
 */

// ==================== 蓝图数据 ====================

const blueprints = [
  {
    id: 1,
    name: '中世纪城堡',
    description: '一座精美的中世纪石砖城堡，包含塔楼、城墙和内部大厅',
    format: 'nbt',
    size: '2.4 MB',
    dimensions: '64x45x64',
    blocks: 12840,
    preview: '',
    date: '2025-01-15'
  },
  {
    id: 2,
    name: '日式神社',
    description: '传统日式鸟居神社建筑，包含石灯笼和樱花树装饰',
    format: 'schematic',
    size: '1.8 MB',
    dimensions: '32x20x48',
    blocks: 5620,
    preview: '',
    date: '2025-02-20'
  },
  {
    id: 3,
    name: '现代别墅',
    description: '现代风格的豪华别墅，带泳池、车库和花园',
    format: 'litematic',
    size: '3.1 MB',
    dimensions: '48x25x56',
    blocks: 18200,
    preview: '',
    date: '2025-03-10'
  }
];

// ==================== 占位图标 ====================

const formatIcons = {
  nbt: '\u{1F9E8}',       // 石砖
  schematic: '\u{1F4D0}',  // 卷轴/图纸
  litematic: '\u{2728}',   // 闪光
  json: '\u{1F4C4}'        // 文档
};

// ==================== 格式名称映射 ====================

const formatNames = {
  nbt: 'NBT',
  schematic: 'Schematic',
  litematic: 'Litematic',
  json: 'JSON'
};

// ==================== Toast 提示（复用 auth.js 的 showToast，提供回退） ====================

function galleryToast(message, type) {
  if (typeof showToast === 'function') {
    showToast(message, type);
    return;
  }

  let toast = document.getElementById('toast');
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

// ==================== 当前筛选状态 ====================

let currentFilter = 'all';
let currentSearch = '';

// ==================== 渲染蓝图卡片 ====================

function renderGallery(filter, search) {
  filter = filter || 'all';
  search = (search || '').toLowerCase().trim();

  currentFilter = filter;
  currentSearch = search;

  var grid = document.getElementById('blueprint-grid');
  if (!grid) return;

  grid.innerHTML = '';

  // 根据格式筛选
  var filtered = blueprints.filter(function (bp) {
    // 格式筛选（"all" 不做过滤）
    if (filter && filter !== 'all' && bp.format !== filter) {
      return false;
    }

    // 搜索词匹配（名称或描述）
    if (search) {
      var nameMatch = bp.name.toLowerCase().indexOf(search) !== -1;
      var descMatch = bp.description.toLowerCase().indexOf(search) !== -1;
      if (!nameMatch && !descMatch) {
        return false;
      }
    }

    return true;
  });

  // 空状态
  if (filtered.length === 0) {
    var empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.innerHTML =
      '<span class="empty-icon">\u{1F50D}</span>' +
      '<h3>没有找到匹配的蓝图</h3>' +
      '<p>尝试更换筛选条件或搜索关键词</p>';
    grid.appendChild(empty);
    return;
  }

  // 渲染卡片
  filtered.forEach(function (bp) {
    var card = createBlueprintCard(bp);
    grid.appendChild(card);
  });
}

// ==================== 创建蓝图卡片 ====================

function createBlueprintCard(bp) {
  var card = document.createElement('div');
  card.className = 'blueprint-card';
  card.setAttribute('data-id', bp.id);

  // --- 卡片预览区 ---
  var preview = document.createElement('div');
  preview.className = 'card-preview';

  if (bp.preview) {
    var img = document.createElement('img');
    img.src = bp.preview;
    img.alt = bp.name;
    img.loading = 'lazy';
    preview.appendChild(img);
  } else {
    var placeholder = document.createElement('div');
    placeholder.className = 'placeholder-preview';
    placeholder.textContent = formatIcons[bp.format] || '\u{1F3D7}';
    preview.appendChild(placeholder);
  }

  // 格式标签
  var badge = document.createElement('span');
  badge.className = 'format-badge ' + bp.format;
  badge.textContent = formatNames[bp.format] || bp.format.toUpperCase();
  preview.appendChild(badge);

  card.appendChild(preview);

  // --- 卡片主体 ---
  var body = document.createElement('div');
  body.className = 'card-body';

  var title = document.createElement('h3');
  title.className = 'card-title';
  title.textContent = bp.name;
  body.appendChild(title);

  var desc = document.createElement('p');
  desc.className = 'card-desc';
  desc.textContent = bp.description;
  body.appendChild(desc);

  // --- 卡片元信息 ---
  var meta = document.createElement('div');
  meta.className = 'card-meta';

  var formatLabel = document.createElement('span');
  formatLabel.className = 'format';
  formatLabel.textContent = formatNames[bp.format] || bp.format.toUpperCase();
  meta.appendChild(formatLabel);

  var sizeLabel = document.createElement('span');
  sizeLabel.className = 'size';
  sizeLabel.textContent = bp.size;
  meta.appendChild(sizeLabel);

  body.appendChild(meta);

  // --- 卡片操作按钮 ---
  var actions = document.createElement('div');
  actions.className = 'card-actions';

  var dlBtn = document.createElement('a');
  dlBtn.className = 'btn-download-sm';
  dlBtn.href = '#';
  dlBtn.textContent = '下载';
  dlBtn.addEventListener('click', function (e) {
    e.preventDefault();
    e.stopPropagation();
    openModal(bp.id);
  });
  actions.appendChild(dlBtn);

  body.appendChild(actions);

  card.appendChild(body);

  // 点击卡片打开详情
  card.addEventListener('click', function () {
    openModal(bp.id);
  });

  return card;
}

// ==================== 打开模态框 ====================

function openModal(blueprintId) {
  var bp = null;
  for (var i = 0; i < blueprints.length; i++) {
    if (blueprints[i].id === blueprintId) {
      bp = blueprints[i];
      break;
    }
  }
  if (!bp) return;

  var overlay = document.getElementById('modal');
  var modalImage = document.getElementById('modal-image');
  var modalTitle = document.getElementById('modal-title');
  var modalDesc = document.getElementById('modal-desc');
  var modalDetails = document.getElementById('modal-details');
  var modalDownloads = document.getElementById('modal-downloads');

  if (!overlay) return;

  // 图片区域
  modalImage.innerHTML = '';
  if (bp.preview) {
    var img = document.createElement('img');
    img.src = bp.preview;
    img.alt = bp.name;
    modalImage.appendChild(img);
  } else {
    var placeholder = document.createElement('div');
    placeholder.className = 'placeholder-preview';
    placeholder.style.fontSize = '80px';
    placeholder.style.opacity = '0.4';
    placeholder.textContent = formatIcons[bp.format] || '\u{1F3D7}';
    modalImage.appendChild(placeholder);
  }

  // 标题和描述
  modalTitle.textContent = bp.name;
  modalDesc.textContent = bp.description;

  // 详情网格
  modalDetails.innerHTML = '';

  var detailsData = [
    { label: '格式', value: formatNames[bp.format] || bp.format.toUpperCase() },
    { label: '尺寸', value: bp.dimensions },
    { label: '方块数', value: bp.blocks.toLocaleString() },
    { label: '文件大小', value: bp.size }
  ];

  detailsData.forEach(function (item) {
    var div = document.createElement('div');
    div.className = 'detail-item';
    div.innerHTML =
      '<div class="label">' + item.label + '</div>' +
      '<div class="value">' + item.value + '</div>';
    modalDetails.appendChild(div);
  });

  // 下载按钮（所有支持格式）
  modalDownloads.innerHTML = '';

  var allFormats = ['nbt', 'schematic', 'litematic', 'json'];
  allFormats.forEach(function (fmt) {
    var btn = document.createElement('a');
    btn.className = 'btn-download-sm';
    btn.href = '#';
    btn.textContent = formatNames[fmt] + ' 下载';
    if (fmt === bp.format) {
      btn.style.opacity = '0.5';
      btn.style.pointerEvents = 'none';
      btn.title = '当前格式';
    } else {
      btn.title = '下载 ' + formatNames[fmt] + ' 格式';
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        galleryToast('开始下载 ' + bp.name + ' (' + formatNames[fmt] + ')', 'success');
      });
    }
    modalDownloads.appendChild(btn);
  });

  // 显示模态框
  overlay.classList.add('active');
  document.body.style.overflow = 'hidden';
}

// ==================== 关闭模态框 ====================

function closeModal() {
  var overlay = document.getElementById('modal');
  if (!overlay) return;
  overlay.classList.remove('active');
  document.body.style.overflow = '';
}

// ==================== 事件绑定 ====================

document.addEventListener('DOMContentLoaded', function () {

  // --- 搜索输入 ---
  var searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('input', function () {
      renderGallery(currentFilter, this.value);
    });
  }

  // --- 格式筛选标签 ---
  var filterChips = document.querySelectorAll('#filter-chips .filter-chip');
  filterChips.forEach(function (chip) {
    chip.addEventListener('click', function () {
      // 移除所有 active
      filterChips.forEach(function (c) {
        c.classList.remove('active');
      });
      // 添加当前 active
      this.classList.add('active');

      var filter = this.getAttribute('data-filter') || 'all';
      renderGallery(filter, currentSearch);
    });
  });

  // --- 模态框关闭按钮 ---
  var modalClose = document.getElementById('modal-close');
  if (modalClose) {
    modalClose.addEventListener('click', function (e) {
      e.stopPropagation();
      closeModal();
    });
  }

  // --- 点击模态框外部关闭 ---
  var modalOverlay = document.getElementById('modal');
  if (modalOverlay) {
    modalOverlay.addEventListener('click', function (e) {
      // 只在点击遮罩层本身时关闭（不包含内容区）
      if (e.target === modalOverlay) {
        closeModal();
      }
    });
  }

  // --- Escape 键关闭模态框 ---
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' || e.keyCode === 27) {
      var overlay = document.getElementById('modal');
      if (overlay && overlay.classList.contains('active')) {
        closeModal();
      }
    }
  });

  // --- 初始渲染 ---
  renderGallery('all', '');
});
