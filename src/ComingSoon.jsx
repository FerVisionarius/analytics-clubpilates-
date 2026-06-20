export default function ComingSoon({ titulo }) {
  return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <div className="w-12 h-12 rounded-xl bg-primary-100 flex items-center justify-center mb-4">
          <svg className="w-6 h-6 text-primary-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className="text-text-200 font-medium">{titulo}</p>
        <p className="text-primary-300 text-sm mt-1">Próximamente</p>
      </div>
  )
}
