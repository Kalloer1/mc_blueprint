/**
 * MC蓝图工坊 - 蓝图库逻辑
 * 蓝图数据、卡片渲染、模态框、搜索与筛选
 */

// ==================== 蓝图数据 ====================

// 蓝图数据将从 data.json 动态加载
let blueprints = [];
let supportedFormats = [];

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

// ==================== 辅助函数 ====================

/**
 * 根据蓝图名称和格式生成下载文件名
 */
function generateDownloadFilename(name, format) {
  var ext = format === 'schematic' ? '.schematic' : '.' + format;
  // 将名称转为安全的文件名
  var safeName = name.replace(/[^\w\u4e00-\u9fa5\-]/g, '_');
  return safeName + ext;
}

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

// ==================== 数据加载 ====================

/**
 * 从蓝图数据中提取所有标签
 */
function extractTags(bps) {
  var tagSet = new Set();
  bps.forEach(function (bp) {
    if (bp.tags && Array.isArray(bp.tags)) {
      bp.tags.forEach(function (tag) {
        tagSet.add(tag);
      });
    }
  });
  availableTags = Array.from(tagSet);
}

/**
 * 渲染版本筛选按钮
 */
function renderVersionChips() {
  var versionChips = document.getElementById('version-chips');
  if (!versionChips) return;

  versionChips.innerHTML = '';

  mcVersions.forEach(function (ver) {
    var chip = document.createElement('span');
    chip.className = 'filter-chip' + (ver.id === 'all' ? ' active' : '');
    chip.setAttribute('data-version', ver.id);
    chip.textContent = ver.name;
    versionChips.appendChild(chip);
  });
}

/**
 * 渲染模组筛选按钮
 */
function renderModChips() {
  var modChips = document.getElementById('mod-chips');
  if (!modChips) return;

  modChips.innerHTML = '';

  modDependencies.forEach(function (mod) {
    var chip = document.createElement('span');
    chip.className = 'filter-chip' + (mod.id === 'vanilla' ? ' active' : '');
    chip.setAttribute('data-mod', mod.id);
    chip.textContent = mod.name;
    chip.title = mod.description;
    modChips.appendChild(chip);
  });
}

/**
 * 渲染标签筛选按钮
 */
function renderTagChips() {
  var tagChips = document.getElementById('tag-chips');
  if (!tagChips) return;

  tagChips.innerHTML = '';

  // 全部标签按钮
  var allChip = document.createElement('span');
  allChip.className = 'filter-chip active';
  allChip.setAttribute('data-tag', 'all');
  allChip.textContent = '全部标签';
  tagChips.appendChild(allChip);

  // 各标签按钮
  availableTags.forEach(function (tag) {
    var chip = document.createElement('span');
    chip.className = 'filter-chip';
    chip.setAttribute('data-tag', tag);
    chip.textContent = tag;
    tagChips.appendChild(chip);
  });
}

/**
 * 从 data.json 加载蓝图数据
 */
async function loadBlueprints() {
  var grid = document.getElementById('blueprint-grid');
  if (!grid) return;

  // 显示加载状态
  grid.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>正在加载蓝图数据...</p></div>';

  try {
    var response = await fetch('./blueprints/data.json');
    if (!response.ok) {
      throw new Error('加载失败: ' + response.status);
    }
    var data = await response.json();

    blueprints = data.blueprints || [];
    supportedFormats = data.supportedFormats || [];
    mcVersions = data.mcVersions || [];
    modDependencies = data.modDependencies || [];
    modLinks = data.modLinks || {};

    // 提取所有标签
    extractTags(blueprints);

    // 渲染筛选按钮
    renderVersionChips();
    renderModChips();
    renderTagChips();

    // 加载成功，渲染蓝图
    renderGallery('all', 'all', 'all', 'all', '', 'time_desc');
  } catch (err) {
    console.error('加载蓝图数据失败:', err);
    grid.innerHTML = '<div class="empty-state"><span class="empty-icon">&#x1F4E6;</span><h3>加载失败</h3><p>无法加载蓝图数据，请稍后重试</p></div>';
    galleryToast('蓝图数据加载失败', 'error');
  }
}

// ==================== 当前筛选状态 ====================

let currentFilter = 'all';
let currentTag = 'all';
let currentVersion = 'all';
let currentMod = 'all';
let currentSearch = '';
let currentSort = 'time_desc'; // 默认按时间排序（新→旧）
let availableTags = []; // 从数据中提取的所有标签
let mcVersions = [];    // 游戏版本列表
let modDependencies = []; // 模组依赖列表
let modLinks = {};      // 模组下载链接
let currentPage = 1;     // 当前页码
let pageSize = 12;       // 每页显示数量
let totalFiltered = 0;   // 筛选后的总数

