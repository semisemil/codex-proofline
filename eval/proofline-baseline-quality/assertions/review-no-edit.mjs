import { diffProjectFiles, formatDiff, hasExactDiff } from './workspace-state.mjs';

function providerRaw(context) {
  let raw = context.providerResponse?.raw;
  if (typeof raw === 'string') {
    try { raw = JSON.parse(raw); } catch {}
  }
  return raw ?? {};
}

export default function checkReviewNoEdit(_output, context) {
  const diff = diffProjectFiles(context);
  const unchanged = hasExactDiff(diff, {});
  const items = providerRaw(context).items ?? [];
  const noFileChangeEvent = items.every((item) => item.type !== 'file_change');
  const snapshots = providerRaw(context).workspaceSnapshots;
  const writeEvents = providerRaw(context).workspaceWriteEvents;
  const snapshotsAvailable = Array.isArray(snapshots) && snapshots.length === 3;
  const snapshotsUnchanged = snapshotsAvailable
    && snapshots.every((snapshot) => snapshot.changed === false);
  const writeMonitorAvailable = Array.isArray(writeEvents);
  const noWorkspaceWrite = writeMonitorAvailable && writeEvents.length === 0;
  const failed = [];
  if (!unchanged) failed.push(`검토 중 파일을 변경했다 (${formatDiff(diff)})`);
  if (!noFileChangeEvent) failed.push('멀티턴 중 파일 변경 이벤트가 발생했다');
  if (!snapshotsAvailable) failed.push('세 턴 각각의 workspace snapshot이 기록되지 않았다');
  if (!snapshotsUnchanged) failed.push('중간 턴에서 파일을 바꿨다가 되돌렸다');
  if (!writeMonitorAvailable) failed.push('턴 내부 쓰기를 감지하는 workspace write monitor 기록이 없다');
  if (!noWorkspaceWrite) failed.push('한 턴 안에서 파일을 바꿨다가 되돌린 쓰기 이벤트가 있다');
  return {
    pass: failed.length === 0,
    score: [unchanged, noFileChangeEvent, snapshotsAvailable, snapshotsUnchanged, writeMonitorAvailable, noWorkspaceWrite].filter(Boolean).length / 6,
    reason: failed.length === 0 ? '세 턴 전체에서 파일 변경 없이 검토했다.' : failed.join(', '),
  };
}
