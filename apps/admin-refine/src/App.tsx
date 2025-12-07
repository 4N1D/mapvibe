import { Refine, Authenticated } from '@refinedev/core';
import { RefineKbar, RefineKbarProvider } from '@refinedev/kbar';
import {
  ErrorComponent,
  ThemedLayoutV2,
  ThemedTitleV2,
  useNotificationProvider,
} from '@refinedev/antd';
import routerBindings, {
  CatchAllNavigate,
  UnsavedChangesNotifier,
  DocumentTitleHandler,
} from '@refinedev/react-router-v6';
import { BrowserRouter, Routes, Route, Outlet } from 'react-router-dom';
import { App as AntdApp, ConfigProvider } from 'antd';
import {
  DashboardOutlined,
  EnvironmentOutlined,
} from '@ant-design/icons';

import { authProvider } from './providers/authProvider';
import { dataProvider } from './providers/dataProvider';
import { configureAmplify } from './amplify-config';

// Pages
import { DashboardPage } from './pages/dashboard';
import { 
  LocationsPendingList, 
  LocationsDetailPage 
} from './pages/locations';
import { LoginPage } from './pages/login';
import { AuthCallbackPage } from './pages/login/auth-callback';

import '@refinedev/antd/dist/reset.css';

// Configure Amplify
configureAmplify();

// Theme
const theme = {
  token: {
    colorPrimary: '#3b82f6',
    borderRadius: 8,
  },
};

function App() {
  return (
    <BrowserRouter>
      <RefineKbarProvider>
        <ConfigProvider theme={theme}>
          <AntdApp>
            <Refine
              dataProvider={dataProvider}
              authProvider={authProvider}
              routerProvider={routerBindings}
              notificationProvider={useNotificationProvider}
              resources={[
                {
                  name: 'dashboard',
                  list: '/',
                  meta: {
                    label: 'Dashboard',
                    icon: <DashboardOutlined />,
                  },
                },
                {
                  name: 'locations',
                  list: '/locations/pending',
                  show: '/locations/:id',
                  meta: {
                    label: 'Pending Locations',
                    icon: <EnvironmentOutlined />,
                  },
                },
              ]}
              options={{
                syncWithLocation: true,
                warnWhenUnsavedChanges: true,
                projectId: 'mapvibe-admin',
              }}
            >
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/auth/callback" element={<AuthCallbackPage />} />
                
                <Route
                  element={
                    <Authenticated
                      key="authenticated-layout"
                      fallback={<CatchAllNavigate to="/login" />}
                    >
                      <ThemedLayoutV2
                        Title={({ collapsed }) => (
                          <ThemedTitleV2
                            collapsed={collapsed}
                            text="MapVibe Admin"
                          />
                        )}
                      >
                        <Outlet />
                      </ThemedLayoutV2>
                    </Authenticated>
                  }
                >
                  <Route index element={<DashboardPage />} />
                  
                  {/* Locations - Main Feature */}
                  <Route path="/locations/pending" element={<LocationsPendingList />} />
                  <Route path="/locations/:id" element={<LocationsDetailPage />} />
                  
                  <Route path="*" element={<ErrorComponent />} />
                </Route>
              </Routes>

              <RefineKbar />
              <UnsavedChangesNotifier />
              <DocumentTitleHandler />
            </Refine>
          </AntdApp>
        </ConfigProvider>
      </RefineKbarProvider>
    </BrowserRouter>
  );
}

export default App;
