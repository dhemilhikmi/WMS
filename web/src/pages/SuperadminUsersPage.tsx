import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { usersAPI } from '../services/api'

interface SuperadminUser {
  id: string
  name: string
  email: string
  role: string
  createdAt: string
}

const inputCls = 'w-full rounded border border-[#cbd5e1] bg-white px-3 py-2 text-sm text-[#111] outline-none focus:border-[#1E4FD8] focus:ring-2 focus:ring-[#dbeafe] transition'
const labelCls = 'block text-[11px] font-semibold text-[#555] mb-1'

function Avatar({ name }: { name: string }) {
  const initials = name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
  const colors = ['#1E4FD8', '#7c3aed', '#0891b2', '#16a34a', '#db2777']
  const c = colors[name.charCodeAt(0) % colors.length]
  return (
    <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ background: c }}>
      {initials}
    </div>
  )
}

export default function SuperadminUsersPage() {
  const { user, tenant } = useAuth()
  const [users, setUsers] = useState<SuperadminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [showPass, setShowPass] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      const res = await usersAPI.list(tenant?.id || '')
      const all = res.data.data || []
      setUsers(all.filter((u: any) => u.role === 'superadmin'))
    } catch (err: any) {
      setError(err.response?.data?.message || 'Gagal memuat users')
    } finally { setLoading(false) }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!tenant?.id) return
    setSubmitting(true)
    try {
      await usersAPI.create({ ...form, role: 'superadmin', tenantId: tenant.id })
      setForm({ name: '', email: '', password: '' })
      setShowForm(false)
      fetchData()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Gagal membuat user')
    } finally { setSubmitting(false) }
  }

  const handleDelete = async (id: string) => {
    if (!tenant?.id) return
    try {
      await usersAPI.delete(id, tenant.id)
      setDeleteConfirm(null)
      fetchData()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Gagal menghapus user')
    }
  }

  return (
    <div className="p-6 space-y-5">

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-[#e2e8f0] p-4">
          <p className="text-[11px] text-[#888] font-medium">Total Superadmin</p>
          <p className="text-2xl font-bold text-[#111] mt-1">{users.length}</p>
          <p className="text-[11px] text-[#aaa] mt-0.5">akun platform aktif</p>
        </div>
        <div className="bg-white rounded-xl border border-[#e2e8f0] p-4">
          <p className="text-[11px] text-[#888] font-medium">Akun Aktif Sekarang</p>
          <p className="text-sm font-bold text-[#1E4FD8] mt-1 truncate">{user?.email || '—'}</p>
          <p className="text-[11px] text-[#aaa] mt-0.5">sesi saat ini</p>
        </div>
        <div className="bg-white rounded-xl border border-[#e2e8f0] p-4">
          <p className="text-[11px] text-[#888] font-medium">Akses Level</p>
          <p className="text-sm font-bold text-[#7c3aed] mt-1">Superadmin</p>
          <p className="text-[11px] text-[#aaa] mt-0.5">akses penuh platform</p>
        </div>
      </div>

      {error && <div className="bg-[#fee2e2] border border-[#fca5a5] text-[#b91c1c] text-sm px-4 py-3 rounded-xl">{error}</div>}

      {/* Toolbar */}
      <div className="flex justify-end">
        <button onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 bg-[#1E4FD8] hover:bg-[#1A45BF] text-white text-sm font-semibold px-4 py-2 rounded-lg transition">
          {showForm ? '✕ Tutup' : '+ Tambah Superadmin'}
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-[#f8fafc] rounded-xl border border-[#e2e8f0] p-5">
          <h3 className="text-sm font-bold text-[#111] mb-4">Tambah Akun Superadmin</h3>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className={labelCls}>Nama *</label>
                <input type="text" className={inputCls} placeholder="Nama lengkap" required
                  value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className={labelCls}>Email *</label>
                <input type="email" className={inputCls} placeholder="email@platform.com" required
                  value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div>
                <label className={labelCls}>Password *</label>
                <div className="relative">
                  <input type={showPass ? 'text' : 'password'} className={inputCls + ' pr-20'} placeholder="Min. 8 karakter" required
                    value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
                  <button type="button" onClick={() => setShowPass(p => !p)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-[#888] hover:text-[#555]">
                    {showPass ? 'Sembunyikan' : 'Tampilkan'}
                  </button>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={submitting}
                className="text-sm px-4 py-2 rounded-lg bg-[#1E4FD8] text-white hover:bg-[#1A45BF] font-semibold transition disabled:opacity-40">
                {submitting ? 'Menyimpan...' : 'Tambah User'}
              </button>
              <button type="button" onClick={() => setShowForm(false)}
                className="text-sm px-4 py-2 rounded-lg bg-[#f1f5f9] text-[#555] hover:bg-[#e2e8f0] transition">
                Batal
              </button>
            </div>
          </form>
        </div>
      )}

      {/* User Table */}
      <div className="bg-white rounded-xl border border-[#e2e8f0] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#f8fafc] text-[#555] text-[11px] font-semibold uppercase tracking-wide border-b border-[#e2e8f0]">
                <th className="px-4 py-3 text-left">User</th>
                <th className="px-4 py-3 text-left">Email</th>
                <th className="px-4 py-3 text-center">Role</th>
                <th className="px-4 py-3 text-center">Dibuat</th>
                <th className="px-4 py-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={5} className="text-center py-10 text-[#aaa]">Memuat data...</td></tr>}
              {!loading && users.length === 0 && (
                <tr><td colSpan={5} className="text-center py-10 text-[#aaa]">Belum ada superadmin selain akun Anda.</td></tr>
              )}
              {users.map(u => {
                const isMe = u.email === user?.email
                return (
                  <tr key={u.id} className="border-b border-[#f1f5f9] hover:bg-[#f8fafc] transition">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={u.name} />
                        <div>
                          <p className="font-semibold text-[#111]">{u.name}</p>
                          {isMe && <span className="text-[10px] bg-[#dbeafe] text-[#1A45BF] px-2 py-0.5 rounded-full font-semibold">Anda</span>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[#555]">{u.email}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-[#ede9fe] text-[#6d28d9]">Superadmin</span>
                    </td>
                    <td className="px-4 py-3 text-center text-[#888] text-xs">
                      {new Date(u.createdAt).toLocaleDateString('id-ID')}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {isMe ? (
                        <span className="text-[11px] text-[#aaa]">Akun aktif</span>
                      ) : (
                        <button onClick={() => setDeleteConfirm(u.id)}
                          className="text-xs px-2.5 py-1 rounded border border-[#fca5a5] text-[#dc2626] hover:bg-[#fef2f2] transition">
                          Hapus
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete Confirm */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <h3 className="font-bold text-[#111]">Hapus Superadmin?</h3>
            <p className="text-sm text-[#666]">Akun akan dihapus permanen dari platform.</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDeleteConfirm(null)} className="text-sm px-4 py-2 rounded-lg bg-[#f1f5f9] text-[#555]">Batal</button>
              <button onClick={() => handleDelete(deleteConfirm)} className="text-sm px-4 py-2 rounded-lg bg-[#dc2626] text-white font-semibold">Hapus</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
