import { TypingContext } from '../../store'
import Tooltip from '@/components/Tooltip'
import { currentChapterAtom, currentDictInfoAtom, isReviewModeAtom, reviewModeInfoAtom } from '@/store'
import { db } from '@/utils/db'
import { ReviewRecord } from '@/utils/db/record'
import { getDueCount, getDueReviewWords } from '@/utils/db/srs'
import { useAtomValue, useSetAtom } from 'jotai'
import { useCallback, useContext, useEffect, useState } from 'react'
import IconBrain from '~icons/tabler/brain'

/**
 * 本项目定制：智能复习入口。
 * 依据 ts-fsrs 的到期时间生成复习队列，复用语料库的复习模式（ReviewRecord）。
 */
export default function SrsReviewButton() {
  const { state } = useContext(TypingContext) ?? {}
  const currentDictInfo = useAtomValue(currentDictInfoAtom)
  const isReviewMode = useAtomValue(isReviewModeAtom)
  const setCurrentChapter = useSetAtom(currentChapterAtom)
  const setReviewModeInfo = useSetAtom(reviewModeInfoAtom)
  const [dueCount, setDueCount] = useState(0)

  const refresh = useCallback(async () => {
    try {
      setDueCount(await getDueCount(currentDictInfo.id))
    } catch (error) {
      console.error('获取到期复习数量失败', error)
    }
  }, [currentDictInfo.id])

  useEffect(() => {
    void refresh()
    const intervalId = window.setInterval(() => {
      void refresh()
    }, 60_000)
    return () => window.clearInterval(intervalId)
  }, [refresh, isReviewMode, state?.isFinished])

  const startReview = useCallback(async () => {
    const words = await getDueReviewWords(currentDictInfo)
    if (words.length === 0) {
      await refresh()
      return
    }
    const record = new ReviewRecord(currentDictInfo.id, words)
    await db.reviewRecords.put(record)
    setCurrentChapter(-1)
    setReviewModeInfo({ isReviewMode: true, reviewRecord: record })
    await refresh()
  }, [currentDictInfo, refresh, setCurrentChapter, setReviewModeInfo])

  if (!state || state.isTyping || isReviewMode || dueCount === 0) {
    return null
  }

  return (
    <Tooltip content={`智能复习：今日 ${dueCount} 个到期单词`} className="box-content h-7 px-2 py-1">
      <button
        type="button"
        onClick={startReview}
        aria-label={`智能复习，今日 ${dueCount} 个到期单词`}
        className="relative flex h-full items-center justify-center gap-1 rounded-lg bg-emerald-500 px-3 text-white shadow-md shadow-emerald-200 transition-colors hover:opacity-90 focus:outline-none dark:text-opacity-90 dark:shadow-none"
      >
        <IconBrain className="h-5 w-5" />
        <span className="text-base font-medium">{dueCount}</span>
      </button>
    </Tooltip>
  )
}
