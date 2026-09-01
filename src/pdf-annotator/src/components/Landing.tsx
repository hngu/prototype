import {
  Accordion,
  Container,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from '@mantine/core'
import { PdfDropzone } from './PdfDropzone.tsx'
import { SiteFooter } from './SiteFooter.tsx'
import { FAQ_ITEMS, FEATURES, HOW_IT_WORKS, SITE_TITLE } from '../seo/site.ts'

export function Landing({
  onFile,
  loading,
}: {
  onFile: (file: File) => void
  loading: boolean
}) {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--mantine-color-gray-1)' }}>
      <header>
        <Container size={720} py="md">
          <Text fw={700} size="sm" component="p" m={0}>
            {SITE_TITLE}
          </Text>
        </Container>
      </header>

      <main>
        <Container size={720} pb="xl">
          <Stack gap="xl">
            <Stack align="center" gap="sm" pt="lg">
              <Title order={1} ta="center">
                {SITE_TITLE}
              </Title>
              <Text c="dimmed" ta="center" maw={520}>
                Draw, type, or upload a signature; add text; download. The file is never uploaded.
              </Text>
              <PdfDropzone onFile={onFile} loading={loading} />
            </Stack>

            <section>
              <Title order={2} mb="md">
                How it works
              </Title>
              <ol style={{ paddingLeft: '1.25rem', margin: 0 }}>
                {HOW_IT_WORKS.map((step) => (
                  <li key={step.title} style={{ marginBottom: '0.75rem' }}>
                    <Text span fw={600}>
                      {step.title}
                    </Text>
                    {' — '}
                    <Text span c="dimmed">
                      {step.body}
                    </Text>
                  </li>
                ))}
              </ol>
            </section>

            <section>
              <Title order={2} mb="md">
                What you can do
              </Title>
              <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
                {FEATURES.map((feature) => (
                  <Stack key={feature.title} gap={4}>
                    <Text fw={600}>{feature.title}</Text>
                    <Text size="sm" c="dimmed">
                      {feature.body}
                    </Text>
                  </Stack>
                ))}
              </SimpleGrid>
            </section>

            <section>
              <Title order={2} mb="md">
                Questions
              </Title>
              <Accordion variant="separated" radius="md">
                {FAQ_ITEMS.map((item) => (
                  <Accordion.Item key={item.question} value={item.question}>
                    <Accordion.Control>
                      <Text fw={600} span>
                        {item.question}
                      </Text>
                    </Accordion.Control>
                    <Accordion.Panel>
                      <Text size="sm">{item.answer}</Text>
                    </Accordion.Panel>
                  </Accordion.Item>
                ))}
              </Accordion>
            </section>
          </Stack>
        </Container>
      </main>

      <SiteFooter />
    </div>
  )
}
