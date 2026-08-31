import {
  ActionIcon,
  Button,
  ColorInput,
  Divider,
  FileButton,
  Group,
  NumberInput,
  SegmentedControl,
  Select,
  Text,
  Tooltip,
} from '@mantine/core'
import { useAnnotations } from '../state/annotationsStore.ts'
import { FONTS, type FontKey, type Tool } from '../state/types.ts'

export type TextStyle = { font: FontKey; fontSize: number; color: string }

const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2]

export function Toolbar({
  fileName,
  pageCount,
  tool,
  onToolChange,
  onAddSignature,
  textStyle,
  onTextStyleChange,
  zoom,
  fitWidth,
  onZoomChange,
  onFitWidth,
  onOpenFile,
  onExport,
  exporting,
}: {
  fileName: string
  pageCount: number
  tool: Tool
  onToolChange: (tool: Tool) => void
  onAddSignature: () => void
  textStyle: TextStyle
  onTextStyleChange: (patch: Partial<TextStyle>) => void
  zoom: number
  fitWidth: boolean
  onZoomChange: (zoom: number) => void
  onFitWidth: () => void
  onOpenFile: (file: File) => void
  onExport: () => void
  exporting: boolean
}) {
  const { canUndo, canRedo, undo, redo, annotations } = useAnnotations()

  return (
    <Group gap="sm" wrap="wrap" px="md" py="xs" align="center">
      <Text fw={600} size="sm" maw={220} truncate>
        {fileName}
      </Text>
      <Text size="xs" c="dimmed">
        {pageCount} {pageCount === 1 ? 'page' : 'pages'} · {annotations.length}{' '}
        {annotations.length === 1 ? 'annotation' : 'annotations'}
      </Text>

      <Divider orientation="vertical" />

      <SegmentedControl
        size="xs"
        value={tool === 'signature' ? 'select' : tool}
        onChange={(value) => onToolChange(value as Tool)}
        data={[
          { value: 'select', label: 'Select' },
          { value: 'text', label: 'Add text' },
        ]}
      />
      <Button size="xs" variant="light" onClick={onAddSignature}>
        Add signature
      </Button>

      <Divider orientation="vertical" />

      <Select
        size="xs"
        w={128}
        aria-label="Font"
        data={FONTS.map((font) => ({ value: font, label: font.replace('-Roman', '') }))}
        value={textStyle.font}
        allowDeselect={false}
        onChange={(value) => value && onTextStyleChange({ font: value as FontKey })}
      />
      <NumberInput
        size="xs"
        w={78}
        aria-label="Font size"
        min={6}
        max={96}
        step={1}
        clampBehavior="strict"
        suffix="pt"
        value={textStyle.fontSize}
        onChange={(value) => {
          const size = typeof value === 'number' ? value : Number.parseFloat(String(value))
          if (Number.isFinite(size) && size > 0) onTextStyleChange({ fontSize: size })
        }}
      />
      <ColorInput
        size="xs"
        w={132}
        aria-label="Text colour"
        format="hex"
        withEyeDropper={false}
        swatches={['#111827', '#1c4ed8', '#b91c1c', '#047857']}
        value={textStyle.color}
        onChange={(value) => onTextStyleChange({ color: value })}
      />

      <Divider orientation="vertical" />

      <Group gap={4}>
        <Tooltip label="Undo" openDelay={400}>
          <ActionIcon
            variant="default"
            size="md"
            disabled={!canUndo}
            onClick={undo}
            aria-label="Undo"
          >
            <span aria-hidden>↶</span>
          </ActionIcon>
        </Tooltip>
        <Tooltip label="Redo" openDelay={400}>
          <ActionIcon
            variant="default"
            size="md"
            disabled={!canRedo}
            onClick={redo}
            aria-label="Redo"
          >
            <span aria-hidden>↷</span>
          </ActionIcon>
        </Tooltip>
      </Group>

      <Group gap={4}>
        <Button
          size="xs"
          variant={fitWidth ? 'filled' : 'default'}
          onClick={onFitWidth}
          aria-label="Fit page width"
        >
          Fit
        </Button>
        <Select
          size="xs"
          w={92}
          aria-label="Zoom"
          allowDeselect={false}
          data={ZOOM_STEPS.map((step) => ({
            value: String(step),
            label: `${Math.round(step * 100)}%`,
          }))}
          value={fitWidth ? null : String(zoom)}
          placeholder="Zoom"
          onChange={(value) => value && onZoomChange(Number.parseFloat(value))}
        />
      </Group>

      <Group gap="xs" ml="auto">
        <FileButton accept="application/pdf" onChange={(file) => file && onOpenFile(file)}>
          {(props) => (
            <Button size="xs" variant="default" {...props}>
              Open another
            </Button>
          )}
        </FileButton>
        <Button size="xs" loading={exporting} onClick={onExport}>
          Export PDF
        </Button>
      </Group>
    </Group>
  )
}
