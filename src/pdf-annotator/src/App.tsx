import '@mantine/core/styles.css'
import '@mantine/dropzone/styles.css'
import '@mantine/notifications/styles.css'

import { MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import { Annotator } from './components/Annotator.tsx'
import { AnnotationsProvider } from './state/AnnotationsProvider.tsx'

export default function App() {
  return (
    <MantineProvider defaultColorScheme="light">
      <Notifications position="top-right" limit={3} />
      <AnnotationsProvider>
        <Annotator />
      </AnnotationsProvider>
    </MantineProvider>
  )
}
