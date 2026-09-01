import { Anchor, Container, Stack, Text, Title } from '@mantine/core'
import { ADS_ENABLED } from '../ads.ts'
import { advertisingParagraphs, PRIVACY_SECTIONS, SITE_TITLE } from '../seo/site.ts'
import { SiteFooter } from './SiteFooter.tsx'

export function PrivacyPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--mantine-color-gray-0)' }}>
      <header>
        <Container size={720} py="md">
          <Anchor href="/" underline="never" fw={700} size="sm" c="gray.8">
            {SITE_TITLE}
          </Anchor>
        </Container>
      </header>

      <main>
        <Container size={720} pb="xl">
          <Title order={1} mb="lg">
            Privacy
          </Title>
          <Stack gap="lg">
            {PRIVACY_SECTIONS.map((section) => (
              <section key={section.heading}>
                <Title order={2} mb="xs">
                  {section.heading}
                </Title>
                <Text>{section.body}</Text>
              </section>
            ))}
            <section>
              <Title order={2} mb="xs">
                Advertising
              </Title>
              <Stack gap="sm">
                {advertisingParagraphs(ADS_ENABLED).map((paragraph) => (
                  <Text key={paragraph}>{paragraph}</Text>
                ))}
              </Stack>
            </section>
          </Stack>
        </Container>
      </main>

      <SiteFooter />
    </div>
  )
}
