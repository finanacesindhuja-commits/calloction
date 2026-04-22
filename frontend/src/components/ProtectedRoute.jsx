import React from 'react';
import { Navigate } from 'react-router-dom';

const ProtectedRoute = ({ children }) => {
  const staffId = localStorage.getItem('staffId');
  
  if (!staffId) {
    // If no staffId is found in localStorage, redirect to login
    return <Navigate to="/login" replace />;
  }

  return children;
};

export default ProtectedRoute;
