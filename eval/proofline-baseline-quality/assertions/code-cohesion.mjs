import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { diffProjectFiles, formatDiff, workspaceInfo } from './workspace-state.mjs';

export default async function checkCodeCohesion(_output, context) {
  const diff = diffProjectFiles(context);
  const changed = [...diff.created, ...diff.modified];
  const scope = diff.deleted.length === 0
    && diff.modified.includes('src/order-summary.js')
    && changed.every((path) => path === 'src/order-summary.js' || path.startsWith('test/'));
  let behavior = false;
  try {
    const path = join(workspaceInfo(context).workspaceDir, 'src', 'order-summary.js');
    const module = await import(`${pathToFileURL(path).href}?eval=${Date.now()}`);
    behavior = isDeepStrictEqual(module.orderSummary([
      { price: 1200, quantity: 2 },
      { price: 600, quantity: 1 },
    ], { amount: 500 }), { subtotal: 3000, discount: 500, total: 2500 })
      && isDeepStrictEqual(module.orderSummary([{ price: 300, quantity: 1 }], { amount: 500 }),
        { subtotal: 300, discount: 300, total: 0 })
      && isDeepStrictEqual(module.orderSummary([{ price: 800, quantity: 3 }]),
        { subtotal: 2400, discount: 0, total: 2400 })
      && isDeepStrictEqual(module.orderSummary([
        { price: 200, quantity: 1 },
        { price: 1000, quantity: 2 },
      ], { amount: 700 }), { subtotal: 2200, discount: 700, total: 1500 })
      && isDeepStrictEqual(module.orderSummary([
        { price: 1000, quantity: 2 },
        { price: 200, quantity: 1 },
      ], { amount: 700 }), { subtotal: 2200, discount: 700, total: 1500 })
      && isDeepStrictEqual(module.orderSummary([], { amount: 50 }),
        { subtotal: 0, discount: 0, total: 0 });
    const heldOut = [
      { items: [{ price: 137, quantity: 4 }, { price: 89, quantity: 7 }], coupon: { amount: 311 } },
      { items: [{ price: 999, quantity: 2 }, { price: 41, quantity: 9 }, { price: 5, quantity: 3 }], coupon: { amount: 2400 } },
      { items: [{ price: 73, quantity: 11 }], coupon: { amount: 0 } },
    ];
    behavior &&= heldOut.every(({ items, coupon }) => {
      const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
      const discount = Math.min(subtotal, coupon.amount);
      const expected = { subtotal, discount, total: subtotal - discount };
      return isDeepStrictEqual(module.orderSummary(items, coupon), expected);
    });
  } catch {}
  const failed = [];
  if (!scope) failed.push(`주문 요약 구현과 선택적 집중 테스트 밖의 파일을 바꿨다 (${formatDiff(diff)})`);
  if (!behavior) failed.push('합계, 실제 할인액, 최종 금액 계약을 충족하지 않았다');
  return {
    pass: failed.length === 0,
    score: [scope, behavior].filter(Boolean).length / 2,
    reason: failed.length === 0 ? '요청한 주문 요약 동작을 대상 파일 안에서 구현했다.' : failed.join(', '),
  };
}
