import { Box, Text } from '@mantine/core'
import { ADS_ENABLED } from '../ads.ts'

export function AdSlot({ placement }: { placement: 'top' | 'bottom' }) {
  if (!ADS_ENABLED) return null

  return (
    <Box
      component="aside"
      aria-label="Advertisement"
      data-ad-placement={placement}
      px="sm"
      pt={6}
      pb={10}
      bg="gray.1"
      style={{
        flexShrink: 0,
        borderBottom: placement === 'top' ? '1px solid var(--mantine-color-gray-3)' : undefined,
        borderTop: placement === 'bottom' ? '1px solid var(--mantine-color-gray-3)' : undefined,
      }}
    >
      <Text
        size="xs"
        tt="uppercase"
        c="dimmed"
        mb={4}
        style={{ fontSize: 10, letterSpacing: '0.08em' }}
      >
        Advertisement
      </Text>
      {/* Replace this frame with the network embed (Media.net display unit).
          Keep the wrapper: it reserves height so the creative cannot shift layout. */}
      <Box
        data-ad-slot={placement}
        mih={{ base: 50, sm: 90 }}
        maw={728}
        mx="auto"
        style={{
          border: '1px dashed var(--mantine-color-gray-4)',
          borderRadius: 6,
          background: 'var(--mantine-color-gray-0)',
        }}
      />
    </Box>
  )
}
