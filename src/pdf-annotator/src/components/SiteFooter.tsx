import { Anchor, Box, Container, Group, Text } from '@mantine/core'
import { SITE_TITLE } from '../seo/site.ts'

export function SiteFooter() {
  return (
    <Box component="footer" py="lg" mt="xl" style={{ borderTop: '1px solid var(--mantine-color-gray-3)' }}>
      <Container size={720}>
        <Group justify="space-between" gap="sm">
          <Anchor href="/" c="dimmed" size="sm" underline="never">
            {SITE_TITLE}
          </Anchor>
          <Anchor href="/privacy" c="dimmed" size="sm">
            Privacy
          </Anchor>
        </Group>
        <Text c="dimmed" size="xs" mt="xs">
          The PDF never leaves this tab.
        </Text>
      </Container>
    </Box>
  )
}
