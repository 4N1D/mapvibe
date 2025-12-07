import { Button, Card, Typography } from 'antd';
import { GoogleOutlined } from '@ant-design/icons';
import { useLogin } from '@refinedev/core';

const { Title, Text } = Typography;

export const LoginPage = () => {
  const { mutate: login } = useLogin();

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      }}
    >
      <Card style={{ width: 400, textAlign: 'center' }}>
        <Title level={2}>MapVibe Admin</Title>
        <Text type="secondary">Sign in to continue</Text>
        
        <Button
          type="primary"
          icon={<GoogleOutlined />}
          size="large"
          block
          style={{ marginTop: 24 }}
          onClick={() => login({})}
        >
          Sign in with Google
        </Button>
      </Card>
    </div>
  );
};
