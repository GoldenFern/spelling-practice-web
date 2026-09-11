import type { WordUpdateAction } from '../InputHandler'
import { TypingContext, TypingStateActionType } from '@/pages/Typing/store'
import { isChineseSymbol, isLegal } from '@/utils'
import { useCallback, useContext, useEffect } from 'react'

export default function KeyEventHandler({ updateInput }: { updateInput: (updateObj: WordUpdateAction) => void }) {
  // eslint-disable-next-line  @typescript-eslint/no-non-null-assertion
  const { state, dispatch } = useContext(TypingContext)!

  const onKeydown = useCallback(
    (e: KeyboardEvent) => {
      const char = e.key

      if (isChineseSymbol(char)) {
        alert('您正在使用输入法，请关闭输入法。')
        return
      }

      if (e.altKey || e.ctrlKey || e.metaKey) {
        return
      }

      if (char === 'Backspace') {
        e.preventDefault()
        updateInput({ type: 'delete', length: 1 })
        return
      }

      // 本项目定制：整词提交模式下第一个字母即开始练习，不再吞掉首键
      if (isLegal(char) && char.length === 1) {
        if (!state.isTyping) {
          dispatch({ type: TypingStateActionType.SET_IS_TYPING, payload: true })
        }
        updateInput({ type: 'add', value: char, event: e })
      }
    },
    [dispatch, state.isTyping, updateInput],
  )

  useEffect(() => {
    window.addEventListener('keydown', onKeydown)
    return () => {
      window.removeEventListener('keydown', onKeydown)
    }
  }, [onKeydown])

  return <></>
}
