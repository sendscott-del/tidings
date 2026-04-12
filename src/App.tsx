import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'

// Placeholder pages — will be built in later phases
function Placeholder({ title }: { title: string }) {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900 mb-4">{title}</h1>
      <p className="text-slate-500">Coming soon.</p>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="stake" element={<Placeholder title="Stake Directory" />} />
            <Route path="community" element={<Placeholder title="Community Database" />} />
            <Route path="lists" element={<Placeholder title="Lists" />} />
            <Route path="compose" element={<Placeholder title="Compose Message" />} />
            <Route path="inbox" element={<Placeholder title="Inbox" />} />
            <Route path="history" element={<Placeholder title="Message History" />} />
            <Route path="admin" element={<Placeholder title="Admin" />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
