import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const normalizeBasePath = (value = '/') => {
  const trimmedValue = String(value || '/').trim();

  if (!trimmedValue || trimmedValue === '/') {
    return '/';
  }

  return `/${trimmedValue.replace(/^\/+|\/+$/g, '')}/`;
};

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    base: normalizeBasePath(env.VITE_PUBLIC_BASE_PATH),
    plugins: [react()]
  };
});
