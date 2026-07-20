export default function checkSkillRouting(_output, context) {
  const prompt = context.prompt ?? '';
  const shouldUseSkill = prompt.includes('Use $proofline-baseline-quality.');
  const skillCalls = context.metadata?.skillCalls ?? [];
  const metadataShowsUse = skillCalls.some(
    (call) => call?.name === 'proofline-baseline-quality',
  );
  const raw =
    typeof context.providerResponse?.raw === 'string'
      ? context.providerResponse.raw
      : JSON.stringify(context.providerResponse?.raw ?? '');
  let items = [];
  try {
    items = JSON.parse(raw).items ?? [];
  } catch {
    items = [];
  }
  const skillReadItems = items.filter(
    (item) =>
      item?.type === 'command_execution' &&
      /proofline-baseline-quality[\\/]+SKILL\.md/i.test(item.command ?? '') &&
      /(Get-Content|type\s|cat\s)/i.test(item.command ?? ''),
  );
  const rawShowsUse = skillReadItems.some((item) => {
    const commandSucceeded =
      item?.status === 'completed' &&
      (typeof item?.exit_code !== 'number' || item.exit_code === 0);
    const commandOutput = String(
      item?.aggregated_output ?? item?.output ?? '',
    );
    const outputContainsSkill =
      /name:\s*proofline-baseline-quality/i.test(commandOutput) &&
      /#\s*Proofline Baseline Quality/i.test(commandOutput);
    return commandSucceeded || outputContainsSkill;
  });
  const reportsUnavailable = items
    .filter((item) => item?.type === 'agent_message')
    .some((item) =>
      /proofline-baseline-quality[^\n]*(스킬[^\n]*)?(없습니다|찾지 못했습니다|사용할 수 없습니다|읽을 수 없습니다)/i.test(
        item?.text ?? '',
      ),
    );
  const usedSkill = metadataShowsUse || rawShowsUse;
  const pass = shouldUseSkill === usedSkill;

  return {
    pass,
    score: pass ? 1 : 0,
    reason: pass
      ? shouldUseSkill
        ? '스킬 적용 조건에서 대상 스킬을 읽었다.'
        : '스킬 미적용 조건에서 대상 스킬을 읽지 않았다.'
      : shouldUseSkill
        ? reportsUnavailable
          ? '스킬 적용 조건에서 대상 스킬을 사용할 수 없다고 응답했다.'
          : '스킬 적용 조건인데 대상 스킬을 읽은 기록이 없다.'
        : '스킬 미적용 조건에서 대상 스킬을 읽었다.',
  };
}
