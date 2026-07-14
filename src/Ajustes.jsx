import { useState } from 'react'
import { useAuth } from './AuthContext'
import AjustesFuncionalidades from './AjustesFuncionalidades'
import AjustesPermisos from './AjustesPermisos'

export default function Ajustes({ readOnly }) {
  const { isSuperAdmin } = useAuth()
  const [tab, setTab] = useState('funcionalidades')

  const tabClass = active =>
    `text-sm font-medium px-4 py-2 border-b-2 transition-colors ${
      active ? 'border-accent-200 text-accent-200' : 'border-transparent text-text-200 hover:text-text-100'
    }`

  return (
    <div>
      <div className="flex items-center gap-2 mb-6 border-b border-bg-300">
        <button onClick={() => setTab('funcionalidades')} className={tabClass(tab === 'funcionalidades')}>
          Funcionalidades
        </button>
        {isSuperAdmin && (
          <button onClick={() => setTab('permisos')} className={tabClass(tab === 'permisos')}>
            Permisos
          </button>
        )}
      </div>

      {tab === 'funcionalidades' && <AjustesFuncionalidades readOnly={readOnly} />}
      {tab === 'permisos' && isSuperAdmin && <AjustesPermisos />}
    </div>
  )
}
