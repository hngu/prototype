import { Group, Stack, Text, Title } from '@mantine/core'
import { Dropzone, PDF_MIME_TYPE } from '@mantine/dropzone'

/** 200 MB, well past anything a browser can comfortably rasterize. */
const MAX_SIZE = 200 * 1024 * 1024

export function PdfDropzone({
  onFile,
  loading,
}: {
  onFile: (file: File) => void
  loading: boolean
}) {
  return (
    <Dropzone
      onDrop={(files) => {
        const [file] = files
        if (file) onFile(file)
      }}
      accept={PDF_MIME_TYPE}
      maxFiles={1}
      maxSize={MAX_SIZE}
      loading={loading}
      radius="md"
      p="xl"
      style={{ maxWidth: 620, width: '100%' }}
    >
      <Stack align="center" gap="xs" mih={180} justify="center">
        <Title order={3}>Drop a PDF here</Title>
        <Group gap={6}>
          <Text c="dimmed" size="sm">
            or click to choose a file
          </Text>
        </Group>
        <Text c="dimmed" size="xs" ta="center" maw={420} mt="sm">
          The file is opened and rewritten inside this tab. Nothing is uploaded anywhere.
        </Text>
      </Stack>
    </Dropzone>
  )
}
