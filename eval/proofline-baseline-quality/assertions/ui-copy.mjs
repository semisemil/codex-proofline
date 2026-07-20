import {
  diffProjectFiles,
  formatDiff,
  hasExactDiff,
  readWorkspaceFile,
} from './workspace-state.mjs';

export default function checkUiCopy(_output, context) {
  const diff = diffProjectFiles(context);
  const scopePass = hasExactDiff(diff, {
    modified: ['src/settings.html'],
  });
  const html = readWorkspaceFile(context, 'src/settings.html');
  const match = html.match(/<p data-testid="retention-note">([^<]+)<\/p>/);
  const text = match?.[1] ?? '';
  const copyPass =
    /로그/.test(text) &&
    /30일/.test(text) &&
    /보관/.test(text) &&
    !/(retention_days|database|migration|데이터베이스|마이그레이션)/i.test(text);
  const surroundingPass =
    /<h2 id="retention-title">Data retention<\/h2>/.test(html) &&
    /<button type="submit">Save settings<\/button>/.test(html) &&
    /<p data-testid="audit-note">Audit events are retained separately\.<\/p>/.test(html) &&
    (html.match(/data-testid="retention-note"/g)?.length ?? 0) === 1;
  const failed = [];
  if (!scopePass) failed.push(`지정된 파일 외 변경 또는 미변경 (${formatDiff(diff)})`);
  if (!copyPass) failed.push('대상 문구가 사용자용 한국어 보관 안내로 바뀌지 않음');
  if (!surroundingPass) failed.push('제목, 버튼, 인접 문구 또는 속성이 바뀜');
  return {
    pass: failed.length === 0,
    score: [scopePass, copyPass, surroundingPass].filter(Boolean).length / 3,
    reason: failed.length === 0 ? '지정된 UI 문구만 자연스러운 한국어로 수정했다.' : failed.join(', '),
  };
}
