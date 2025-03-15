import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router'
import Provider from './provider'
import './index.css'
import Layout from './components/layout.tsx'
import ShakeList from './pages/shakes/shake-list.tsx'
import Cook from './pages/shakes/cook.tsx'

createRoot(document.getElementById('root')!)
  .render(
    <StrictMode>
      <Provider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route path="/" element={<ShakeList />} />
              <Route path="/cook" element={<Cook />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </Provider>
    </StrictMode>,
  )
