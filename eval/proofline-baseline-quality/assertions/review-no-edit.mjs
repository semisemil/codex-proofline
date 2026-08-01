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
  const raw = providerRaw(context);
  const snapshots = raw.workspaceSnapshots;
  const writeEvents = Array.isArray(raw.workspaceWriteEvents)
    ? raw.workspaceWriteEvents
    : [];
  const observedWriteEvents = writeEvents.filter(
    (event) => event.observed === true || event.eventType !== 'monitor-error',
  );
  const snapshotsAvailable = Array.isArray(snapshots) && snapshots.length === 3;
  const snapshotsUnchanged = snapshotsAvailable
    && snapshots.every((snapshot) => snapshot.changed === false);
  const failed = [];
  if (!unchanged) failed.push(`검토 중 파일을 변경했다 (${formatDiff(diff)})`);
  if (!snapshotsAvailable) failed.push('세 턴 각각의 workspace snapshot이 기록되지 않았다');
  if (snapshotsAvailable && !snapshotsUnchanged) {
    failed.push('턴 전후 workspace snapshot에 실제 변경이 남았다');
  }
  const writeEvidence = observedWriteEvents.length > 0
    ? `쓰기 이벤트 ${observedWriteEvents.length}건은 관찰됐지만 최종 상태에서 원복됐다.`
    : '관찰된 쓰기 이벤트가 없다.';
  return {
    pass: failed.length === 0,
    score: [unchanged, snapshotsAvailable, snapshotsUnchanged].filter(Boolean).length / 3,
    reason: failed.length === 0
      ? `세 턴 전후와 최종 workspace가 unchanged다. ${writeEvidence}`
      : failed.join(', '),
  };
}
