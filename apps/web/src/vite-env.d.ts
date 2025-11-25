interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_USE_MOCK_SEARCH: string;
  readonly VITE_COGNITO_USER_POOL_ID: string;
  readonly VITE_AWS_REGION: string;
  readonly VITE_COGNITO_APP_CLIENT_ID: string;
  readonly VITE_COGNITO_DOMAIN: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
