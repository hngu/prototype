import { AppShell, Box, Center, Group, Stack, Text, Title } from '@mantine/core'
import { useElementSize } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { clampRect, type PageGeometry, type Point } from '../pdf/coords.ts'
import { loadPdf, PdfLoadError, type LoadedPdf } from '../pdf/document.ts'
import { annotatedFileName, buildAnnotatedPdf, downloadPdf } from '../pdf/exportPdf.ts'
import { textSize } from '../pdf/measure.ts'
import { resizeFromTopLeft } from '../pdf/textLayout.ts'
import type { SignatureImage } from '../pdf/rasterize.ts'
import { useAnnotations } from '../state/annotationsStore.ts'
import { saveSignature } from '../state/savedSignature.ts'
import {
  DEFAULT_FONT_SIZE,
  DEFAULT_SIGNATURE_WIDTH,
  newId,
  type Tool,
} from '../state/types.ts'
import { PageView } from './PageView.tsx'
import { PdfDropzone } from './PdfDropzone.tsx'
import { SignatureModal } from './SignatureModal.tsx'
import { Toolbar, type TextStyle } from './Toolbar.tsx'

/** Breathing room around the page column, in CSS pixels. */
const GUTTER = 32

const DEFAULT_TEXT_STYLE: TextStyle = {
  font: 'Helvetica',
  fontSize: DEFAULT_FONT_SIZE,
  color: '#111827',
}

