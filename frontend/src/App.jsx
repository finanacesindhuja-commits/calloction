import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './page/Login';
import Dashboard from './page/Dashboard';
import Collections from './page/Collections';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        
        <Route 
          path="/dashboard" 
          element={
            <ProtectedRoute>
              <Layout><Dashboard /></Layout>
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/collections" 
          element={
            <ProtectedRoute>
              <Layout><Collections /></Layout>
            </ProtectedRoute>
          } 
        />
        
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

