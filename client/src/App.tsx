import { Toaster } from 'react-hot-toast';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary';
import ProtectedRoute from './components/ProtectedRoute';
import { AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import Home from './pages/Home';
import Login from './pages/Login';
import NotFound from './pages/NotFound';
import RoomRoute from './pages/Room';
import Signup from './pages/Signup';

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <SocketProvider>
            <Toaster
              position="top-center"
              toastOptions={{
                duration: 3500,
                style: {
                  background: '#1f1f1f',
                  color: '#ffffff',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                },
              }}
            />
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route element={<ProtectedRoute />}>
                <Route index element={<Home />} />
                <Route path="room/:roomId" element={<RoomRoute />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </SocketProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
