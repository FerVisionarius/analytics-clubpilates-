import { NavLink, Outlet, useParams } from 'react-router-dom'

const tabClass = ({ isActive }) =>
  `flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
    isActive
      ? 'bg-teal-600 text-white'
      : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
  }`

function IconHome() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  )
}

function IconContacts() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  )
}

function IconPhone() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
    </svg>
  )
}

function IconChat() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  )
}

export default function CRMShell() {
  const { branchId } = useParams()
  const base = `/centro/${branchId}/crm`

  return (
    <div className="fixed inset-0 top-25 bg-slate-900 flex flex-col z-10">
      <div className="border-b border-slate-700 bg-slate-800/80 backdrop-blur-sm px-6 py-3 flex items-center gap-2 shrink-0">
        <div className="w-7 h-7 rounded-lg bg-teal-600 flex items-center justify-center mr-2">
          <IconChat />
        </div>
        <span className="text-white font-semibold text-sm mr-4">Club Pilates CRM</span>
        <NavLink to={base} end className={tabClass}>
          <IconHome />
          Inicio
        </NavLink>
        <NavLink to={`${base}/contactos`} className={tabClass}>
          <IconContacts />
          Contactos
        </NavLink>
        <NavLink to={`${base}/llamadas`} className={tabClass}>
          <IconPhone />
          Histórico de llamadas
        </NavLink>
        <NavLink to={`${base}/chat`} className={tabClass}>
          <IconChat />
          Chat
        </NavLink>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">
        <Outlet />
      </div>
    </div>
  )
}