export function Annotator() {
  const { annotations, selectedId, select, add, setRect, setText, remove, reset, undo, redo } =
    useAnnotations()

  const [pdf, setPdf] = useState<LoadedPdf | null>(null)
  const [opening, setOpening] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [tool, setTool] = useState<Tool>('select')
  const [signatureOpen, setSignatureOpen] = useState(false)
  const [pendingSignature, setPendingSignature] = useState<SignatureImage | null>(null)
  const [textStyle, setTextStyle] = useState<TextStyle>(DEFAULT_TEXT_STYLE)
  const [zoom, setZoom] = useState(1)
  const [fitWidth, setFitWidth] = useState(true)

  const { ref: viewportRef, width: viewportWidth } = useElementSize()

  const selected = annotations.find((annotation) => annotation.id === selectedId) ?? null

  /**
   * Every page is drawn at the same factor so a document mixing portrait and
   * landscape pages stays visually consistent; fit-width sizes it off the widest
   * page rather than each page in turn.
   */
  const factor = useMemo(() => {
    if (!pdf || !fitWidth) return zoom
    const widest = pdf.pages.reduce((max, page) => Math.max(max, page.viewWidth), 1)
    const available = viewportWidth - GUTTER * 2
    return available > 0 ? available / widest : 1
  }, [pdf, fitWidth, zoom, viewportWidth])

  const openFile = useCallback(
    async (file: File) => {
      setOpening(true)
      try {
        const loaded = await loadPdf(file)
        setPdf((previous) => {
          void previous?.task.destroy()
          return loaded
        })
        reset()
        setTool('select')
        setPendingSignature(null)
      } catch (error) {
        notifications.show({
          color: 'red',
          title: 'Could not open that PDF',
          message:
            error instanceof PdfLoadError
              ? error.message
              : 'Something went wrong while reading the file.',
        })
      } finally {
        setOpening(false)
      }
    },
    [reset],
  )

  const placeAnnotation = (point: Point, geometry: PageGeometry) => {
    if (tool === 'text') {
      const size = textSize([''], textStyle.font, textStyle.fontSize)
      add({
        id: newId(),
        kind: 'text',
        pageIndex: geometry.pageIndex,
        // The click marks the top-left of the box, where the first line starts.
        rect: clampRect(
          { x: point.x, y: point.y - size.height, width: size.width, height: size.height },
          geometry,
        ),
        lines: [''],
        ...textStyle,
      })
      setTool('select')
      return
    }

    if (tool === 'signature' && pendingSignature) {
      const width = Math.min(DEFAULT_SIGNATURE_WIDTH, geometry.viewWidth * 0.6)
      const height = width / pendingSignature.aspect
      add({
        id: newId(),
        kind: 'signature',
        pageIndex: geometry.pageIndex,
        rect: clampRect(
          { x: point.x - width / 2, y: point.y - height / 2, width, height },
          geometry,
        ),
        dataUrl: pendingSignature.dataUrl,
        aspect: pendingSignature.aspect,
      })
      setPendingSignature(null)
      setTool('select')
      return
    }

    select(null)
  }

  /**
   * The style controls double as defaults for the next text box and as an editor
   * for the selected one, so a change applies to both.
   */
  const changeTextStyle = (patch: Partial<TextStyle>) => {
    const next = { ...textStyle, ...patch }
    setTextStyle(next)

    if (!selected || selected.kind !== 'text' || !pdf) return
    const geometry = pdf.pages[selected.pageIndex]
    if (!geometry) return

    const size = textSize(selected.lines, next.font, next.fontSize)
    setText(selected.id, next)
    setRect(selected.id, clampRect(resizeFromTopLeft(selected.rect, size.width, size.height), geometry))
  }

  const confirmSignature = (image: SignatureImage) => {
    saveSignature(image)
    setPendingSignature(image)
    setSignatureOpen(false)
    setTool('signature')
    notifications.show({
      color: 'blue',
      title: 'Signature ready',
      message: 'Click on the page where it should go.',
    })
  }

  const handleExport = async () => {
    if (!pdf) return

    setExporting(true)
    try {
      const bytes = await buildAnnotatedPdf({
        bytes: pdf.bytes,
        pages: pdf.pages,
        annotations,
      })
      downloadPdf(bytes, annotatedFileName(pdf.name))
      notifications.show({
        color: 'teal',
        title: 'Exported',
        message: `Saved as ${annotatedFileName(pdf.name)}`,
      })
    } catch (error) {
      notifications.show({
        color: 'red',
        title: 'Export failed',
        message: error instanceof Error ? error.message : 'The PDF could not be written.',
      })
    } finally {
      setExporting(false)
    }
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.closest('input, textarea, [contenteditable="true"]')) return

      const meta = event.metaKey || event.ctrlKey

      if (meta && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        if (event.shiftKey) redo()
        else undo()
        return
      }

      if ((event.key === 'Delete' || event.key === 'Backspace') && selectedId) {
        event.preventDefault()
        remove(selectedId)
        return
      }

      if (event.key === 'Escape') {
        select(null)
        setPendingSignature(null)
        setTool('select')
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [redo, remove, select, selectedId, undo])

  useEffect(() => {
    if (annotations.length === 0) return

    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [annotations.length])

  if (!pdf) {
    return (
      <Center h="100vh" p="lg" bg="var(--mantine-color-gray-1)">
        <Stack align="center" gap="lg" w="100%">
          <Stack align="center" gap={4}>
            <Title order={1} size="h2">
              PDF Annotator
            </Title>
            <Text c="dimmed" size="sm" ta="center">
              Add text and signatures to a PDF, then download the result.
            </Text>
          </Stack>
          <PdfDropzone onFile={(file) => void openFile(file)} loading={opening} />
        </Stack>
      </Center>
    )
  }

  return (
    <>
      <AppShell header={{ height: 60 }} padding={0}>
        <AppShell.Header>
          <Toolbar
            fileName={pdf.name}
            pageCount={pdf.pages.length}
            tool={tool}
            onToolChange={(next) => {
              setTool(next)
              if (next !== 'signature') setPendingSignature(null)
            }}
            onAddSignature={() => setSignatureOpen(true)}
            textStyle={selected?.kind === 'text' ? selected : textStyle}
            onTextStyleChange={changeTextStyle}
            zoom={zoom}
            fitWidth={fitWidth}
            onZoomChange={(next) => {
              setFitWidth(false)
              setZoom(next)
            }}
            onFitWidth={() => setFitWidth(true)}
            onOpenFile={(file) => void openFile(file)}
            onExport={() => void handleExport()}
            exporting={exporting}
          />
        </AppShell.Header>

        <AppShell.Main>
          <Box
            ref={viewportRef}
            style={{
              height: 'calc(100vh - 60px)',
              overflow: 'auto',
              background: 'var(--mantine-color-gray-2)',
            }}
          >
            <Stack align="center" gap={GUTTER} py={GUTTER} px={GUTTER}>
              {pdf.pages.map((geometry) => (
                <Group key={geometry.pageIndex} gap="xs" align="flex-start" wrap="nowrap">
                  <PageView
                    doc={pdf.doc}
                    geometry={geometry}
                    cssWidth={Math.max(120, Math.round(geometry.viewWidth * factor))}
                    tool={tool}
                    onSurfaceClick={placeAnnotation}
                  />
                </Group>
              ))}
            </Stack>
          </Box>
        </AppShell.Main>
      </AppShell>

      <SignatureModal
        opened={signatureOpen}
        onClose={() => setSignatureOpen(false)}
        onConfirm={confirmSignature}
      />
    </>
  )
}
