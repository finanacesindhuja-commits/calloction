import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './page/Login';
import Dashboard from './page/Dashboard';
import Collections from './page/Collections';
import Foreclosure from './page/Foreclosure';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  return (
    <HashRouter>
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
        <Route 
          path="/foreclosure" 
          element={
            <ProtectedRoute>
              <Layout><Foreclosure /></Layout>
            </ProtectedRoute>
          } 
        />
        
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </HashRouter>
  );
}

export default App;

