export function discountRate(totalWon) {
  if (totalWon >= 100000) return 0.1;
  if (totalWon >= 50000) return 0.05;
  return 0;
}
