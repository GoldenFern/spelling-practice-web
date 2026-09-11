import { db } from '.'
import type { ISrsRecord } from './record'
import type { Dictionary, Word } from '@/typings'
import { wordListFetcher } from '@/utils/wordListFetcher'
import { createEmptyCard, fsrs, Rating } from 'ts-fsrs'
import type { Card, Grade } from 'ts-fsrs'

/**
 * 本项目定制：基于 ts-fsrs 的智能复习。
 * 每次拼写完成后更新对应单词的记忆卡片，首页按钮按到期时间生成复习队列。
 */
const scheduler = fsrs()

export type SrsAttempt = {
  /** 本次拼写过程中打错的次数 */
  wrongCount: number
  /** 一次打对时的总用时（毫秒），打错过则为 0 */
  elapsedMs: number
}

/** 把一次拼写表现映射为 FSRS 评分。 */
export function ratingFromAttempt({ wrongCount, elapsedMs }: SrsAttempt): Grade {
  if (wrongCount >= 2) return Rating.Again
  if (wrongCount === 1) return Rating.Hard
  if (elapsedMs > 0 && elapsedMs <= 2500) return Rating.Easy
  return Rating.Good
}

/** 更新单词的 FSRS 记忆状态。 */
export async function updateSrsCard(word: string, dict: string, rating: Grade): Promise<void> {
  const now = new Date()
  const existing = await db.srsRecords.where('[dict+word]').equals([dict, word]).first()
  const card: Card = existing?.card ?? createEmptyCard(now)
  const { card: nextCard } = scheduler.next(card, now, rating)
  const record: ISrsRecord = {
    id: existing?.id,
    dict,
    word,
    due: nextCard.due,
    card: nextCard,
    updatedAt: Date.now(),
  }
  await db.srsRecords.put(record)
}

/** 整词提交答错时立即按 Again 排期（短间隔后再次到期）。 */
export async function markSrsFailure(word: string, dict: string): Promise<void> {
  await updateSrsCard(word, dict, Rating.Again)
}

/** 返回词典内所有已到期的记忆卡片，按到期时间升序。 */
export async function getDueSrsRecords(dict: string): Promise<ISrsRecord[]> {
  const now = new Date()
  const records = await db.srsRecords.where('dict').equals(dict).toArray()
  return records.filter((record) => record.due <= now).sort((a, b) => a.due.getTime() - b.due.getTime())
}

/** 今日到期数量。 */
export async function getDueCount(dict: string): Promise<number> {
  return (await getDueSrsRecords(dict)).length
}

/** 组装到期复习队列（带完整词典字段），供 ReviewRecord 使用。 */
export async function getDueReviewWords(dict: Dictionary): Promise<Word[]> {
  const dueRecords = await getDueSrsRecords(dict.id)
  if (dueRecords.length === 0) return []

  const allWords = await wordListFetcher(dict.url)
  const wordMap = new Map(allWords.map((word) => [word.name, word]))
  return dueRecords.map((record) => wordMap.get(record.word)).filter((word): word is Word => word !== undefined)
}
