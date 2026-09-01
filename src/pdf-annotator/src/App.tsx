import '@mantine/core/styles.css'
import '@mantine/dropzone/styles.css'
import '@mantine/notifications/styles.css'

import { lazy, Suspense, useCallback, useState } from 'react'
import { Center, Loader, MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import { Landing } from './components/Landing.tsx'
import { AnnotationsProvider } from './state/AnnotationsProvider.tsx'

const Annotator = lazy(async () => {
  const mod = await import('./components/Annotator.tsx')
  return { default: mod.Annotator }
})

export default function App() {
  const [file, setFile] = useState<File | null>(null)
  const onOpenFailed = useCallback(() => setFile(null), [])

  return (
    <MantineProvider defaultColorScheme="light">
      <Notifications position="top-right" limit={3} />
      {file ? (
        <AnnotationsProvider>
          <Suspense
            fallback={
              <Center h="100vh">
                <Loader />
              </Center>
            }
          >
            <Annotator file={file} onFile={setFile} onOpenFailed={onOpenFailed} />
          </Suspense>
        </AnnotationsProvider>
      ) : (
        <Landing onFile={setFile} loading={false} />
      )}
    </MantineProvider>
  )
}
