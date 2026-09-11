/**
 * 本项目定制：拼写差异对齐。
 * 用编辑距离回溯把"用户输入"和"正确单词"逐字符对齐，
 * 用于反馈时直观展示少写/多写/写错的字母。
 */

export type SpellDiffOp =
  | { type: 'match'; expected: string; actual: string }
  // 写成了别的字母
  | { type: 'sub'; expected: string; actual: string }
  // 少写了这个字母
  | { type: 'missing'; expected: string }
  // 多写了这个字母
  | { type: 'extra'; actual: string }

export type SpellAlignment = {
  /** 对齐基准（可能是完整单词，也可能是去掉已给首字母后的部分） */
  base: string
  /** 用户省略了已给出的首字母 */
  omittedGiven: boolean
  ops: SpellDiffOp[]
}

function nonMatchCount(ops: SpellDiffOp[]): number {
  return ops.reduce((count, op) => (op.type === 'match' ? count : count + 1), 0)
}

/** 编辑距离 + 回溯，得到逐字符对齐结果。 */
export function diffWord(expected: string, actual: string): SpellDiffOp[] {
  const n = expected.length
  const m = actual.length
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0))

  for (let i = 0; i <= n; i++) dp[i][0] = i
  for (let j = 0; j <= m; j++) dp[0][j] = j

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (expected[i - 1] === actual[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1]
      } else {
        dp[i][j] = Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]) + 1
      }
    }
  }

  const ops: SpellDiffOp[] = []
  let i = n
  let j = m
  while (i > 0 && j > 0) {
    if (expected[i - 1] === actual[j - 1] && dp[i][j] === dp[i - 1][j - 1]) {
      ops.push({ type: 'match', expected: expected[i - 1], actual: actual[j - 1] })
      i--
      j--
      continue
    }
    // 平局时优先按"写成了别的字母"解释，其次"少写"，最后"多写"
    if (dp[i][j] === dp[i - 1][j - 1] + 1) {
      ops.push({ type: 'sub', expected: expected[i - 1], actual: actual[j - 1] })
      i--
      j--
    } else if (dp[i][j] === dp[i - 1][j] + 1) {
      ops.push({ type: 'missing', expected: expected[i - 1] })
      i--
    } else {
      ops.push({ type: 'extra', actual: actual[j - 1] })
      j--
    }
  }
  while (i > 0) {
    ops.push({ type: 'missing', expected: expected[i - 1] })
    i--
  }
  while (j > 0) {
    ops.push({ type: 'extra', actual: actual[j - 1] })
    j--
  }

  return ops.reverse()
}

/** 选择差异更小的对齐基准（兼容"省略已给首字母"的输入）。 */
export function bestAlignment(expected: string, actual: string): SpellAlignment {
  const full = diffWord(expected, actual)
  if (expected.length > 1) {
    const tail = diffWord(expected.slice(1), actual)
    if (nonMatchCount(tail) < nonMatchCount(full)) {
      return { base: expected.slice(1), omittedGiven: true, ops: tail }
    }
  }
  return { base: expected, omittedGiven: false, ops: full }
}

export type SpellDiffSummary = {
  missing: number
  extra: number
  wrong: number
}

export function summarizeDiff(ops: SpellDiffOp[]): SpellDiffSummary {
  const summary: SpellDiffSummary = { missing: 0, extra: 0, wrong: 0 }
  for (const op of ops) {
    if (op.type === 'missing') summary.missing += 1
    else if (op.type === 'extra') summary.extra += 1
    else if (op.type === 'sub') summary.wrong += 1
  }
  return summary
}
