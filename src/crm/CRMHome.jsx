import { Link, useParams } from 'react-router-dom'

function CRMCard({ to, title, desc, icon }) {
  return (
    <Link
      to={to}
      className="group bg-slate-800 border border-slate-700 rounded-2xl p-6 flex flex-col gap-3 hover:border-teal-500 hover:bg-slate-800/70 transition-all"
    >
      <div className="w-12 h-12 rounded-xl bg-slate-700 text-teal-400 flex items-center justify-center group-hover:bg-teal-600 group-hover:text-white transition-colors">
        {icon}
      </div>
      <div>
        <p className="font-semibold text-white">{title}</p>
        <p className="text-sm text-slate-400 mt-0.5">{desc}</p>
      </div>
    </Link>
  )
}

export default function CRMHome() {
  const { branchId } = useParams()
  const base = `/centro/${branchId}/crm`

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">CRM</h1>
        <p className="text-slate-400 text-sm mt-1">Contactos, llamadas y conversaciones de este centro</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <CRMCard
          to={`${base}/contactos`}
          title="Contactos"
          desc="Base de datos de clientes y leads"
          icon={(
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          )}
        />
        <CRMCard
          to={`${base}/llamadas`}
          title="Histórico de llamadas"
          desc="Llamadas gestionadas por Retell"
          icon={(
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
          )}
        />
        <CRMCard
          to={`${base}/chat`}
          title="Chat"
          desc="Conversaciones por contacto"
          icon={(
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          )}
        />
      </div>
    </div>
  )
}
