// ===== State =====
let allChars = [];
let currentVer = '6';
let skillFilters = []; // [{name, threshold}]
let abilityMinMap = {}; // {STR: 30, ...}

// 7版 vs 6版で表示する能力値とスライダー最大値
const VER_CONFIG = {
  '7': {
    abilities: ['STR','CON','POW','DEX','APP','SIZ','INT','EDU','LUK'],
    abMax: 90,
    abMaxOverride: { EDU: 99 },
    abilityKeys: { STR:'str', CON:'con', POW:'pow', DEX:'dex', APP:'app', SIZ:'siz', INT:'int', EDU:'edu', LUK:'luck' }
  },
  '6': {
    abilities: ['STR','CON','POW','DEX','APP','SIZ','INT','EDU'],
    abMax: 18,
    abMaxOverride: { EDU: 21 },
    abilityKeys: { STR:'str', CON:'con', POW:'pow', DEX:'dex', APP:'app', SIZ:'siz', INT:'int', EDU:'edu' }
  }
};

// ===== Parse JSON =====
document.getElementById('parseBtn').addEventListener('click', () => {
  const raw = document.getElementById('jsonInput').value.trim();
  const errEl = document.getElementById('parseError');
  errEl.textContent = '';
  try {
    let parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) parsed = [parsed];
    allChars = parsed;
    document.getElementById('pasteArea').style.display = 'none';
    document.getElementById('cardGrid').style.display = 'grid';
    buildSkillSelect();
    renderAbilityFilters();
    renderCards();
  } catch(e) {
    errEl.textContent = 'JSONの解析に失敗しました: ' + e.message;
  }
});

// ===== Version tabs =====
document.querySelectorAll('.ver-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    currentVer = btn.dataset.ver;
    document.querySelectorAll('.ver-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    abilityMinMap = {};
    skillFilters = [];
    document.getElementById('skillFilterTags').innerHTML = '';
    renderAbilityFilters();
    buildSkillSelect();
    renderCards();
  });
});

// ===== SAN filter =====
document.getElementById('sanRange').addEventListener('input', e => {
  const v = parseInt(e.target.value);
  abilityMinMap['SAN'] = v;
  document.getElementById('abval-SAN').textContent = v > 0 ? v + '以上' : '指定なし';
  renderCards();
});

// ===== Ability filters =====
function renderAbilityFilters() {
  const cfg = VER_CONFIG[currentVer];
  const container = document.getElementById('abilityFilters');
  container.innerHTML = '';
  cfg.abilities.forEach(ab => {
    const min = abilityMinMap[ab] || 0;
    const div = document.createElement('div');
    div.className = 'ability-row';
    div.innerHTML = `
      <div class="ability-head">
        <span class="ability-name">${ab}</span>
        <span class="ability-val" id="abval-${ab}">${min > 0 ? min + '以上' : '指定なし'}</span>
      </div>
      <input type="range" min="0" max="${(cfg.abMaxOverride && cfg.abMaxOverride[ab]) || cfg.abMax}" value="${min}" step="1" data-ab="${ab}" />
    `;
    div.querySelector('input').addEventListener('input', e => {
      const v = parseInt(e.target.value);
      abilityMinMap[ab] = v;
      document.getElementById('abval-' + ab).textContent = v > 0 ? v + '以上' : '指定なし';
      renderCards();
    });
    container.appendChild(div);
  });
}

// ===== 技能名の正規化（共通） =====
// （）なしでまとめて扱う技能
const GROUP_SKILLS = new Set(['操縦','芸術','製作','運転','母国語','近接戦闘','射撃','言語','科学']);

// プルダウン・フィルター用：GROUP_SKILLSは親名のみ
function skillFullName(sk) {
  const add = sk.additionalName || '';
  if (GROUP_SKILLS.has(sk.name)) return sk.name;
  return sk.name + (add ? '（' + add + '）' : '');
}

// カード表示用：常に（）込み
function skillDisplayName(sk) {
  const add = sk.additionalName || '';
  return sk.name + (add ? '（' + add + '）' : '');
}

// ===== Skill select =====
const CAT_LABELS = {
  actionSkills: '行動技能',
  battleSkills: '戦闘技能',
  searchSkills: '探索技能',
  knowledgeSkills: '知識技能',
  negotiationSkills: '交渉技能'
};
const CAT_ORDER = ['actionSkills','battleSkills','searchSkills','knowledgeSkills','negotiationSkills'];

