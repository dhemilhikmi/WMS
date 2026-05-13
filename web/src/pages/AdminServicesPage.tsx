import { useAuth } from '../context/AuthContext'
import ServicesManagement from '../components/ServicesManagement'

export default function AdminServicesPage() {
  const { tenant } = useAuth()

  if (!tenant?.id) {
    return (
      <div className="rounded-[28px] border border-slate-200 bg-white p-8 text-center shadow-sm">
        <p className="text-sm font-medium text-slate-500">Menyiapkan workspace layanan...</p>
      </div>
    )
  }

  return (
    <ServicesManagement tenantId={tenant.id} />
  )
}
