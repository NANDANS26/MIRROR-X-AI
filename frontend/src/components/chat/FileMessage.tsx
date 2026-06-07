import { useState } from 'react'
import { X, ZoomIn } from 'lucide-react'

interface Props {
  name: string
  preview: string
}

export default function FileMessage({ name, preview }: Props) {
  const [zoomed, setZoomed] = useState(false)

  return (
    <>
      <div className="mt-3 overflow-hidden rounded-xl border border-white/10 bg-[#111827]">
        <div className="relative group cursor-zoom-in" onClick={() => setZoomed(true)}>
          <img
            src={preview}
            alt={name}
            style={{
              maxWidth: '100%',
              maxHeight: 200,
              width: 'auto',
              height: 'auto',
              display: 'block',
              objectFit: 'contain',
            }}
          />
          {/* Zoom hint overlay */}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30 rounded-xl">
            <ZoomIn size={24} className="text-white" />
          </div>
        </div>
        <div className="px-3 py-2 text-xs text-gray-400 truncate">{name}</div>
      </div>

      {/* Zoom modal */}
      {zoomed && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setZoomed(false)}
        >
          <button
            className="absolute top-4 right-4 text-white/60 hover:text-white"
            onClick={() => setZoomed(false)}
          >
            <X size={24} />
          </button>
          <img
            src={preview}
            alt={name}
            style={{
              maxWidth: '90vw',
              maxHeight: '90vh',
              objectFit: 'contain',
              borderRadius: 8,
              boxShadow: '0 0 60px rgba(0,229,255,0.2)',
            }}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  )
}