function buildSkillSelect() {
  const sel = document.getElementById('skillSelect');
  sel.innerHTML = '<option value="">技能を選択...</option>';
  const bycat = collectSkillsByCategory();
  CAT_ORDER.forEach(cat => {
    const names = bycat[cat];
    if (!names || names.length === 0) return;
    const grp = document.createElement('optgroup');
    grp.label = CAT_LABELS[cat];
    names.sort((a,b) => a.localeCompare(b, 'ja')).forEach(s => {
      const opt = document.createElement('option');
      opt.value = s;
      opt.textContent = s;
      grp.appendChild(opt);
    });
    sel.appendChild(grp);
  });
}

function collectSkillsByCategory() {
  const result = {};
  CAT_ORDER.forEach(cat => result[cat] = new Set());
  const chars = allChars.filter(c => (c.data?.version || '7th').startsWith(currentVer));
  chars.forEach(ch => {
    const d = ch.data;
    CAT_ORDER.forEach(cat => {
      const skills = d[cat];
      if (!skills) return;
      [...(skills.static || []), ...(skills.additional || [])].forEach(sk => {
        if (!sk.name) return;
        // GROUP_SKILLSは親名のみ登録、（）付きは無視
        if (GROUP_SKILLS.has(sk.name)) {
          result[cat].add(sk.name);
        } else {
          result[cat].add(skillDisplayName(sk));
        }
      });
    });
  });
  CAT_ORDER.forEach(cat => result[cat] = [...result[cat]]);
  return result;
}

// ===== Custom skill combobox =====
let allSkillOptions = []; // [{cat, name}]
let selectedSkillName = '';
let activeIndex = -1;

function buildSkillSelect() {
  const bycat = collectSkillsByCategory();
  allSkillOptions = [];
  CAT_ORDER.forEach(cat => {
    const names = bycat[cat];
    if (!names || names.length === 0) return;
    names.sort((a,b) => a.localeCompare(b, 'ja')).forEach(name => {
      allSkillOptions.push({ cat, name });
    });
  });
  selectedSkillName = '';
  document.getElementById('skillComboInput').value = '';
  renderDropdown('');
}

function renderDropdown(query) {
  const dropdown = document.getElementById('skillDropdown');
  const q = query.trim().toLowerCase();
  const filtered = q ? allSkillOptions.filter(o => o.name.toLowerCase().includes(q)) : allSkillOptions;

  if (filtered.length === 0) {
    dropdown.innerHTML = '<div class="skill-dropdown-empty">該当なし</div>';
    return;
  }

  let html = '';
  let lastCat = null;
  filtered.forEach((o, i) => {
    if (o.cat !== lastCat) {
      html += `<div class="skill-dropdown-group">${CAT_LABELS[o.cat]}</div>`;
      lastCat = o.cat;
    }
    html += `<div class="skill-dropdown-item" data-name="${o.name}" data-i="${i}">${o.name}</div>`;
  });
  dropdown.innerHTML = html;
  activeIndex = -1;

  dropdown.querySelectorAll('.skill-dropdown-item').forEach(el => {
    el.addEventListener('mousedown', e => {
      e.preventDefault();
      selectSkill(el.dataset.name);
    });
  });
}

let suppressInput = false;

function selectSkill(name) {
  selectedSkillName = name;
  suppressInput = true;
  document.getElementById('skillComboInput').value = name;
  suppressInput = false;
  document.getElementById('skillDropdown').classList.remove('open');
}

const comboInput = document.getElementById('skillComboInput');
const dropdown = document.getElementById('skillDropdown');

comboInput.addEventListener('focus', () => {
  renderDropdown(comboInput.value);
  dropdown.classList.add('open');
});
comboInput.addEventListener('blur', () => {
  setTimeout(() => dropdown.classList.remove('open'), 150);
});
comboInput.addEventListener('input', () => {
  if (suppressInput) return;
  selectedSkillName = '';
  renderDropdown(comboInput.value);
  dropdown.classList.add('open');
});
let isComposing = false;
comboInput.addEventListener('compositionstart', () => { isComposing = true; });
comboInput.addEventListener('compositionend', () => { isComposing = false; });

