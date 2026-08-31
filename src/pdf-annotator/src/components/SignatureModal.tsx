import {
  Alert,
  Button,
  FileButton,
  Group,
  Image,
  Modal,
  SegmentedControl,
  Stack,
  Switch,
  Tabs,
  Text,
  TextInput,
} from '@mantine/core'
import { useEffect, useState } from 'react'
import {
  imageFileToPng,
  loadSignatureFont,
  PAD_SIZE,
  SIGNATURE_FONT,
  strokesToPng,
  typedSignatureToPng,
  type SignatureImage,
  type Stroke,
} from '../pdf/rasterize.ts'
import { loadSavedSignature } from '../state/savedSignature.ts'
import { DrawPad } from './DrawPad.tsx'

type Mode = 'draw' | 'type' | 'upload'

const INKS = [
  { value: '#111827', label: 'Black' },
  { value: '#1c4ed8', label: 'Blue' },
]

export function SignatureModal({
  opened,
  onClose,
  onConfirm,
}: {
  opened: boolean
  onClose: () => void
  onConfirm: (image: SignatureImage) => void
}) {
  const [mode, setMode] = useState<Mode>('draw')
  const [ink, setInk] = useState(INKS[0]?.value ?? '#111827')
  const [strokes, setStrokes] = useState<Stroke[]>([])
  const [typed, setTyped] = useState('')
  const [upload, setUpload] = useState<SignatureImage | null>(null)
  const [removeBackground, setRemoveBackground] = useState(true)
  const [uploadName, setUploadName] = useState<string | null>(null)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const saved = opened ? loadSavedSignature() : null

  useEffect(() => {
    if (opened) void loadSignatureFont('Signature')
  }, [opened])

  // Re-run the background removal when the toggle flips rather than making the
  // user pick the file again.
  useEffect(() => {
    if (!uploadFile) return

    let stale = false
    setBusy(true)
    imageFileToPng(uploadFile, { removeBackground })
      .then((image) => {
        if (!stale) setUpload(image)
      })
      .catch((cause: unknown) => {
        if (!stale) setError(cause instanceof Error ? cause.message : 'That image could not be read.')
      })
      .finally(() => {
        if (!stale) setBusy(false)
      })

    return () => {
      stale = true
    }
  }, [uploadFile, removeBackground])

  const reset = () => {
    setStrokes([])
    setTyped('')
    setUpload(null)
    setUploadFile(null)
    setUploadName(null)
    setError(null)
  }

  const close = () => {
    reset()
    onClose()
  }

  const accept = (image: SignatureImage | null, emptyMessage: string) => {
    if (!image) {
      setError(emptyMessage)
      return
    }
    reset()
    onConfirm(image)
  }

  const confirm = async () => {
    setError(null)
    setBusy(true)
    try {
      if (mode === 'draw') {
        accept(strokesToPng(strokes, PAD_SIZE, ink), 'Draw a signature first.')
      } else if (mode === 'type') {
        accept(await typedSignatureToPng(typed, ink), 'Type your name first.')
      } else {
        accept(upload, 'Choose an image first.')
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The signature could not be prepared.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal opened={opened} onClose={close} title="Add a signature" size="lg" centered>
      <Stack gap="md">
        {saved && (
          <Group justify="space-between" wrap="nowrap">
            <Group gap="sm" wrap="nowrap">
              <Image src={saved.dataUrl} alt="Saved signature" h={40} w="auto" fit="contain" />
              <Text size="sm" c="dimmed">
                Last signature used
              </Text>
            </Group>
            <Button variant="light" size="xs" onClick={() => accept(saved, '')}>
              Reuse
            </Button>
          </Group>
        )}

        <Tabs value={mode} onChange={(value) => setMode((value ?? 'draw') as Mode)}>
          <Tabs.List>
            <Tabs.Tab value="draw">Draw</Tabs.Tab>
            <Tabs.Tab value="type">Type</Tabs.Tab>
            <Tabs.Tab value="upload">Upload</Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="draw" pt="md">
            <Stack gap="sm">
              <DrawPad strokes={strokes} onStrokesChange={setStrokes} color={ink} />
              <Group gap="xs">
                <Button
                  variant="default"
                  size="xs"
                  disabled={strokes.length === 0}
                  onClick={() => setStrokes(strokes.slice(0, -1))}
                >
                  Undo stroke
                </Button>
                <Button
                  variant="default"
                  size="xs"
                  disabled={strokes.length === 0}
                  onClick={() => setStrokes([])}
                >
                  Clear
                </Button>
              </Group>
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="type" pt="md">
            <Stack gap="sm">
              <TextInput
                label="Your name"
                placeholder="Ada Lovelace"
                value={typed}
                onChange={(event) => setTyped(event.currentTarget.value)}
                autoFocus
              />
              <div
                style={{
                  minHeight: 96,
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0 16px',
                  borderRadius: 'var(--mantine-radius-md)',
                  border: '1px dashed var(--mantine-color-gray-4)',
                  background: 'var(--mantine-color-gray-0)',
                  overflow: 'hidden',
                }}
              >
                <span
                  style={{
                    fontFamily: `"${SIGNATURE_FONT}", cursive`,
                    fontSize: 56,
                    lineHeight: 1.4,
                    color: ink,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {typed || 'Preview'}
                </span>
              </div>
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="upload" pt="md">
            <Stack gap="sm">
              <Group>
                <FileButton
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(file) => {
                    setError(null)
                    setUploadFile(file)
                    setUploadName(file?.name ?? null)
                    if (!file) setUpload(null)
                  }}
                >
                  {(props) => (
                    <Button variant="default" {...props}>
                      Choose image
                    </Button>
                  )}
                </FileButton>
                <Text size="sm" c="dimmed">
                  {uploadName ?? 'PNG, JPEG or WebP'}
                </Text>
              </Group>

              <Switch
                label="Drop the paper background"
                description="Reads ink from how dark each pixel is, so a photo of a signature keeps only the pen strokes."
                checked={removeBackground}
                onChange={(event) => setRemoveBackground(event.currentTarget.checked)}
              />

              {upload && (
                <Image
                  src={upload.dataUrl}
                  alt="Uploaded signature"
                  h={96}
                  w="auto"
                  fit="contain"
                  style={{ background: 'var(--mantine-color-gray-0)' }}
                />
              )}
            </Stack>
          </Tabs.Panel>
        </Tabs>

        {error && (
          <Alert color="red" variant="light">
            {error}
          </Alert>
        )}

        <Group justify="space-between">
          <SegmentedControl size="xs" data={INKS} value={ink} onChange={setInk} />
          <Group gap="xs">
            <Button variant="default" onClick={close}>
              Cancel
            </Button>
            <Button loading={busy} onClick={() => void confirm()}>
              Place signature
            </Button>
          </Group>
        </Group>
      </Stack>
    </Modal>
  )
}
