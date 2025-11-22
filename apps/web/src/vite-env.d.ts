interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_USE_MOCK_SEARCH: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
