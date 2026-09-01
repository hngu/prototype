import '@mantine/core/styles.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MantineProvider } from '@mantine/core'
import './index.css'
import { PrivacyPage } from './components/PrivacyPage.tsx'

const root = document.getElementById('root')
if (!root) throw new Error('Missing #root element')

createRoot(root).render(
  <StrictMode>
    <MantineProvider defaultColorScheme="light">
      <PrivacyPage />
    </MantineProvider>
  </StrictMode>,
)
