import { diffProjectFiles, formatDiff, hasExactDiff } from './workspace-state.mjs';

function countMatches(checks) {
  return checks.filter(Boolean).length;
}

export default function checkExpressionCompression(output, context) {
  const diff = diffProjectFiles(context);
  const unchanged = hasExactDiff(diff, {});
  const sections = [1, 2, 3, 4].every((number) =>
    new RegExp(`(?:^|\\n)#{0,3}\\s*${number}[.)]?\\s*`, 'm').test(output),
  );

  const processAndThread =
    /프로세스/.test(output) &&
    /스레드/.test(output) &&
    /프로세스[^.\n]*(독립|분리|별도)[^.\n]*(메모리|자원)|프로세스[^.\n]*(메모리|자원)[^.\n]*(독립|분리|별도)|(?:메모리|자원)[^.\n]*(독립|분리|별도)[^.\n]*프로세스/.test(output) &&
    (/스레드[^.\n]*(메모리|자원)[^.\n]*공유/.test(output) ||
      /(?:같은\s*)?프로세스[^.\n]*(메모리|자원)[^.\n]*공유/.test(output));

  const performanceFactors = countMatches([
    /CPU|프로세서/i.test(output),
    /메모리|RAM/i.test(output),
    /저장장치|SSD|HDD|디스크/i.test(output),
    /GPU|그래픽/i.test(output),
    /발열|전력|절전|스로틀/i.test(output),
    /운영체제|드라이버|라이브러리/i.test(output),
    /백그라운드|다른 프로그램/i.test(output),
    /네트워크|인터넷|지연 시간/i.test(output),
  ]);
  const performance = performanceFactors >= 5;

  const debtFactors = countMatches([
    /복잡|이해|파악/.test(output),
    /결합|영향|회귀|깨/.test(output),
    /테스트|확인|검증/.test(output),
    /중복/.test(output),
    /오래된|구식|레거시|도구|기술/.test(output),
    /문서|지식/.test(output),
  ]);
  const technicalDebt =
    /기술\s*부채/.test(output) &&
    /(미뤄|미룬|미뤘|누적|쌓)/.test(output) &&
    debtFactors >= 4 &&
    /(개발|변경)[^.\n]*(비용|시간|속도|느려)|(?:비용|시간)[^.\n]*(늘|커)[^.\n]*(개발|변경)/.test(output);

  const smallModelFactors = countMatches([
    /단순|좁은|분류|추출|요약/.test(output),
    /응답\s*속도|지연|실시간/.test(output),
    /요청량|비용|서버\s*사용량/.test(output),
    /기기|스마트폰|자동차|카메라|온디바이스|내부\s*실행/.test(output),
    /개인정보|외부로 보내|사내\s*서버/.test(output),
    /출력\s*형식|정해진\s*항목|구조화/.test(output),
    /학습|시험|업데이트|배포/.test(output),
  ]);
  const smallModel =
    /작은\s*모델/.test(output) &&
    smallModelFactors >= 5 &&
    (/(충분|요구|기준|성능|품질|정확도)[^.\n]*(만족|충족|유지)|(?:만족|충족|유지)[^.\n]*(요구|기준|성능|품질|정확도)/.test(output) ||
      /충분한?\s*(정확도|품질|성능)|(?:정확도|품질|성능)[^.\n]*충분/.test(output) ||
      /작은[^.\n]{0,20}모델[^.\n]*충분/.test(output) ||
      /품질[^.\n]*(측정|평가|검증|확인)[^.\n]*(선택|결정)/.test(output) ||
      /품질[^.\n]*(해치지|저하[^.\n]*(않|없이))/.test(output) ||
      /충분히\s*(최적화|학습|조정)[^.\n]*(비슷|더\s*나은|성능|결과)/.test(output));

  const failed = [];
  if (!unchanged) failed.push(`설명 요청에서 파일을 변경함 (${formatDiff(diff)})`);
  if (!sections) failed.push('네 질문을 구분하지 않음');
  if (!processAndThread) failed.push('프로세스와 스레드의 메모리·자원 관계를 충분히 설명하지 않음');
  if (!performance) failed.push('컴퓨터별 성능 차이의 주요 요인을 충분히 설명하지 않음');
  if (!technicalDebt) failed.push('기술 부채가 개발 속도를 늦추는 경로를 충분히 설명하지 않음');
  if (!smallModel) failed.push('작은 모델이 실제 서비스에서 유리한 조건과 전제를 충분히 설명하지 않음');

  return {
    pass: failed.length === 0,
    score: [unchanged, sections, processAndThread, performance, technicalDebt, smallModel]
      .filter(Boolean).length / 6,
    reason: failed.length === 0
      ? '네 기술 질문에 필요한 핵심 개념, 원인과 조건을 모두 보존했다.'
      : failed.join(', '),
  };
}
