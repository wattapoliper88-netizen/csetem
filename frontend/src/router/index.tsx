import React from 'react';
import { Route, Routes, Navigate } from 'react-router-dom';
import { RegisterPage } from '../pages/Register';
import { VerifyCodePage } from '../pages/VerifyCode';
import { LoginPage } from '../pages/Login';
import { ForgotPasswordPage } from '../pages/ForgotPassword';
import { ChatPage } from '../pages/Chat';

const AppRouter: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/chat" element={<ChatPage />} />
    </Routes>
  );
};

export default AppRouter;
