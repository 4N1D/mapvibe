import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Spin } from 'antd';

export const AuthCallbackPage = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Wait for Cognito to process OAuth callback
    setTimeout(() => {
      navigate('/');
    }, 1000);
  }, [navigate]);

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
      <Spin size="large" tip="Signing in..." />
    </div>
  );
};
