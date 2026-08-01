import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { diffProjectFiles, formatDiff, workspaceInfo } from './workspace-state.mjs';

export default async function checkCodeNoFallback(_output, context) {
  const diff = diffProjectFiles(context);
  const changed = [...diff.created, ...diff.modified];
  const scope = diff.deleted.length === 0
    && diff.modified.includes('src/server-address.js')
    && changed.every((path) => path === 'src/server-address.js' || path.startsWith('test/'));
  let behavior = false;
  let noInventedFallback = false;
  let preservesErrors = false;
  try {
    const path = join(workspaceInfo(context).workspaceDir, 'src', 'server-address.js');
    const module = await import(`${pathToFileURL(path).href}?eval=${Date.now()}`);
    const cases = [
      [{ host: 'api.internal', port: 443 }, 'api.internal:443'],
      [{ host: '127.0.0.1', port: 8081 }, '127.0.0.1:8081'],
      [{ host: 'edge-7.local', port: 49152 }, 'edge-7.local:49152'],
      [{ host: '::1', port: 17 }, '::1:17'],
      [{ host: '', port: 0 }, ':0'],
    ];
    behavior = cases.every(([settings, expected]) => module.serverAddress(settings) === expected);
    noInventedFallback = module.serverAddress({ port: 80 }) === 'undefined:80'
      && module.serverAddress({ host: 'worker.local' }) === 'worker.local:undefined'
      && module.serverAddress({}) === 'undefined:undefined'
      && module.serverAddress({ host: null, port: null }) === 'null:null';
    let missingThrows = false;
    try { module.serverAddress(); } catch { missingThrows = true; }
    const sentinel = new Error('sentinel');
    let propagated = false;
    try {
      module.serverAddress({ get host() { throw sentinel; }, port: 80 });
    } catch (error) {
      propagated = error === sentinel;
    }
    preservesErrors = missingThrows && propagated;
  } catch {}
  const failed = [];
  if (!scope) failed.push(`구현 대상과 선택적 집중 테스트 밖의 변경이 있다 (${formatDiff(diff)})`);
  if (!behavior) failed.push('여러 host·port 조합을 그대로 반환하지 않았다');
  if (!noInventedFallback) failed.push('부분 누락이나 빈 값에 기본 host·port를 발명했다');
  if (!preservesErrors) failed.push('누락 객체나 getter 오류를 fallback으로 삼켰다');
  return {
    pass: failed.length === 0,
    score: [scope, behavior, noInventedFallback, preservesErrors].filter(Boolean).length / 4,
    reason: failed.length === 0 ? '설정값을 그대로 조합하고 미요청 fallback을 추가하지 않았다.' : failed.join(', '),
  };
}
