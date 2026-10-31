"""Source adapters, one module per source."""

from jobinsights.sources import ashby, greenhouse, lever
from jobinsights.sources.base import BoardAdapter

BOARD_ADAPTERS: dict[str, BoardAdapter] = {
    adapter.NAME: adapter for adapter in (greenhouse, lever, ashby)
}
