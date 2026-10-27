import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { useApp } from './store'

// Tell the server which UI language to use for labels it builds (open status, price age, tips…)
const nativeFetch = window.fetch.bind(window)
window.fetch = (input, init = {}) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  if (url.startsWith('/api/') || url.startsWith(location.origin + '/api/')) {
    const headers = new Headers(init.headers)
    headers.set('x-lang', useApp.getState().lang ?? 'fa')
    init = { ...init, headers }
  }
  return nativeFetch(input, init)
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
