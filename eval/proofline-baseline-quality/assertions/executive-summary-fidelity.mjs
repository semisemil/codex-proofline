const checks = [
  {
    name: '시범 운영 범위와 기간',
    test: (text) => /3개\s*지역/.test(text) && /2026년\s*9월/.test(text),
  },
  {
    name: '시범 운영 미승인 상태',
    test: (text) => /시범 운영/.test(text) && /승인[^.\n]*(않|전|미정)/.test(text),
  },
  {
    name: '예산 상한과 부가세 미정',
    test: (text) =>
      /1억\s*2천|120,?000,?000/.test(text) &&
      /부가세[\s\S]{0,50}(미정|정해지지|정해야)/.test(text),
  },
  {
    name: '부하 시험 결과와 보류 사유',
    test: (text) => /3개[^.\n]*2개|2개[^.\n]*3개/.test(text) && /데이터[^.\n]*(부족|미확보)/.test(text),
  },
  {
    name: '접근 허용 조건과 미체결 상태',
    test: (text) => /DPA/.test(text) && /(서명|체결)[^.\n]*(않|전|미)/.test(text),
  },
  {
    name: '문의량 증가 추정치',
    test: (text) => /8\s*[%~～-]\s*12\s*%|8%[^.\n]*12%/.test(text) && /(추정|예상)/.test(text),
  },
  {
    name: '결정 시점과 결정권자',
    test: (text) => /9월\s*5일/.test(text) && /COO/.test(text),
  },
  {
    name: '계약 지연 시 대안',
    test: (text) => /계약[^.\n]*지연/.test(text) && /내부[^.\n]*샌드박스/.test(text),
  },
];

export default function checkExecutiveSummaryFidelity(output) {
  const failed = checks.filter(({ test }) => !test(output)).map(({ name }) => name);
  const score = (checks.length - failed.length) / checks.length;
  return {
    pass: failed.length === 0,
    score,
    reason:
      failed.length === 0
        ? '자료의 핵심 수량, 상태, 조건, 불확실성과 대안을 모두 보존했다.'
        : `누락되거나 확인되지 않은 항목: ${failed.join(', ')}`,
  };
}
