import type { WordUpdateAction } from '../InputHandler'
import InputHandler from '../InputHandler'
import Letter from './Letter'
import Notation from './Notation'
import { TipAlert } from './TipAlert'
import style from './index.module.css'
import { initialWordState } from './type'
import type { WordState } from './type'
import Tooltip from '@/components/Tooltip'
import type { WordPronunciationIconRef } from '@/components/WordPronunciationIcon'
import { WordPronunciationIcon } from '@/components/WordPronunciationIcon'
import { EXPLICIT_SPACE } from '@/constants'
import useKeySounds from '@/hooks/useKeySounds'
import { TypingContext, TypingStateActionType } from '@/pages/Typing/store'
import {
  currentChapterAtom,
  currentDictInfoAtom,
  fontSizeConfigAtom,
  isIgnoreCaseAtom,
  isShowAnswerOnHoverAtom,
  isTextSelectableAtom,
  pronunciationIsOpenAtom,
  wordDictationConfigAtom,
} from '@/store'
import type { Word } from '@/typings'
import { CTRL, getUtcStringForMixpanel } from '@/utils'
import { useSaveWordRecord } from '@/utils/db'
import { markSrsFailure, ratingFromAttempt, updateSrsCard } from '@/utils/db/srs'
import { useAtomValue } from 'jotai'
import { useCallback, useContext, useEffect, useRef, useState } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'
import { useImmer } from 'use-immer'

const vowelLetters = ['A', 'E', 'I', 'O', 'U']

/** 渲染词典 note，`**片段**` 显示为橙色加粗。 */
function renderNote(note: string) {
  return note.split('**').map((part, index) =>
    index % 2 === 1 ? (
      <strong key={index} className="font-semibold text-orange-500">
        {part}
      </strong>
    ) : (
      <span key={index}>{part}</span>
    ),
  )
}

