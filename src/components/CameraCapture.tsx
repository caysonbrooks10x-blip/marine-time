'use client'

import { useRef, useState, useCallback, useEffect } from 'react'

interface Props {
  onCapture: (base64: string) => void
  onSkip: () => void
}

export default function CameraCapture({ onCapture, onSkip }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [streaming, setStreaming] = useState(false)
  const [captured, setCaptured] = useState<string | null>(null)
  const [error, setError] = useState('')
  const streamRef = useRef<MediaStream | null>(null)

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      })
      streamRef.current = stream
      // Set streaming first so the video element renders, then assign stream
      setStreaming(true)
    } catch {
      setError('Camera access denied or not available')
    }
  }, [])

  // Assign the stream to the video element once it's rendered
  useEffect(() => {
    if (streaming && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current
      videoRef.current.play().catch(() => {
        setError('Camera failed to start')
      })
    }
  }, [streaming])

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    setStreaming(false)
  }

  function takeSnapshot() {
    if (!videoRef.current || !canvasRef.current) return

    const video = videoRef.current
    const canvas = canvasRef.current
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Mirror the selfie
    ctx.translate(canvas.width, 0)
    ctx.scale(-1, 1)
    ctx.drawImage(video, 0, 0)

    const base64 = canvas.toDataURL('image/jpeg', 0.8)
    setCaptured(base64)
    stopCamera()
  }

  function retake() {
    setCaptured(null)
    startCamera()
  }

  function confirm() {
    if (captured) {
      onCapture(captured)
    }
  }

  function handleSkip() {
    stopCamera()
    onSkip()
  }

  // Not started yet
  if (!streaming && !captured && !error) {
    return (
      <div className="space-y-3">
        <div className="text-slate-300 text-lg text-center">
          Take a selfie for attendance verification (optional)
        </div>
        <button
          onClick={startCamera}
          className="w-full min-h-[56px] bg-slate-700 hover:bg-slate-600 text-white text-xl font-semibold rounded-2xl transition-colors"
        >
          Open Camera
        </button>
        <button
          onClick={handleSkip}
          className="w-full min-h-[56px] bg-transparent border border-slate-600 text-slate-400 hover:text-white text-xl rounded-2xl transition-colors"
        >
          Skip Photo
        </button>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-3">
        <div className="bg-red-900/50 border border-red-500 rounded-xl p-3 text-red-300 text-lg text-center">
          {error}
        </div>
        <button
          onClick={handleSkip}
          className="w-full min-h-[56px] bg-transparent border border-slate-600 text-slate-400 hover:text-white text-xl rounded-2xl"
        >
          Continue Without Photo
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <canvas ref={canvasRef} className="hidden" />

      {streaming && !captured && (
        <>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full rounded-2xl bg-black"
            style={{ transform: 'scaleX(-1)' }}
          />
          <div className="flex gap-3">
            <button
              onClick={takeSnapshot}
              className="flex-1 min-h-[56px] bg-emerald-600 hover:bg-emerald-500 text-white text-xl font-bold rounded-2xl"
            >
              Capture
            </button>
            <button
              onClick={handleSkip}
              className="min-h-[56px] px-6 bg-transparent border border-slate-600 text-slate-400 hover:text-white text-lg rounded-2xl"
            >
              Skip
            </button>
          </div>
        </>
      )}

      {captured && (
        <>
          <img src={captured} alt="Captured selfie" className="w-full rounded-2xl" />
          <div className="flex gap-3">
            <button
              onClick={retake}
              className="flex-1 min-h-[56px] bg-slate-700 hover:bg-slate-600 text-white text-xl rounded-2xl"
            >
              Retake
            </button>
            <button
              onClick={confirm}
              className="flex-1 min-h-[56px] bg-emerald-600 hover:bg-emerald-500 text-white text-xl font-bold rounded-2xl"
            >
              Use Photo
            </button>
          </div>
        </>
      )}
    </div>
  )
}