comboInput.addEventListener('keydown', e => {
  if (isComposing) return;
  const items = dropdown.querySelectorAll('.skill-dropdown-item');
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    activeIndex = Math.min(activeIndex + 1, items.length - 1);
    items.forEach((el, i) => el.classList.toggle('active', i === activeIndex));
    items[activeIndex]?.scrollIntoView({ block: 'nearest' });
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    activeIndex = Math.max(activeIndex - 1, 0);
    items.forEach((el, i) => el.classList.toggle('active', i === activeIndex));
    items[activeIndex]?.scrollIntoView({ block: 'nearest' });
  } else if (e.key === 'Enter') {
    e.preventDefault();
    if (activeIndex >= 0 && items[activeIndex]) {
      selectSkill(items[activeIndex].dataset.name);
    } else if (items.length >= 1) {
      selectSkill(items[0].dataset.name);
    }
  } else if (e.key === 'Escape') {
    dropdown.classList.remove('open');
  }
});

// ===== Skill threshold =====
document.getElementById('skillThreshold').addEventListener('input', e => {
  document.getElementById('skillThreshVal').textContent = e.target.value + '以上';
});

document.getElementById('addSkillFilter').addEventListener('click', () => {
  const name = selectedSkillName || comboInput.value.trim();
  if (!name) return;
  const threshold = parseInt(document.getElementById('skillThreshold').value);
  if (skillFilters.some(f => f.name === name)) return;
  skillFilters.push({ name, threshold });
  selectedSkillName = '';
  comboInput.value = '';
  renderSkillTags();
  renderCards();
});

function renderSkillTags() {
  const container = document.getElementById('skillFilterTags');
  container.innerHTML = '';
  skillFilters.forEach((f, i) => {
    const tag = document.createElement('div');
    tag.className = 'filter-tag';
    tag.innerHTML = `${f.name} ≥${f.threshold}<span class="filter-tag-remove" data-i="${i}">×</span>`;
    tag.querySelector('.filter-tag-remove').addEventListener('click', () => {
      skillFilters.splice(i, 1);
      renderSkillTags();
      renderCards();
    });
    container.appendChild(tag);
  });
}

// ===== Theme toggle =====
const themeBtn = document.getElementById('themeBtn');
themeBtn.addEventListener('click', () => {
  const isLight = document.documentElement.classList.toggle('light');
  themeBtn.textContent = isLight ? '☽ ダーク' : '☀ ライト';
});

// ===== Lost toggle =====
const showLostCb = document.getElementById('showLost');
const toggleThumb = document.getElementById('toggleThumb');
const toggleTrack = document.getElementById('toggleTrack');
showLostCb.addEventListener('change', () => {
  const on = showLostCb.checked;
  toggleThumb.style.transform = on ? 'translateX(16px)' : 'translateX(3px)';
  toggleTrack.style.background = on ? 'var(--red)' : 'var(--border2)';
  renderCards();
});

// ===== Name search =====
document.getElementById('nameSearch').addEventListener('input', renderCards);

// ===== Reset =====
document.getElementById('resetBtn').addEventListener('click', () => {
  abilityMinMap = {};
  skillFilters = [];
  document.getElementById('nameSearch').value = '';
  document.getElementById('skillFilterTags').innerHTML = '';
  document.getElementById('sanRange').value = 0;
  document.getElementById('abval-SAN').textContent = '指定なし';
  renderAbilityFilters();
  renderCards();
});

// ===== Get skill value =====
function getSkillValue(ch, rawName) {
  const d = ch.data;
  const isGroup = GROUP_SKILLS.has(rawName);
  let best = null;
  for (const cat of CAT_ORDER) {
    const skills = d[cat];
    if (!skills) continue;
    const all = [...(skills.static || []), ...(skills.additional || [])];
    for (const sk of all) {
      const match = isGroup ? sk.name === rawName : skillFullName(sk) === rawName;
      if (match) {
        let val = sk.sumPoint !== undefined ? sk.sumPoint :
          (sk.defaultPoint||0) + (sk.professionPoint||0) + (sk.interestPoint||0) + (sk.growthPoint||0) + (sk.otherPoint||0);
        // Ability-based default value calculation
        if (sk.name === '母国語' && (sk.defaultPoint === undefined || sk.defaultPoint === 0)) {
          const edu = getAbilityValue(ch, 'edu');
          const base = edu * (currentVer === '7' ? 1 : 5);
          val = base + (sk.professionPoint||0) + (sk.interestPoint||0) + (sk.growthPoint||0) + (sk.otherPoint||0);
        } else if (sk.name === '回避' && (sk.defaultPoint === undefined || sk.defaultPoint === 0)) {
          const dex = getAbilityValue(ch, 'dex');
          const base = dex * (currentVer === '7' ? 1 : 2);
          val = base + (sk.professionPoint||0) + (sk.interestPoint||0) + (sk.growthPoint||0) + (sk.otherPoint||0);
        }
        if (best === null || val > best) best = val;
      }
    }
  }
  return best;
}

