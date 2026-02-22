"""DataUpdateCoordinator for HaushaltsApp."""

from __future__ import annotations

from datetime import timedelta
import logging

import aiohttp

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator, UpdateFailed

from .const import CONF_TOKEN, CONF_URL, DEFAULT_SCAN_INTERVAL, DOMAIN

_LOGGER = logging.getLogger(__name__)


class HaushaltsAppCoordinator(DataUpdateCoordinator):
    """Fetch data from HaushaltsApp API."""

    def __init__(self, hass: HomeAssistant, entry: ConfigEntry) -> None:
        """Initialize the coordinator."""
        self.url = entry.data[CONF_URL]
        self.token = entry.data[CONF_TOKEN]

        super().__init__(
            hass,
            _LOGGER,
            name=DOMAIN,
            update_interval=timedelta(seconds=DEFAULT_SCAN_INTERVAL),
        )

    async def _async_update_data(self) -> dict:
        """Fetch data from the API."""
        session = async_get_clientsession(self.hass)

        try:
            async with session.get(
                f"{self.url}/api/terminal/ha-dashboard",
                headers={"Authorization": f"Bearer {self.token}"},
                timeout=aiohttp.ClientTimeout(total=30),
            ) as resp:
                if resp.status == 403:
                    raise UpdateFailed("Authentifizierung fehlgeschlagen (403)")
                if resp.status != 200:
                    raise UpdateFailed(f"API Fehler: HTTP {resp.status}")
                return await resp.json()

        except (aiohttp.ClientError, TimeoutError) as err:
            raise UpdateFailed(f"Verbindungsfehler: {err}") from err