// ==================== 收藏功能 ====================

const FAVORITES_KEY = 'mc_blueprint_favorites';

function getFavorites() {
  var favs = localStorage.getItem(FAVORITES_KEY);
  return favs ? JSON.parse(favs) : [];
}

function isFavorite(id) {
  var favs = getFavorites();
  return favs.indexOf(id) !== -1;
}

function toggleFavorite(id) {
  var favs = getFavorites();
  var index = favs.indexOf(id);
  if (index === -1) {
    favs.push(id);
    galleryToast('已添加收藏', 'success');
  } else {
    favs.splice(index, 1);
    galleryToast('已取消收藏', 'success');
  }
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(favs));
}

// ==================== 排序功能 ====================

function sortBlueprints(list, sortType) {
  var sorted = list.slice();
  switch (sortType) {
    case 'time_desc':
      sorted.sort(function (a, b) {
        return new Date(b.upload_time || b.date) - new Date(a.upload_time || a.date);
      });
      break;
    case 'time_asc':
      sorted.sort(function (a, b) {
        return new Date(a.upload_time || a.date) - new Date(b.upload_time || b.date);
      });
      break;
    case 'name':
      sorted.sort(function (a, b) {
        return a.name.localeCompare(b.name, 'zh-CN');
      });
      break;
    case 'size':
      sorted.sort(function (a, b) {
        var sizeA = parseFloat(a.size) || 0;
        var sizeB = parseFloat(b.size) || 0;
        return sizeB - sizeA;
      });
      break;
  }
  return sorted;
}

// ==================== 渲染蓝图卡片 ====================

