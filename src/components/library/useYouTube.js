// Player YouTube qua IFrame API. Cần API chứ không chỉ <iframe src> (như VideoPlayerModal) vì màn đọc
// bài phải đổi tốc độ 0.5×/0.25×, tua tới mốc khi bấm và đọc giờ đang phát để tô mốc / lặp đoạn.
//
// iframe do YouTube tạo nằm trong một div con tạo bằng tay: React không quản con của `boxRef`, nên
// YouTube thay div đó bằng iframe không làm React gỡ nhầm node lúc unmount.
// iOS: lần phát ĐẦU phải chạm thẳng vào khung video — bấm mốc trước đó chỉ tua, không tự phát.

import { useEffect, useRef, useState } from 'react'
import cfg from '#config/app.js'

let api = null
function loadApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT)
  if (!api) {
    api = new Promise((resolve) => {
      const prev = window.onYouTubeIframeAPIReady
      window.onYouTubeIframeAPIReady = () => { prev?.(); resolve(window.YT) }
      const s = document.createElement('script')
      s.src = 'https://www.youtube.com/iframe_api'
      document.head.appendChild(s)
    })
  }
  return api
}

const PLAYING = 1

/**
 * @param {string} videoId
 * @param {number} start  giây bắt đầu đoạn cần xem
 * @param {number|null} end  giây kết thúc, null = hết video
 * @param {{ a: number, b: number }|null} loop  đang "Lặp đoạn": chạy tới b thì tua về a
 */
export function useYouTube(videoId, start, end, loop) {
  const boxRef = useRef(null)
  const playerRef = useRef(null)
  const [time, setTime] = useState(start || 0)
  const [duration, setDuration] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [rate, setRateState] = useState(1)

  // Lần đầu: dựng player. Đổi video (bài nhiều video): nạp video mới vào player sẵn có.
  useEffect(() => {
    const seg = { videoId, startSeconds: start || 0, ...(end ? { endSeconds: end } : {}) }
    if (playerRef.current) {
      playerRef.current.cueVideoById(seg)
      return undefined
    }
    let alive = true
    loadApi().then((YT) => {
      if (!alive || !boxRef.current || playerRef.current) return
      const el = document.createElement('div')
      boxRef.current.appendChild(el)
      playerRef.current = new YT.Player(el, {
        videoId,
        width: '100%',
        height: '100%',
        playerVars: { playsinline: 1, rel: 0, start: seg.startSeconds, ...(end ? { end } : {}) },
        events: {
          onReady: (e) => setDuration(e.target.getDuration() || 0),
          onStateChange: (e) => {
            setPlaying(e.data === PLAYING)
            setTime(e.target.getCurrentTime() || 0)
            const d = e.target.getDuration()
            if (d) setDuration(d)
          },
          onPlaybackRateChange: (e) => setRateState(e.data),
        },
      })
    })
    return () => { alive = false }
  }, [videoId, start, end])

  useEffect(() => () => {
    playerRef.current?.destroy?.()
    playerRef.current = null
  }, [])

  // Đang phát thì đọc giờ đều đặn — tô mốc đang xem dựa vào đây. Lặp đoạn cũng kiểm ở cùng nhịp.
  useEffect(() => {
    if (!playing) return undefined
    const id = setInterval(() => {
      const p = playerRef.current
      const now = p?.getCurrentTime?.() || 0
      if (loop && now >= loop.b) {
        p.seekTo(loop.a, true)
        setTime(loop.a)
      } else setTime(now)
    }, cfg.library.pollMs)
    return () => clearInterval(id)
  }, [playing, loop])

  const seek = (t, play = true) => {
    const p = playerRef.current
    if (!p?.seekTo) return
    p.seekTo(t, true)
    if (play) p.playVideo()
    setTime(t)
  }
  const setRate = (r) => {
    playerRef.current?.setPlaybackRate?.(r)
    setRateState(r)
  }
  const pause = () => playerRef.current?.pauseVideo?.()

  return { boxRef, time, duration, playing, rate, seek, setRate, pause }
}