// ===== Get ability value =====
function getAbilityValue(ch, abKey) {
  if (abKey === 'san') return ch.data?.abilities?.sanCurrent ?? 0;
  const v = ch.data?.abilities?.[abKey];
  if (!v) return 0;
  return (v.value || 0) + (v.fixedDiff || 0) + (v.tmpFixedDiff || 0);
}

// ===== Get top skills =====
function getTopSkills(ch, highlightNames) {
  const d = ch.data;
  const cats = ['actionSkills','battleSkills','searchSkills','knowledgeSkills','negotiationSkills'];
  const all = [];
  cats.forEach(cat => {
    const skills = d[cat];
    if (!skills) return;
    [...(skills.static||[]), ...(skills.additional||[])].forEach(sk => {
      let val = sk.sumPoint !== undefined ? sk.sumPoint :
        (sk.defaultPoint||0)+(sk.professionPoint||0)+(sk.interestPoint||0)+(sk.growthPoint||0)+(sk.otherPoint||0);
      // Ability-based default value calculation
      if (sk.name === '母国語' && (sk.defaultPoint === undefined || sk.defaultPoint === 0)) {
        const edu = getAbilityValue(ch, 'edu');
        const base = edu * (currentVer === '7' ? 1 : 5);
        val = base + (sk.professionPoint||0) + (sk.interestPoint||0) + (sk.growthPoint||0) + (sk.otherPoint||0);
      } else if (sk.name === '回避' && (sk.defaultPoint === undefined || sk.defaultPoint === 0)) {
        const dex = getAbilityValue(ch, 'dex');
        const base = dex * (currentVer === '7' ? 1 : 2);
        val = base + (sk.professionPoint||0) + (sk.interestPoint||0) + (sk.growthPoint||0) + (sk.otherPoint||0);
      }
      const fullName = skillDisplayName(sk);
      const baseName = fullName.replace(/（.*）$/, '');
      const isHighlighted = highlightNames.has(fullName) || (GROUP_SKILLS.has(baseName) && highlightNames.has(baseName));
      const extraPoints = (sk.professionPoint||0)+(sk.interestPoint||0)+(sk.growthPoint||0)+(sk.otherPoint||0);
      if (isHighlighted || extraPoints > 0 || (sk.sumPoint !== undefined && sk.sumPoint > (sk.defaultPoint||0))) {
        all.push({ name: fullName, val, isHighlighted });
      }
    });
  });
  all.sort((a,b) => b.val - a.val);
  // フィルター対象は必ず含め、残りはtop6まで
  const highlighted = all.filter(s => s.isHighlighted);
  const others = all.filter(s => !s.isHighlighted).slice(0, Math.max(0, 6 - highlighted.length));
  return [...highlighted, ...others].sort((a,b) => b.val - a.val);
}

