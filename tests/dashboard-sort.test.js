const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const appPath = path.join(
  __dirname,
  '..',
  'skills',
  'proofline-issue-ledger',
  'assets',
  'state-starter',
  'dashboard',
  'app.js',
);

// 실제 대시보드 스크립트를 최소 DOM으로 실행해 화면 상태 연결을 함께 검증합니다.
function loadDashboardHarness() {
  const source = fs.readFileSync(appPath, 'utf8').replace(
    /\r?\nloadAccentColor\(\);\r?\nupdateThemeControl\(\);\r?\nloadBackground\(\);\r?\nloadFromDefaultSources\(\);\s*$/,
    '',
  );
  const elements = new Map();
  const styleValues = new Map();
  const element = (id) => {
    if (!elements.has(id)) {
      elements.set(id, {
        hidden: false,
        value: '',
        addEventListener() {},
        click() {},
        querySelectorAll() { return []; },
        reportValidity() {},
        setAttribute() {},
        setCustomValidity() {},
      });
    }

    return elements.get(id);
  };
  const context = {
    document: {
      addEventListener() {},
      documentElement: {
        dataset: { theme: 'light' },
        style: {
          getPropertyValue(name) { return styleValues.get(name) || ''; },
          removeProperty(name) { styleValues.delete(name); },
          setProperty(name, value) { styleValues.set(name, value); },
        },
      },
      getElementById: element,
      querySelectorAll() { return []; },
    },
    localStorage: {
      getItem() { return null; },
      setItem() {},
    },
    URL: {
      createObjectURL() { return 'blob:test-background'; },
      revokeObjectURL() {},
    },
    window: {
      location: { href: 'file:///proofline/dashboard/index.html' },
      setInterval() {},
    },
  };

  vm.runInNewContext(
    `${source}
globalThis.dashboardTestApi = {
  normalizeStatus,
  sortIssueIds: (issues, sort) => {
    state.sort = sort;
    return [...issues].sort(compareIssues).map((issue) => issue.id);
  },
  setBackground: (mode) => {
    if (mode === 'image') {
      applyImageBackground({}, false);
    } else {
      applyColorBackground(false);
    }

    return {
      mode: document.documentElement.dataset.background,
      image: document.documentElement.style.getPropertyValue('--background-image'),
      selectValue: elements.backgroundMode.value,
      pickerHidden: elements.backgroundImagePicker.hidden,
    };
  },
};`,
    context,
  );

  return {
    normalizeStatus: (status) => context.dashboardTestApi.normalizeStatus(status),
    setBackground: (mode) => JSON.parse(JSON.stringify(context.dashboardTestApi.setBackground(mode))),
    sortIssueIds: (issues, sort) => Array.from(context.dashboardTestApi.sortIssueIds(issues, sort)),
  };
}

// 이전 상태명은 별도 그룹으로 새지 않고 현재 작업 중 상태로 합쳐져야 합니다.
test('dashboard normalizes the legacy in_progress status', () => {
  const { normalizeStatus } = loadDashboardHarness();

  assert.equal(normalizeStatus('in_progress'), 'doing');
  assert.equal(normalizeStatus('open'), 'open');
});

// 번호는 숫자로 비교하고 날짜와 우선순위는 양방향 정렬을 지원해야 합니다.
test('dashboard sorts issues by number, date, and priority', () => {
  const { sortIssueIds } = loadDashboardHarness();
  const issues = [
    { id: 'PL-0010', status: 'open', risk: 'low', updated_at: '2026-07-11' },
    { id: 'PL-0002', status: 'open', risk: 'critical', updated_at: '2026-07-10' },
    { id: 'PL-0001', status: 'open', risk: 'high', updated_at: '2026-07-12' },
  ];

  assert.deepEqual(sortIssueIds(issues, 'number-asc'), ['PL-0001', 'PL-0002', 'PL-0010']);
  assert.deepEqual(sortIssueIds(issues, 'number-desc'), ['PL-0010', 'PL-0002', 'PL-0001']);
  assert.deepEqual(sortIssueIds(issues, 'date-asc'), ['PL-0002', 'PL-0010', 'PL-0001']);
  assert.deepEqual(sortIssueIds(issues, 'date-desc'), ['PL-0001', 'PL-0010', 'PL-0002']);
  assert.deepEqual(sortIssueIds(issues, 'priority-asc'), ['PL-0002', 'PL-0001', 'PL-0010']);
  assert.deepEqual(sortIssueIds(issues, 'priority-desc'), ['PL-0010', 'PL-0001', 'PL-0002']);
});

// 배경 전환은 이미지 변경 버튼과 CSS 변수를 현재 모드에 맞춰 함께 갱신해야 합니다.
test('dashboard switches between color and image backgrounds', () => {
  const { setBackground } = loadDashboardHarness();

  assert.deepEqual(setBackground('image'), {
    mode: 'image',
    image: 'url("blob:test-background")',
    selectValue: 'image',
    pickerHidden: false,
  });
  assert.deepEqual(setBackground('color'), {
    mode: 'color',
    image: '',
    selectValue: 'color',
    pickerHidden: true,
  });
});
