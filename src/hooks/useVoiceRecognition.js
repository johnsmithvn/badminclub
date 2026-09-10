import { useState, useEffect, useRef, useCallback } from 'react'

export function useVoiceRecognition({ lang = 'vi-VN', onResult } = {}) {
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [interimTranscript, setInterimTranscript] = useState('')
  const [error, setError] = useState(null)

  const onResultRef = useRef(onResult)
  useEffect(() => {
    onResultRef.current = onResult
  }, [onResult])

  const recognitionRef = useRef(null)
  const isSupported = typeof window !== 'undefined' && Boolean(
    window.SpeechRecognition || window.webkitSpeechRecognition
  )

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop()
      } catch {
        // ignore if already stopped
      }
      setIsListening(false)
    }
  }, [])

  const startListening = useCallback(() => {
    setError(null)
    if (!isSupported) {
      setError('not_supported')
      return
    }

    // Stop any existing instance
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort()
      } catch {
        // ignore
      }
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    const recognition = new SpeechRecognition()
    recognitionRef.current = recognition

    recognition.lang = lang
    recognition.continuous = false
    recognition.interimResults = true
    recognition.maxAlternatives = 1

    recognition.onstart = () => {
      setIsListening(true)
      setInterimTranscript('')
    }

    recognition.onresult = (event) => {
      let finalStr = ''
      let interimStr = ''

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const item = event.results[i]
        const text = item[0]?.transcript || ''
        if (item.isFinal) {
          finalStr += text
        } else {
          interimStr += text
        }
      }

      if (finalStr) {
        setTranscript((prev) => {
          const next = (prev ? `${prev} ${finalStr}` : finalStr).trim()
          onResultRef.current?.(next)
          return next
        })
        setInterimTranscript('')
      } else {
        setInterimTranscript(interimStr)
      }
    }

    recognition.onerror = (event) => {
      setError(event.error || 'unknown_error')
      setIsListening(false)
    }

    recognition.onend = () => {
      setIsListening(false)
    }

    try {
      recognition.start()
    } catch {
      setError('start_failed')
      setIsListening(false)
    }
  }, [isSupported, lang])

  const resetTranscript = useCallback(() => {
    setTranscript('')
    setInterimTranscript('')
    setError(null)
  }, [])

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort()
        } catch {
          // ignore
        }
      }
    }
  }, [])

  return {
    isSupported,
    isListening,
    transcript,
    interimTranscript,
    error,
    startListening,
    stopListening,
    setTranscript,
    resetTranscript,
  }
}

export default useVoiceRecognition
