'use client'

interface Props {
  pin: string
  maxLength?: number
  loading?: boolean
  error?: string
  onDigit: (d: string) => void
  onDelete: () => void
  onSubmit?: () => void
  submitLabel?: string
  submitDisabled?: boolean
}

export default function PinPad({
  pin,
  maxLength = 4,
  loading = false,
  error,
  onDigit,
  onDelete,
  onSubmit,
  submitLabel = 'Confirm',
  submitDisabled = false,
}: Props) {
  const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫']

  return (
    <div className="space-y-5">
      {/* PIN dots */}
      <div className="flex gap-4 justify-center">
        {Array.from({ length: maxLength }).map((_, i) => (
          <div
            key={i}
            className={`w-5 h-5 rounded-full transition-colors ${
              i < pin.length ? 'bg-sky-400' : 'bg-slate-600'
            }`}
          />
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-900/50 border border-red-500 rounded-xl p-3 text-red-300 text-center text-lg">
          {error}
        </div>
      )}

      {/* Numpad */}
      <div className="grid grid-cols-3 gap-3">
        {digits.map((d, i) => {
          if (d === '') return <div key={i} />
          const isBack = d === '⌫'
          return (
            <button
              key={i}
              onClick={() => isBack ? onDelete() : onDigit(d)}
              disabled={loading || (!isBack && pin.length >= maxLength)}
              className={`min-h-[72px] rounded-2xl text-3xl font-bold transition-colors active:scale-95 ${
                isBack
                  ? 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                  : 'bg-slate-700 hover:bg-slate-600 text-white disabled:opacity-40'
              }`}
            >
              {d}
            </button>
          )
        })}
      </div>

      {/* Submit button — optional */}
      {onSubmit && (
        <button
          onClick={onSubmit}
          disabled={loading || submitDisabled || pin.length < maxLength}
          className="w-full min-h-[64px] bg-sky-500 hover:bg-sky-400 disabled:bg-slate-700 disabled:text-slate-500 text-white text-2xl font-bold rounded-2xl transition-colors"
        >
          {loading ? 'Please wait…' : submitLabel}
        </button>
      )}
    </div>
  )
}
