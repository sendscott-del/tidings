import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Stake from './pages/Stake'
import Lists from './pages/Lists'
import Compose from './pages/Compose'
import Inbox from './pages/Inbox'
import Community from './pages/Community'
import History from './pages/History'
import Admin from './pages/Admin'

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
            <Route path="stake" element={<Stake />} />
            <Route path="community" element={<Community />} />
            <Route path="lists" element={<Lists />} />
            <Route path="compose" element={<Compose />} />
            <Route path="inbox" element={<Inbox />} />
            <Route path="history" element={<History />} />
            <Route path="admin" element={<Admin />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