// ===== Render =====
function renderCards() {
  const cfg = VER_CONFIG[currentVer];
  const nameQ = document.getElementById('nameSearch').value.trim().toLowerCase();

  const filtered = allChars.filter(ch => {
    const ver = (ch.data?.version || '7th').startsWith(currentVer);
    if (!ver) return false;

    // Name search
    const name = (ch.data?.profile?.name || ch.name || '').toLowerCase();
    const furi = (ch.data?.profile?.furi || '').toLowerCase();
    if (nameQ && !name.includes(nameQ) && !furi.includes(nameQ)) return false;

    // Lost filter
    if (!document.getElementById('showLost').checked && ch.data?.profile?.isLost) return false;

    // Ability filters
    for (const [ab, minVal] of Object.entries(abilityMinMap)) {
      if (minVal <= 0) continue;
      if (ab === 'SAN') {
        const sanVal = ch.data?.abilities?.sanCurrent ?? 0;
        if (sanVal < minVal) return false;
        continue;
      }
      const key = cfg.abilityKeys[ab];
      if (!key) continue;
      if (getAbilityValue(ch, key) < minVal) return false;
    }

    // Skill filters
    for (const sf of skillFilters) {
      const val = getSkillValue(ch, sf.name);
      if (val === null || val < sf.threshold) return false;
    }

    return true;
  });

  const grid = document.getElementById('cardGrid');
  const countEl = document.getElementById('resultCount');
  const total = allChars.filter(c => (c.data?.version||'7th').startsWith(currentVer)).length;
  countEl.innerHTML = `<b>${filtered.length}</b> / ${total} キャラクター`;

  if (filtered.length === 0) {
    grid.innerHTML = '<div class="empty-state">条件に一致するキャラクターが見つかりません</div>';
    return;
  }

  const hlNames = new Set(skillFilters.map(f => f.name));

  grid.innerHTML = '';
  filtered.forEach(ch => {
    const prof = ch.data?.profile || {};
    const name = prof.name || ch.name || '不明';
    const furi = prof.furi || '';
    const age = prof.age || '';
    const sex = prof.sex || '';
    const profession = prof.profession || '';
    const isLost = prof.isLost;
    const sanVal = ch.data?.abilities?.sanCurrent ?? '';

    // Card background image
    const initials = name.replace(/[（(].*/, '').trim().slice(0,2);
    const iconUrl = prof.icons?.[0]?.url || '';
    const cardBgHtml = iconUrl
      ? `<img class="card-bg" src="${iconUrl}" alt="" referrerpolicy="no-referrer" />`
      : '';

    // Abilities
    const abChips = cfg.abilities.map(ab => {
      const key = cfg.abilityKeys[ab];
      const val = getAbilityValue(ch, key);
      return `<div class="ability-chip">${ab} <b>${val}</b></div>`;
    }).join('');

    // DB計算
    const str = getAbilityValue(ch, 'str');
    const siz = getAbilityValue(ch, 'siz');
    const strSizRaw = currentVer === '7' ? Math.round(str / 5) + Math.round(siz / 5) : str + siz;
    let db;
    if (strSizRaw <= 12) db = '-1D6';
    else if (strSizRaw <= 16) db = '-1D4';
    else if (strSizRaw <= 24) db = '0';
    else if (strSizRaw <= 32) db = '+1D4';
    else if (strSizRaw <= 40) db = '+1D6';
    else if (strSizRaw <= 56) db = '+2D6';
    else if (strSizRaw <= 72) db = '+3D6';
    else if (strSizRaw <= 88) db = '+4D6';
    else db = '+5D6';
    const dbChip = `<div class="ability-chip db-chip">DB <b>${db}</b></div>`;

    // Skills
    const topSkills = getTopSkills(ch, hlNames);
    const skillHtml = topSkills.map(s => {
      // GROUP_SKILLSのフィルターは親名だけで照合
      const baseName = s.name.replace(/（.*）$/, '');
      const isHl = hlNames.has(s.name) || (GROUP_SKILLS.has(baseName) && hlNames.has(baseName));
      return `<span class="skill-pill${isHl ? ' highlight' : ''}">${s.name} ${s.val}</span>`;
    }).join('');

    const subParts = [];
    if (furi) subParts.push(furi);
    const meta = [age ? age + '歳' : '', sex].filter(Boolean).join('・');
    if (meta) subParts.push(meta);
    if (profession) subParts.push(profession);

    const card = document.createElement('div');
    card.className = 'char-card' + (isLost ? ' is-lost' : '');
    card.innerHTML = `
      <div class="card-top">
        <div style="flex:1;min-width:0;">
          <div style="display:flex;align-items:center;gap:5px;margin-bottom:4px;">
            <div class="ver-badge">${currentVer}版</div>
            <a href="https://iachara.com/view/${ch.id}" target="_blank" rel="noopener" title="キャラクターページを開く" style="display:flex;align-items:center;gap:3px;color:var(--text3);text-decoration:none;transition:color 0.15s;" onmouseover="this.style.color='var(--accent2)'" onmouseout="this.style.color='var(--text3)'">
              <span style="font-size:10px;">いあきゃらへ</span>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
            </a>
          </div>
          <div class="card-name">${name}</div>
          ${subParts.length ? `<div class="card-sub">${subParts.join(' ｜ ')}</div>` : ''}
        </div>
      </div>
      ${sanVal !== '' ? `<div style="margin-bottom:4px;margin-top:-4px;position:relative;z-index:1;"><div class="san-chip">SAN <b>${sanVal}</b></div></div>` : ''}
      <div class="ability-chips">${abChips}${dbChip}</div>
      <div class="skill-pills">${skillHtml || '<span style="font-size:11px;color:var(--text3);">技能データなし</span>'}</div>
    `;
    if (iconUrl) {
      const bg = document.createElement('img');
      bg.className = 'card-bg';
      bg.src = iconUrl;
      bg.setAttribute('referrerpolicy', 'no-referrer');
      bg.setAttribute('alt', '');
      card.appendChild(bg);
    }
    grid.appendChild(card);
  });
}

// Init
renderAbilityFilters();