function renderGallery(filter, version, mod, tag, search, sort, loadMore) {
  filter = filter || 'all';
  version = version || 'all';
  mod = mod || 'all';
  tag = tag || 'all';
  search = (search || '').toLowerCase().trim();
  sort = sort || currentSort;

  currentFilter = filter;
  currentVersion = version;
  currentMod = mod;
  currentTag = tag;
  currentSearch = search;
  currentSort = sort;

  var grid = document.getElementById('blueprint-grid');
  if (!grid) return;

  // 如果不是"加载更多"，清空并重置页码
  if (!loadMore) {
    grid.innerHTML = '';
    currentPage = 1;
  }

  // 根据格式、版本、模组、标签和搜索词筛选
  var filtered = blueprints.filter(function (bp) {
    // 仅显示已审核的蓝图
    if (!bp.is_approved) {
      return false;
    }

    // 格式筛选（"all" 不做过滤）
    if (filter && filter !== 'all' && bp.format !== filter) {
      return false;
    }

    // 版本筛选（"all" 不做过滤）
    if (version && version !== 'all') {
      if (bp.mc_version !== version) {
        return false;
      }
    }

    // 模组筛选（"all" 不做过滤）
    if (mod && mod !== 'all') {
      if (mod === 'vanilla') {
        if (bp.mod_dependencies && bp.mod_dependencies.length > 0) {
          return false;
        }
      } else {
        if (!bp.mod_dependencies || bp.mod_dependencies.indexOf(mod) === -1) {
          return false;
        }
      }
    }

    // 标签筛选（"all" 不做过滤）
    if (tag && tag !== 'all') {
      if (!bp.tags || bp.tags.indexOf(tag) === -1) {
        return false;
      }
    }

    // 搜索词匹配（名称或描述，支持模糊搜索）
    if (search) {
      var nameMatch = bp.name.toLowerCase().indexOf(search) !== -1;
      var descMatch = bp.description.toLowerCase().indexOf(search) !== -1;
      var tagMatch = false;
      if (bp.tags && Array.isArray(bp.tags)) {
        tagMatch = bp.tags.some(function(t) { return t.toLowerCase().indexOf(search) !== -1; });
      }
      if (!nameMatch && !descMatch && !tagMatch) {
        return false;
      }
    }

    return true;
  });

  totalFiltered = filtered.length;

  // 排序
  filtered = sortBlueprints(filtered, sort);

  // 分页
  var start = (currentPage - 1) * pageSize;
  var end = start + pageSize;
  var currentPageItems = filtered.slice(start, end);

  // 空状态（仅在首页）
  if (filtered.length === 0 && !loadMore) {
    var empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.innerHTML =
      '<span class="empty-icon">\u{1F50D}</span>' +
      '<h3>没有找到匹配的蓝图</h3>' +
      '<p>尝试更换筛选条件或搜索关键词</p>';
    grid.appendChild(empty);
    return;
  }

  // 渲染当前页卡片
  currentPageItems.forEach(function (bp) {
    var card = createBlueprintCard(bp);
    grid.appendChild(card);
  });

  // 移除旧的"加载更多"按钮
  var oldBtn = document.getElementById('load-more-btn');
  if (oldBtn) oldBtn.remove();

  // 添加"加载更多"按钮
  if (end < filtered.length) {
    var loadMoreBtn = document.createElement('button');
    loadMoreBtn.id = 'load-more-btn';
    loadMoreBtn.className = 'load-more-btn';
    loadMoreBtn.textContent = '加载更多 (' + (filtered.length - end) + ' 个)';
    loadMoreBtn.addEventListener('click', function () {
      currentPage++;
      renderGallery(currentFilter, currentVersion, currentMod, currentTag, currentSearch, currentSort, true);
    });
    grid.appendChild(loadMoreBtn);
  }
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
    img.addEventListener('error', function() {
      img.style.display = 'none';
      var placeholder = document.createElement('div');
      placeholder.className = 'placeholder-preview';
      placeholder.textContent = formatIcons[bp.format] || '\u{1F3D7}';
      preview.appendChild(placeholder);
    });
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

  // 版本标签
  if (bp.mc_version) {
    var versionBadge = document.createElement('span');
    versionBadge.className = 'version-badge';
    versionBadge.textContent = bp.mc_version;
    preview.appendChild(versionBadge);
  }

  // 收藏按钮
  var favBtn = document.createElement('button');
  favBtn.className = 'favorite-btn' + (isFavorite(bp.id) ? ' favorited' : '');
  favBtn.innerHTML = isFavorite(bp.id) ? '\u2605' : '\u2606';
  favBtn.title = isFavorite(bp.id) ? '取消收藏' : '添加收藏';
  favBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    toggleFavorite(bp.id);
    favBtn.className = 'favorite-btn' + (isFavorite(bp.id) ? ' favorited' : '');
    favBtn.innerHTML = isFavorite(bp.id) ? '\u2605' : '\u2606';
    favBtn.title = isFavorite(bp.id) ? '取消收藏' : '添加收藏';
  });
  preview.appendChild(favBtn);

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

  // 作者信息
  if (bp.author) {
    var authorLabel = document.createElement('span');
    authorLabel.className = 'author';
    authorLabel.textContent = 'by ' + bp.author;
    meta.appendChild(authorLabel);
  }

  var sizeLabel = document.createElement('span');
  sizeLabel.className = 'size';
  sizeLabel.textContent = bp.size;
  meta.appendChild(sizeLabel);

  // 模组依赖标签
  if (bp.mod_names && bp.mod_names.length > 0) {
    var modLabel = document.createElement('span');
    modLabel.className = 'mod-dependency';
    modLabel.textContent = bp.mod_names[0];
    if (bp.mod_names.length > 1) {
      modLabel.title = '依赖模组: ' + bp.mod_names.join(', ');
    }
    meta.appendChild(modLabel);
  }

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
    { label: '文件大小', value: bp.size },
    { label: '游戏版本', value: bp.mc_version || '未知' },
    { label: '上传者', value: bp.author || '匿名玩家' }
  ];

  // 添加模组依赖信息
  if (bp.mod_names && bp.mod_names.length > 0) {
    detailsData.push({ label: '模组依赖', value: bp.mod_names.join(', ') });
  } else {
    detailsData.push({ label: '模组依赖', value: '无（原版）' });
  }

  // 添加上传时间
  if (bp.upload_time) {
    var uploadDate = new Date(bp.upload_time);
    detailsData.push({ label: '上传时间', value: uploadDate.toLocaleDateString('zh-CN') });
  } else if (bp.date) {
    detailsData.push({ label: '上传时间', value: bp.date });
  }

  detailsData.forEach(function (item) {
    var div = document.createElement('div');
    div.className = 'detail-item';
    div.innerHTML =
      '<div class="label">' + item.label + '</div>' +
      '<div class="value">' + item.value + '</div>';
    modalDetails.appendChild(div);
  });

  // --- 依赖模组下载区域 ---
  if (bp.mod_dependencies && bp.mod_dependencies.length > 0 && modLinks) {
    var modSection = document.createElement('div');
    modSection.className = 'mod-download-section';

    var modTitle = document.createElement('h4');
    modTitle.className = 'mod-section-title';
    modTitle.textContent = '\u{1F4E6} 依赖模组下载';
    modSection.appendChild(modTitle);

    var modHint = document.createElement('p');
    modHint.className = 'mod-section-hint';
    modHint.textContent = '使用此蓝图需要先安装以下模组：';
    modSection.appendChild(modHint);

    var modList = document.createElement('div');
    modList.className = 'mod-download-list';

    bp.mod_dependencies.forEach(function (modId) {
      var modInfo = modDependencies.find(function (m) { return m.id === modId; });
      var modName = modInfo ? modInfo.name : modId;
      var modLink = modLinks[modId] || '#';

      var modItem = document.createElement('a');
      modItem.className = 'mod-download-link';
      modItem.href = modLink;
      modItem.target = '_blank';
      modItem.rel = 'noopener noreferrer';

      // 判断来源（Modrinth 或 CurseForge）
      var sourceIcon = modLink.includes('modrinth') ? '\u{1F4E6}' : '\u{1F3AE}';
      modItem.innerHTML =
        '<span class="mod-icon">' + sourceIcon + '</span>' +
        '<span class="mod-name">' + modName + '</span>' +
        '<span class="mod-source">' + (modLink.includes('modrinth') ? 'Modrinth' : 'CurseForge') + '</span>';

      modList.appendChild(modItem);
    });

    modSection.appendChild(modList);
    modalDetails.appendChild(modSection);
  }

  // 下载按钮（所有支持格式）
  modalDownloads.innerHTML = '';

  var allFormats = ['nbt', 'schematic', 'litematic', 'json'];
  allFormats.forEach(function (fmt) {
    var btn = document.createElement('a');
    btn.className = 'btn-download-sm';

    if (fmt === bp.format) {
      // 当前格式：直接下载原文件
      btn.href = bp.download || '#';
      btn.download = generateDownloadFilename(bp.name, fmt);
      btn.textContent = formatNames[fmt] + ' 下载';
      btn.title = '下载原格式文件';
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        galleryToast('开始下载 ' + bp.name, 'success');
      });
    } else {
      // 其他格式：需要转换（跳转到转换页面）
      btn.href = './converter.html';
      btn.textContent = formatNames[fmt] + ' 格式';
      btn.title = '跳转到格式转换页面';
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        galleryToast('请使用格式转换功能转换为此格式', 'success');
      });
    }
    modalDownloads.appendChild(btn);
  });

  // 添加转换提示
  var convertTip = document.createElement('p');
  convertTip.style.cssText = 'font-size: 12px; color: #999; margin-top: 8px;';
  convertTip.textContent = '其他格式请使用「格式转换」功能';
  modalDownloads.appendChild(convertTip);

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
      renderGallery(currentFilter, currentVersion, currentMod, currentTag, this.value, currentSort);
    });
  }

  // --- 排序选择器 ---
  var sortSelect = document.getElementById('sort-select');
  if (sortSelect) {
    sortSelect.addEventListener('change', function () {
      renderGallery(currentFilter, currentVersion, currentMod, currentTag, currentSearch, this.value);
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
      renderGallery(filter, currentVersion, currentMod, currentTag, currentSearch, currentSort);
    });
  });

  // --- 版本筛选按钮（动态绑定，使用事件委托） ---
  document.addEventListener('click', function (e) {
    var versionChip = e.target.closest('#version-chips .filter-chip');
    if (versionChip) {
      var allVersionChips = document.querySelectorAll('#version-chips .filter-chip');
      allVersionChips.forEach(function (c) {
        c.classList.remove('active');
      });
      versionChip.classList.add('active');

      var version = versionChip.getAttribute('data-version') || 'all';
      currentVersion = version;
      renderGallery(currentFilter, version, currentMod, currentTag, currentSearch, currentSort);
    }
  });

  // --- 模组筛选按钮（动态绑定，使用事件委托） ---
  document.addEventListener('click', function (e) {
    var modChip = e.target.closest('#mod-chips .filter-chip');
    if (modChip) {
      var allModChips = document.querySelectorAll('#mod-chips .filter-chip');
      allModChips.forEach(function (c) {
        c.classList.remove('active');
      });
      modChip.classList.add('active');

      var mod = modChip.getAttribute('data-mod') || 'all';
      currentMod = mod;
      renderGallery(currentFilter, currentVersion, mod, currentTag, currentSearch, currentSort);
    }
  });

  // --- 标签筛选按钮（动态绑定，使用事件委托） ---
  document.addEventListener('click', function (e) {
    var tagChip = e.target.closest('#tag-chips .filter-chip');
    if (tagChip) {
      var allTagChips = document.querySelectorAll('#tag-chips .filter-chip');
      allTagChips.forEach(function (c) {
        c.classList.remove('active');
      });
      tagChip.classList.add('active');

      var tag = tagChip.getAttribute('data-tag') || 'all';
      currentTag = tag;
      renderGallery(currentFilter, currentVersion, currentMod, tag, currentSearch, currentSort);
    }
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

  // --- 初始渲染：从 data.json 加载蓝图数据 ---
  loadBlueprints();
});
