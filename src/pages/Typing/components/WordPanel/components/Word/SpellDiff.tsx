import { fontSizeConfigAtom } from '@/store'
import { bestAlignment, summarizeDiff } from '@/utils/spellDiff'
import { useAtomValue } from 'jotai'
import type { CSSProperties, ReactNode } from 'react'

type CellProps = {
  children?: ReactNode
  className?: string
  style: CSSProperties
}

function Cell({ children, className, style }: CellProps) {
  return (
    <span className={`inline-flex items-center justify-center ${className ?? ''}`} style={style}>
      {children}
    </span>
  )
}

/**
 * 本项目定制：答错时逐字符对齐展示差异。
 * 红色 = 你写的，橙色 = 正确写法中写错/漏掉的字母，虚线空位 = 漏写位置。
 */
export default function SpellDiff({ expected, actual }: { expected: string; actual: string }) {
  const fontSizeConfig = useAtomValue(fontSizeConfigAtom)
  const { omittedGiven, ops } = bestAlignment(expected, actual)
  const summary = summarizeDiff(ops)

  const cellStyle: CSSProperties = {
    fontSize: `${Math.round(fontSizeConfig.foreignFont * 0.72)}px`,
    width: `${Math.round(fontSizeConfig.foreignFont * 0.62)}px`,
    lineHeight: 1.3,
  }

  const summaryText = [
    summary.missing > 0 ? `少了 ${summary.missing} 个字母` : '',
    summary.extra > 0 ? `多了 ${summary.extra} 个字母` : '',
    summary.wrong > 0 ? `${summary.wrong} 处写错` : '',
  ]
    .filter(Boolean)
    .join('，')

  return (
    <div className="flex flex-col items-start gap-1">
      <div className="flex items-center gap-3">
        <span className="w-14 shrink-0 text-right text-xs text-gray-400">你的输入</span>
        <div className="flex justify-start font-mono">
          {omittedGiven && (
            <Cell className="text-indigo-300 dark:text-indigo-500/70" style={cellStyle}>
              {expected[0]}
            </Cell>
          )}
          {ops.map((op, index) => {
            if (op.type === 'match') {
              return (
                <Cell key={index} className="text-gray-500 dark:text-gray-300" style={cellStyle}>
                  {op.actual}
                </Cell>
              )
            }
            if (op.type === 'sub') {
              return (
                <Cell
                  key={index}
                  className="rounded bg-red-100 font-semibold text-red-500 dark:bg-red-900/40 dark:text-red-400"
                  style={cellStyle}
                >
                  {op.actual}
                </Cell>
              )
            }
            if (op.type === 'extra') {
              return (
                <Cell key={index} className="rounded bg-red-100 text-red-400 line-through dark:bg-red-900/40" style={cellStyle}>
                  {op.actual}
                </Cell>
              )
            }
            return (
              <Cell key={index} className="rounded border-b-2 border-dashed border-red-300 dark:border-red-700" style={cellStyle}>
                &nbsp;
              </Cell>
            )
          })}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className="w-14 shrink-0 text-right text-xs text-gray-400">正确拼写</span>
        <div className="flex justify-start font-mono">
          {omittedGiven && (
            <Cell className="text-indigo-300 dark:text-indigo-500/70" style={cellStyle}>
              {expected[0]}
            </Cell>
          )}
          {ops.map((op, index) => {
            if (op.type === 'match') {
              return (
                <Cell key={index} className="text-green-600 dark:text-green-400" style={cellStyle}>
                  {op.expected}
                </Cell>
              )
            }
            if (op.type === 'sub' || op.type === 'missing') {
              return (
                <Cell
                  key={index}
                  className="rounded bg-amber-100 font-semibold text-amber-600 underline decoration-2 dark:bg-amber-900/40 dark:text-amber-400"
                  style={cellStyle}
                >
                  {op.expected}
                </Cell>
              )
            }
            return (
              <Cell key={index} style={cellStyle}>
                &nbsp;
              </Cell>
            )
          })}
        </div>
      </div>
      {summaryText && <div className="pl-[4.25rem] text-xs text-gray-400">{summaryText}</div>}
    </div>
  )
}
