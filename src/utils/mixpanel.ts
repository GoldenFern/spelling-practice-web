import type { TypingState } from '@/pages/Typing/store/type'
import type { InfoPanelType, PronunciationType } from '@/typings'
import { useCallback } from 'react'

/**
 * 本项目定制：上游使用 Mixpanel 做匿名统计，离线或国内网络下会挂起请求。
 * 这里保留完全相同的导出接口，但不再发送任何数据。
 */

export type starAction = 'star' | 'dismiss'

export function recordStarAction(_action: starAction) {
  // no-op
}

export type openInfoPanelLocation = 'footer' | 'resultScreen'
export function recordOpenInfoPanelAction(_type: InfoPanelType, _location: openInfoPanelLocation) {
  // no-op
}

export type shareType = 'open' | 'download'
export function recordShareAction(_type: shareType) {
  // no-op
}

export type analysisType = 'open'
export function recordAnalysisAction(_type: analysisType) {
  // no-op
}

export type errorBookType = 'open' | 'detail'
export function recordErrorBookAction(_type: errorBookType) {
  // no-op
}

export type donateCardInfo = {
  type: 'donate' | 'dismiss'
  chapterNumber: number
  wordNumber: number
  sumWrongCount: number
  dayFromFirstWord: number
  dayFromQwerty: number
  amount: number
}

export function reportDonateCard(_info: donateCardInfo) {
  // no-op
}

/**
 * 单词和章节统计事件（已停用）
 */
export type ModeInfo = {
  modeDictation: boolean
  modeDark: boolean
  modeShuffle: boolean

  enabledKeyboardSound: boolean
  enabledPhotonicsSymbol: boolean
  enabledSingleWordLoop: boolean

  pronunciationAuto: boolean
  pronunciationOption: PronunciationType | 'none'
}

export type WordLogUpload = ModeInfo & {
  headword: string
  timeStart: string
  timeEnd: string
  countInput: number
  countCorrect: number
  countTypo: number
  order: number
  chapter: string
  wordlist: string
}

export type ChapterLogUpload = ModeInfo & {
  chapter: string
  wordlist: string
  timeEnd: string
  duration: number
  countInput: number
  countCorrect: number
  countTypo: number
}

export function useMixPanelWordLogUploader(_typingState: TypingState) {
  return useCallback(
    (_wordLog: { headword: string; timeStart: string; timeEnd: string; countInput: number; countCorrect: number; countTypo: number }) => {
      // no-op
    },
    [],
  )
}

export function useMixPanelChapterLogUploader(_typingState: TypingState) {
  return useCallback(() => {
    // no-op
  }, [])
}

export function recordDataAction(_info: { type: 'export' | 'import'; size: number; wordCount: number; chapterCount: number }) {
  // no-op
}

export function getUtcStringForMixpanel() {
  const now = new Date()
  const isoString = now.toISOString()
  const utcString = isoString.substring(0, 19).replace('T', ' ')

  return utcString
}
