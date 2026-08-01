import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { diffProjectFiles, formatDiff, hasExactDiff, readWorkspaceFile, workspaceInfo } from './workspace-state.mjs';

function structuralHtml(html) {
  return html.replace(/>([^<]*)</g, '><').replace(/\s+/g, ' ').trim();
}

function textOf(html, pattern) {
  return html.match(pattern)?.[1]?.trim() ?? '';
}

export default function checkUiInformationDesign(_output, context) {
  const diff = diffProjectFiles(context);
  const scope = hasExactDiff(diff, { modified: ['src/settings.html'] });
  const html = readWorkspaceFile(context, 'src/settings.html');
  const original = readFileSync(join(workspaceInfo(context).fixtureDir, 'src', 'settings.html'), 'utf8');
  const structurePass = structuralHtml(html) === structuralHtml(original);
  const termsPass =
    textOf(html, /<h1[^>]*>([^<]*)<\/h1>/) === '작업공간 설정'
    && textOf(html, /<h2[^>]*>([^<]*)<\/h2>/) === '데이터 보관'
    && textOf(html, /<label[^>]*>([^<]*)<\/label>/) === '보관 기간'
    && textOf(html, /<button[^>]*>([^<]*)<\/button>/) === '저장'
    && textOf(html, /<a[^>]*>([^<]*)<\/a>/) === '취소';
  const options = [...html.matchAll(/<option[^>]*>([^<]*)<\/option>/g)].map((match) => match[1].trim());
  const optionsPass = JSON.stringify(options) === JSON.stringify(['30일', '90일']);
  const visibleText = html.replace(/<[^>]+>/g, ' ');
  const naturalPass = !/[A-Za-z]{2,}/.test(visibleText)
    && !/(여기에서|것이 가능|할 수 있습니다|되어집니다|되게 됩니다)/.test(visibleText);
  const failed = [];
  if (!scope) failed.push(`대상 UI 문구 파일 밖의 변경이 있다 (${formatDiff(diff)})`);
  if (!structurePass) failed.push('텍스트 외의 HTML 구조나 속성이 바뀌었다');
  if (!termsPass || !optionsPass) failed.push('인접 화면의 제품 용어와 문구 형식을 따르지 않았다');
  if (!naturalPass) failed.push('사용자 노출 영문·메타 안내·번역투가 남아 있다');
  return {
    pass: failed.length === 0,
    score: [scope, structurePass, termsPass && optionsPass, naturalPass].filter(Boolean).length / 4,
    reason: failed.length === 0 ? '구조를 유지하며 기존 제품 용어에 맞는 한국어 문구로 정리했다.' : failed.join(', '),
  };
}
