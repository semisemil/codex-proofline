const state = {
  issues: [],
  filters: {
    text: '',
    status: 'all',
    risk: 'all'
  }
};

const elements = {
  folderInput: document.getElementById('folder-input'),
  manifestButton: document.getElementById('manifest-button'),
  loadStatus: document.getElementById('load-status'),
  searchInput: document.getElementById('search-input'),
  statusFilter: document.getElementById('status-filter'),
  riskFilter: document.getElementById('risk-filter'),
  issueCount: document.getElementById('issue-count'),
  issuesList: document.getElementById('issues-list'),
  issueTemplate: document.getElementById('issue-template'),
  summaryTotal: document.getElementById('summary-total'),
  summaryOpen: document.getElementById('summary-open'),
  summaryBlocked: document.getElementById('summary-blocked'),
  summaryResolved: document.getElementById('summary-resolved')
};

const riskOrder = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3
};

const statusOrder = {
  blocked: 0,
  open: 1,
  doing: 2,
  ignored: 3,
  resolved: 4
};

elements.folderInput.addEventListener('change', async (event) => {
  const files = Array.from(event.target.files || [])
    .filter((file) => file.name.endsWith('.md'))
    .filter((file) => !file.name.endsWith('.example.md'));

  await loadMarkdownFiles(files);
});

elements.manifestButton.addEventListener('click', loadFromManifest);

elements.searchInput.addEventListener('input', (event) => {
  state.filters.text = event.target.value.trim().toLowerCase();
  render();
});

elements.statusFilter.addEventListener('change', (event) => {
  state.filters.status = event.target.value;
  render();
});

elements.riskFilter.addEventListener('change', (event) => {
  state.filters.risk = event.target.value;
  render();
});

async function loadMarkdownFiles(files) {
  if (files.length === 0) {
    state.issues = [];
    elements.loadStatus.textContent = '선택한 폴더에서 Markdown 이슈 파일을 찾지 못했습니다.';
    render();
    return;
  }

  const loadedIssues = [];
  const errors = [];

  for (const file of files) {
    try {
      const content = await file.text();
      loadedIssues.push(parseIssueMarkdown(content, file.name));
    } catch (error) {
      errors.push(`${file.name}: ${error.message}`);
    }
  }

  state.issues = loadedIssues;
  elements.loadStatus.textContent = buildLoadMessage(loadedIssues.length, errors);
  render();
}

async function loadFromManifest() {
  try {
    const manifestResponse = await fetch('../issues/index.json');
    if (!manifestResponse.ok) {
      throw new Error(`manifest fetch failed: ${manifestResponse.status}`);
    }

    const manifest = await manifestResponse.json();
    const issuePaths = Array.isArray(manifest.issues) ? manifest.issues : [];
    const loadedIssues = [];
    const errors = [];

    for (const issuePath of issuePaths) {
      try {
        const response = await fetch(`../issues/${issuePath}`);
        if (!response.ok) {
          throw new Error(`fetch failed: ${response.status}`);
        }
        const content = await response.text();
        loadedIssues.push(parseIssueMarkdown(content, issuePath));
      } catch (error) {
        errors.push(`${issuePath}: ${error.message}`);
      }
    }

    state.issues = loadedIssues;
    elements.loadStatus.textContent = buildLoadMessage(loadedIssues.length, errors);
    render();
  } catch (error) {
    elements.loadStatus.textContent = `manifest를 불러오지 못했습니다. 로컬에서는 issues 폴더 선택을 사용하세요. (${error.message})`;
  }
}

function buildLoadMessage(count, errors) {
  if (errors.length === 0) {
    return `${count}개 이슈를 불러왔습니다.`;
  }

  return `${count}개 이슈를 불러왔고, ${errors.length}개 파일은 실패했습니다: ${errors.join('; ')}`;
}

function parseIssueMarkdown(content, fileName) {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);

  if (!match) {
    throw new Error('JSON front matter가 없습니다.');
  }

  let metadata;
  try {
    metadata = JSON.parse(match[1]);
  } catch (error) {
    throw new Error(`JSON front matter 파싱 실패: ${error.message}`);
  }

  const body = match[2] || '';
  const issue = {
    fileName,
    body,
    ...metadata
  };

  validateIssue(issue);
  return issue;
}

function validateIssue(issue) {
  const requiredFields = [
    'id',
    'status',
    'title',
    'discovered_while',
    'evidence',
    'risk',
    'suggested_next_step',
    'linked_context',
    'resolved_evidence',
    'created_at',
    'updated_at'
  ];

  const missingFields = requiredFields.filter((field) => issue[field] === undefined || issue[field] === null);
  if (missingFields.length > 0) {
    throw new Error(`필수 필드 누락: ${missingFields.join(', ')}`);
  }

  if (!Array.isArray(issue.evidence)) {
    throw new Error('evidence는 배열이어야 합니다.');
  }

  if (!Array.isArray(issue.resolved_evidence)) {
    throw new Error('resolved_evidence는 배열이어야 합니다.');
  }
}

function render() {
  const visibleIssues = getVisibleIssues();
  renderSummary();
  renderIssueCount(visibleIssues.length);
  renderIssueList(visibleIssues);
}