export default function WordComponent({ word, onFinish }: { word: Word; onFinish: () => void }) {
  // eslint-disable-next-line  @typescript-eslint/no-non-null-assertion
  const { state, dispatch } = useContext(TypingContext)!
  const [wordState, setWordState] = useImmer<WordState>(structuredClone(initialWordState))

  const wordDictationConfig = useAtomValue(wordDictationConfigAtom)
  const isTextSelectable = useAtomValue(isTextSelectableAtom)
  const isIgnoreCase = useAtomValue(isIgnoreCaseAtom)
  const isShowAnswerOnHover = useAtomValue(isShowAnswerOnHoverAtom)
  const saveWordRecord = useSaveWordRecord()
  // const wordLogUploader = useMixPanelWordLogUploader(state)
  const [playKeySound, playBeepSound, playHintSound] = useKeySounds()
  const pronunciationIsOpen = useAtomValue(pronunciationIsOpenAtom)
  const [isHoveringWord, setIsHoveringWord] = useState(false)
  const currentLanguage = useAtomValue(currentDictInfoAtom).language
  const currentLanguageCategory = useAtomValue(currentDictInfoAtom).languageCategory
  const currentDictInfo = useAtomValue(currentDictInfoAtom)
  const currentChapter = useAtomValue(currentChapterAtom)

  const [showTipAlert, setShowTipAlert] = useState(false)
  const wordPronunciationIconRef = useRef<WordPronunciationIconRef>(null)
  const fontSizeConfig = useAtomValue(fontSizeConfigAtom)

  // 本项目定制：整词默写模式（显示首字母提示，无逐字母反馈）
  const isSubmitMode = wordDictationConfig.isOpen && wordDictationConfig.type === 'firstLetter'
  const [submitResult, setSubmitResult] = useState<'typing' | 'wrong'>('typing')
  const attemptStartedAtRef = useRef(Date.now())

  useEffect(() => {
    // run only when word changes
    let headword = ''
    try {
      headword = word.name.replace(new RegExp(' ', 'g'), EXPLICIT_SPACE)
      headword = headword.replace(new RegExp('…', 'g'), '..')
    } catch (e) {
      console.error('word.name is not a string', word)
      headword = ''
    }

    const newWordState = structuredClone(initialWordState)
    newWordState.displayWord = headword
    newWordState.letterStates = new Array(headword.length).fill('normal')
    newWordState.startTime = getUtcStringForMixpanel()
    newWordState.randomLetterVisible = headword.split('').map(() => Math.random() > 0.4)
    setWordState(newWordState)
    setSubmitResult('typing')
    attemptStartedAtRef.current = Date.now()
  }, [word, setWordState])

  const updateInput = useCallback(
    (updateAction: WordUpdateAction) => {
      switch (updateAction.type) {
        case 'add':
          if (wordState.hasWrong) return
          if (isSubmitMode && submitResult !== 'typing') return
          if (isSubmitMode && updateAction.value === ' ') {
            updateAction.event.preventDefault()
            return
          }

          if (updateAction.value === ' ') {
            updateAction.event.preventDefault()
            setWordState((state) => {
              state.inputWord = state.inputWord + EXPLICIT_SPACE
            })
          } else {
            setWordState((state) => {
              state.inputWord = state.inputWord + updateAction.value
            })
          }
          // 整词模式下不逐字母校验，手动补上机械键盘敲击音
          if (isSubmitMode && updateAction.value !== ' ') {
            playKeySound()
          }
          break

        case 'delete':
          if (wordState.hasWrong || submitResult !== 'typing') return
          setWordState((state) => {
            state.inputWord = state.inputWord.slice(0, Math.max(0, state.inputWord.length - updateAction.length))
          })
          if (isSubmitMode) {
            playKeySound()
          }
          break

        default:
          console.warn('unknown update type', updateAction)
      }
    },
    [isSubmitMode, playKeySound, submitResult, wordState.hasWrong, setWordState],
  )

  const handleHoverWord = useCallback((checked: boolean) => {
    setIsHoveringWord(checked)
  }, [])

  useHotkeys(
    'tab',
    () => {
      handleHoverWord(true)
    },
    { enableOnFormTags: true, preventDefault: true },
    [],
  )

  useHotkeys(
    'tab',
    () => {
      handleHoverWord(false)
    },
    { enableOnFormTags: true, keyup: true, preventDefault: true },
    [],
  )
  useHotkeys(
    'ctrl+j',
    () => {
      if (state.isTyping) {
        wordPronunciationIconRef.current?.play()
      }
    },
    [state.isTyping],
    { enableOnFormTags: true, preventDefault: true },
  )

  const handleSubmit = useCallback(() => {
    if (!isSubmitMode || wordState.isFinished) return

    if (submitResult === 'wrong') {
      onFinish()
      return
    }

    if (!state.isTyping) return

    const target = wordState.displayWord.trim().toLowerCase()
    const typed = wordState.inputWord.trim().toLowerCase()
    if (typed.length === 0) return

    // 首字母已给出，允许输入完整单词，也允许省略首字母
    const isCorrect = typed === target || (target.length > 1 && typed === target.slice(1))

    if (isCorrect) {
      const finishedAt = Date.now()
      setWordState((draft) => {
        draft.letterStates = draft.letterStates.map(() => 'correct')
        draft.letterTimeArray = [attemptStartedAtRef.current, finishedAt]
        draft.isFinished = true
        draft.endTime = getUtcStringForMixpanel()
      })
      dispatch({ type: TypingStateActionType.REPORT_CORRECT_WORD })
      playHintSound()
    } else {
      playBeepSound()
      dispatch({ type: TypingStateActionType.REPORT_WRONG_WORD, payload: { letterMistake: {} } })
      dispatch({ type: TypingStateActionType.REQUEUE_CURRENT_WORD })
      void saveWordRecord({ word: word.name, wrongCount: 1, letterTimeArray: [], letterMistake: {} })
      void markSrsFailure(word.name, currentDictInfo.id)
      setSubmitResult('wrong')
    }
  }, [
    currentDictInfo.id,
    dispatch,
    isSubmitMode,
    onFinish,
    playBeepSound,
    playHintSound,
    saveWordRecord,
    state.isTyping,
    submitResult,
    word.name,
    wordState.displayWord,
    wordState.inputWord,
    wordState.isFinished,
    setWordState,
  ])

  useHotkeys(
    'enter',
    (e) => {
      if (!isSubmitMode) return
      e.preventDefault()
      if (!state.isTyping) {
        dispatch({ type: TypingStateActionType.SET_IS_TYPING, payload: true })
        return
      }
      handleSubmit()
    },
    { enableOnFormTags: true, preventDefault: true },
    [dispatch, handleSubmit, isSubmitMode, state.isTyping],
  )

  useEffect(() => {
    if (wordState.inputWord.length === 0 && state.isTyping) {
      wordPronunciationIconRef.current?.play && wordPronunciationIconRef.current?.play()
    }
  }, [state.isTyping, wordState.inputWord.length, wordPronunciationIconRef.current?.play])

  const getLetterVisible = useCallback(
    (index: number) => {
      if (wordState.letterStates[index] === 'correct' || (isShowAnswerOnHover && isHoveringWord)) return true

      if (wordDictationConfig.isOpen) {
        if (wordDictationConfig.type === 'hideAll') return false

        const letter = wordState.displayWord[index]

        // 定制模式：只显示首字母，其余字母留空（与纸面练习册一致）
        if (wordDictationConfig.type === 'firstLetter') {
          return index === 0 || !/[a-zA-Z]/.test(letter)
        }

        if (wordDictationConfig.type === 'hideVowel') {
          return vowelLetters.includes(letter.toUpperCase()) ? false : true
        }
        if (wordDictationConfig.type === 'hideConsonant') {
          return vowelLetters.includes(letter.toUpperCase()) ? true : false
        }
        if (wordDictationConfig.type === 'randomHide') {
          return wordState.randomLetterVisible[index]
        }
      }
      return true
    },
    [
      isHoveringWord,
      isShowAnswerOnHover,
      wordDictationConfig.isOpen,
      wordDictationConfig.type,
      wordState.displayWord,
      wordState.letterStates,
      wordState.randomLetterVisible,
    ],
  )

  useEffect(() => {
    // 本项目定制：整词提交模式不做逐字母校验，等 Enter 统一判定
    if (isSubmitMode) return

    const inputLength = wordState.inputWord.length
    /**
     * TODO: 当用户输入错误时，会报错
     * Cannot update a component (`App`) while rendering a different component (`WordComponent`). To locate the bad setState() call inside `WordComponent`, follow the stack trace as described in https://reactjs.org/link/setstate-in-render
     * 目前不影响生产环境，猜测是因为开发环境下 react 会两次调用 useEffect 从而展示了这个 warning
     * 但这终究是一个 bug，需要修复
     */
    if (wordState.hasWrong || inputLength === 0 || wordState.displayWord.length === 0) {
      return
    }

    const inputChar = wordState.inputWord[inputLength - 1]
    const correctChar = wordState.displayWord[inputLength - 1]
    let isEqual = false
    if (inputChar != undefined && correctChar != undefined) {
      isEqual = isIgnoreCase ? inputChar.toLowerCase() === correctChar.toLowerCase() : inputChar === correctChar
    }

    if (isEqual) {
      // 输入正确时
      setWordState((state) => {
        state.letterTimeArray.push(Date.now())
        state.correctCount += 1
      })

      if (inputLength >= wordState.displayWord.length) {
        // 完成输入时
        setWordState((state) => {
          state.letterStates[inputLength - 1] = 'correct'
          state.isFinished = true
          state.endTime = getUtcStringForMixpanel()
        })
        playHintSound()
      } else {
        setWordState((state) => {
          state.letterStates[inputLength - 1] = 'correct'
        })
        playKeySound()
      }

      dispatch({ type: TypingStateActionType.REPORT_CORRECT_WORD })
    } else {
      // 出错时
      playBeepSound()
      setWordState((state) => {
        state.letterStates[inputLength - 1] = 'wrong'
        state.hasWrong = true
        state.hasMadeInputWrong = true
        state.wrongCount += 1
        state.letterTimeArray = []

        if (state.letterMistake[inputLength - 1]) {
          state.letterMistake[inputLength - 1].push(inputChar)
        } else {
          state.letterMistake[inputLength - 1] = [inputChar]
        }

        const currentState = JSON.parse(JSON.stringify(state))
        dispatch({ type: TypingStateActionType.REPORT_WRONG_WORD, payload: { letterMistake: currentState.letterMistake } })
      })

      if (currentChapter === 0 && state.chapterData.index === 0 && wordState.wrongCount >= 3) {
        setShowTipAlert(true)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wordState.inputWord])

  useEffect(() => {
    if (wordState.hasWrong) {
      const timer = setTimeout(() => {
        setWordState((state) => {
          state.inputWord = ''
          state.letterStates = new Array(state.letterStates.length).fill('normal')
          state.hasWrong = false
        })
      }, 300)

      return () => {
        clearTimeout(timer)
      }
    }
  }, [wordState.hasWrong, setWordState])

  useEffect(() => {
    if (wordState.isFinished) {
      dispatch({ type: TypingStateActionType.SET_IS_SAVING_RECORD, payload: true })

      // wordLogUploader({
      //   headword: word.name,
      //   timeStart: wordState.startTime,
      //   timeEnd: wordState.endTime,
      //   countInput: wordState.correctCount + wordState.wrongCount,
      //   countCorrect: wordState.correctCount,
      //   countTypo: wordState.wrongCount,
      // })
      saveWordRecord({
        word: word.name,
        wrongCount: wordState.wrongCount,
        letterTimeArray: wordState.letterTimeArray,
        letterMistake: wordState.letterMistake,
      })

      // 本项目定制：更新 FSRS 记忆卡片
      const letterTimeArray = wordState.letterTimeArray
      const elapsedMs = letterTimeArray.length > 1 ? letterTimeArray[letterTimeArray.length - 1] - letterTimeArray[0] : 0
      const rating = ratingFromAttempt({ wrongCount: wordState.wrongCount, elapsedMs })
      void updateSrsCard(word.name, currentDictInfo.id, rating)

      onFinish()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wordState.isFinished])

  useEffect(() => {
    if (wordState.wrongCount >= 4) {
      dispatch({ type: TypingStateActionType.SET_IS_SKIP, payload: true })
    }
  }, [wordState.wrongCount, dispatch])

  return (
    <>
      <InputHandler updateInput={updateInput} />
      <div
        lang={currentLanguageCategory !== 'code' ? currentLanguageCategory : 'en'}
        className="flex flex-col items-center justify-center pb-1 pt-4"
      >
        {['romaji', 'hapin'].includes(currentLanguage) && word.notation && <Notation notation={word.notation} />}
        <div
          className={`relative w-fit bg-transparent p-0 leading-normal shadow-none dark:bg-transparent ${
            !isSubmitMode && wordDictationConfig.isOpen ? 'tooltip-info tooltip' : ''
          }`}
          data-tip={isSubmitMode ? undefined : '按 Tab 快捷键显示完整单词'}
        >
          {isSubmitMode ? (
            <div className="flex flex-col items-center justify-center gap-3">
              {submitResult === 'wrong' ? (
                <div className="flex flex-col items-center gap-2">
                  <div
                    className="flex items-baseline justify-center gap-4 font-mono"
                    style={{ fontSize: fontSizeConfig.foreignFont.toString() + 'px' }}
                  >
                    <span className="text-red-400 line-through decoration-2">{wordState.inputWord || '—'}</span>
                    <span className="font-semibold text-green-600 dark:text-green-400">{wordState.displayWord}</span>
                  </div>
                  {word.note && (
                    <div className="max-w-2xl text-center text-sm text-gray-500 dark:text-gray-400">{renderNote(word.note)}</div>
                  )}
                  <div className="text-xs text-gray-400">答错了，这个词稍后会再出现；按 Enter 继续</div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <div
                    className="flex items-baseline justify-center gap-3 font-mono"
                    style={{ fontSize: fontSizeConfig.foreignFont.toString() + 'px' }}
                  >
                    <span className="select-none text-indigo-400/80">{wordState.displayWord.slice(0, 1)}</span>
                    <span className="min-w-[10rem] border-b-2 border-indigo-300 pb-1 text-left dark:border-indigo-700">
                      {wordState.inputWord}
                      {state.isTyping && <span className="animate-pulse text-indigo-400">|</span>}
                    </span>
                  </div>
                  <div className="text-xs text-gray-400">输入完整单词（首字母可省略），按 Enter 提交</div>
                </div>
              )}
            </div>
          ) : (
            <div
              className={`flex items-center ${isTextSelectable && 'select-all'} justify-center ${wordState.hasWrong ? style.wrong : ''}`}
            >
              {wordState.displayWord.split('').map((t, index) => {
                return <Letter key={`${index}-${t}`} letter={t} visible={getLetterVisible(index)} state={wordState.letterStates[index]} />
              })}
            </div>
          )}
          {pronunciationIsOpen && (
            <div className="absolute -right-12 top-1/2 h-9 w-9 -translate-y-1/2 transform ">
              <Tooltip content={`快捷键${CTRL} + J`}>
                <WordPronunciationIcon word={word} lang={currentLanguage} ref={wordPronunciationIconRef} className="h-full w-full" />
              </Tooltip>
            </div>
          )}
        </div>
      </div>
      <TipAlert className="fixed bottom-10 right-3" show={showTipAlert} setShow={setShowTipAlert} />
    </>
  )
}
