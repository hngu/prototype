"""Source adapters, one module per source."""

from jobinsights.sources import greenhouse
from jobinsights.sources.base import BoardAdapter

BOARD_ADAPTERS: dict[str, BoardAdapter] = {greenhouse.NAME: greenhouse}