function getVisibleIssues() {
  return state.issues
    .filter((issue) => {
      if (state.filters.status !== 'all' && issue.status !== state.filters.status) {
        return false;
      }

      if (state.filters.risk !== 'all' && issue.risk !== state.filters.risk) {
        return false;
      }

      if (!state.filters.text) {
        return true;
      }

      return buildSearchText(issue).includes(state.filters.text);
    })
    .sort(compareIssues);
}

function buildSearchText(issue) {
  const evidenceText = issue.evidence
    .map((item) => `${item.kind || ''} ${item.location || ''} ${item.note || ''}`)
    .join(' ');

  return [
    issue.id,
    issue.status,
    issue.title,
    issue.discovered_while,
    issue.risk,
    issue.suggested_next_step,
    evidenceText,
    issue.body
  ]
    .join(' ')
    .toLowerCase();
}

function compareIssues(left, right) {
  const leftStatus = statusOrder[left.status] ?? 99;
  const rightStatus = statusOrder[right.status] ?? 99;
  if (leftStatus !== rightStatus) {
    return leftStatus - rightStatus;
  }

  const leftRisk = riskOrder[left.risk] ?? 99;
  const rightRisk = riskOrder[right.risk] ?? 99;
  if (leftRisk !== rightRisk) {
    return leftRisk - rightRisk;
  }

  return String(right.updated_at).localeCompare(String(left.updated_at));
}

function renderSummary() {
  const total = state.issues.length;
  const open = state.issues.filter((issue) => issue.status === 'open').length;
  const blocked = state.issues.filter((issue) => issue.status === 'blocked').length;
  const resolved = state.issues.filter((issue) => issue.status === 'resolved').length;

  elements.summaryTotal.textContent = String(total);
  elements.summaryOpen.textContent = String(open);
  elements.summaryBlocked.textContent = String(blocked);
  elements.summaryResolved.textContent = String(resolved);
}

function renderIssueCount(count) {
  elements.issueCount.textContent = `${count} issues`;
}

function renderIssueList(issues) {
  elements.issuesList.innerHTML = '';

  if (issues.length === 0) {
    const emptyState = document.createElement('article');
    emptyState.className = 'empty-state';
    emptyState.innerHTML = '<h3>표시할 이슈가 없습니다.</h3><p>필터를 바꾸거나 이슈 폴더를 다시 선택하세요.</p>';
    elements.issuesList.appendChild(emptyState);
    return;
  }

  for (const issue of issues) {
    elements.issuesList.appendChild(renderIssueCard(issue));
  }
}

function renderIssueCard(issue) {
  const card = elements.issueTemplate.content.firstElementChild.cloneNode(true);
  card.classList.add(`risk-${normalizeClassName(issue.risk)}`);

  card.querySelector('.issue-id').textContent = issue.id;
  card.querySelector('.issue-title').textContent = issue.title;
  card.querySelector('.status-badge').textContent = issue.status;

  const riskBadge = card.querySelector('.risk-badge');
  riskBadge.textContent = issue.risk;
  riskBadge.classList.add(`risk-${normalizeClassName(issue.risk)}`);

  card.querySelector('.issue-discovered').textContent = issue.discovered_while;
  card.querySelector('.issue-next-step').textContent = issue.suggested_next_step;
  card.querySelector('.issue-evidence').innerHTML = renderEvidence(issue.evidence);
  card.querySelector('.issue-body').innerHTML = renderMarkdown(issue.body);

  return card;
}

function renderEvidence(evidenceItems) {
  if (!evidenceItems.length) {
    return '<p>No evidence recorded.</p>';
  }

  const listItems = evidenceItems
    .map((item) => {
      const kind = escapeHtml(item.kind || 'evidence');
      const location = escapeHtml(item.location || 'unknown location');
      const note = escapeHtml(item.note || '');
      return `<li><strong>${kind}</strong> · <code>${location}</code>${note ? ` — ${note}` : ''}</li>`;
    })
    .join('');

  return `<h4>Evidence</h4><ul class="evidence-list">${listItems}</ul>`;
}

function renderMarkdown(markdown) {
  const escaped = escapeHtml(markdown);
  const lines = escaped.split('\n');
  const html = [];
  let inList = false;
  let inCodeBlock = false;
  let codeLines = [];

  for (const line of lines) {
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        html.push(`<pre><code>${codeLines.join('\n')}</code></pre>`);
        codeLines = [];
        inCodeBlock = false;
      } else {
        closeList();
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }

    if (line.startsWith('## ')) {
      closeList();
      html.push(`<h3>${renderInline(line.slice(3))}</h3>`);
      continue;
    }

    if (line.startsWith('# ')) {
      closeList();
      html.push(`<h2>${renderInline(line.slice(2))}</h2>`);
      continue;
    }

    if (line.startsWith('- ')) {
      if (!inList) {
        html.push('<ul>');
        inList = true;
      }
      html.push(`<li>${renderInline(line.slice(2))}</li>`);
      continue;
    }

    if (line.trim() === '') {
      closeList();
      continue;
    }

    closeList();
    html.push(`<p>${renderInline(line)}</p>`);
  }

  if (inCodeBlock) {
    html.push(`<pre><code>${codeLines.join('\n')}</code></pre>`);
  }

  closeList();
  return html.join('\n');

  function closeList() {
    if (inList) {
      html.push('</ul>');
      inList = false;
    }
  }
}

function renderInline(text) {
  return text.replace(/`([^`]+)`/g, '<code>$1</code>');
}

function normalizeClassName(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9_-]+/g, '-');
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

render();
