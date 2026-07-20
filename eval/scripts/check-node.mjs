const [major, minor] = process.versions.node.split('.').map(Number);
const supported =
  (major === 20 && minor >= 20) ||
  (major >= 22 && (major > 22 || minor >= 22));

if (!supported) {
  console.error(
    [
      `현재 Node.js ${process.versions.node}에서는 Promptfoo를 실행할 수 없습니다.`,
      'Node.js 22.22.0 이상 또는 최신 LTS 버전으로 업데이트한 뒤 다시 실행해 주세요.',
      '다운로드: https://nodejs.org/en/download',
    ].join('\n'),
  );
  process.exit(1);
}
