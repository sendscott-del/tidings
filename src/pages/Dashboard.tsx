import { useAuth } from '../contexts/AuthContext'

export default function Dashboard() {
  const { appUser } = useAuth()

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900 mb-6">Dashboard</h1>
      <p className="text-slate-600">
        Welcome{appUser?.full_name ? `, ${appUser.full_name}` : ''}. Tidings is being built — more features coming soon.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
        <DashCard label="Messages Sent" value="—" />
        <DashCard label="Unread Replies" value="—" />
        <DashCard label="Stake Contacts" value="—" />
        <DashCard label="Opted Out" value="—" />
      </div>
    </div>
  )
}

function DashCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="text-2xl font-semibold text-slate-900 mt-1">{value}</p>
    </div>
  )
}
