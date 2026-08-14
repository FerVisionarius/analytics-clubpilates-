import { useEffect, useRef } from 'react'

export const HCAPTCHA_SITEKEY = 'b31ccefc-877e-4ec6-83d8-5e2628bab65e'

let scriptPromise = null
function loadHcaptcha() {
  if (typeof window !== 'undefined' && window.hcaptcha) return Promise.resolve()
  if (scriptPromise) return scriptPromise
  scriptPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://js.hcaptcha.com/1/api.js?render=explicit'
    s.async = true
    s.defer = true
    s.onload = resolve
    s.onerror = reject
    document.head.appendChild(s)
  })
  return scriptPromise
}

// Widget hCaptcha (carga por script). onVerify(token) al resolver; onExpire al
// caducar/error. Cambiar `resetSignal` reinicia el widget (para reintentos).
export default function HCaptchaWidget({ onVerify, onExpire, resetSignal }) {
  const ref = useRef(null)
  const widgetId = useRef(null)

  useEffect(() => {
    let cancelled = false
    loadHcaptcha().then(() => {
      if (cancelled || !ref.current || !window.hcaptcha || widgetId.current !== null) return
      widgetId.current = window.hcaptcha.render(ref.current, {
        sitekey: HCAPTCHA_SITEKEY,
        callback: token => onVerify?.(token),
        'expired-callback': () => onExpire?.(),
        'error-callback': () => onExpire?.(),
      })
    }).catch(() => {})
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (widgetId.current !== null && window.hcaptcha) {
      window.hcaptcha.reset(widgetId.current)
      onExpire?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetSignal])

  return <div ref={ref} className="flex justify-center" />
}
