import { useEffect, useState } from 'react'

interface Props {
  text: string
  skipAnimation?: boolean
}

export default function TypewriterText({ text, skipAnimation = false }: Props) {
  const [display, setDisplay] = useState(skipAnimation ? text : '')

  useEffect(() => {
    if (skipAnimation) {
      setDisplay(text)
      return
    }

    let index = 0
    setDisplay('')

    const interval = setInterval(() => {
      index++
      setDisplay(text.slice(0, index))
      if (index >= text.length) {
        clearInterval(interval)
      }
    }, 18)

    return () => clearInterval(interval)
  }, [text, skipAnimation])

  return <span>{display}</span>
}
