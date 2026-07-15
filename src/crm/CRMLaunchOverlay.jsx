export default function CRMLaunchOverlay() {
  return (
    <div className="fixed inset-0 z-[100] bg-slate-900 flex flex-col items-center justify-center gap-4">
      <div className="w-16 h-16 rounded-2xl bg-teal-600 flex items-center justify-center animate-[crm-pop_0.4s_ease-out]">
        <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      </div>
      <p className="text-white text-sm font-medium animate-[crm-fade_0.5s_ease-out]">Abriendo Club Pilates CRM…</p>
      <style>{`
        @keyframes crm-pop {
          0% { transform: scale(0.5); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes crm-fade {
          0% { opacity: 0; transform: translateY(4px); }
          100% { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
