"""Config flow for HaushaltsApp integration."""

from __future__ import annotations

import aiohttp
import voluptuous as vol

from homeassistant.config_entries import ConfigFlow, ConfigFlowResult
from homeassistant.helpers.aiohttp_client import async_get_clientsession

from .const import CONF_TOKEN, CONF_URL, DOMAIN


class HaushaltsAppConfigFlow(ConfigFlow, domain=DOMAIN):
    """Handle a config flow for HaushaltsApp."""

    VERSION = 1

    async def async_step_user(
        self, user_input: dict[str, str] | None = None
    ) -> ConfigFlowResult:
        """Handle the initial step."""
        errors: dict[str, str] = {}

        if user_input is not None:
            url = user_input[CONF_URL].rstrip("/")
            token = user_input[CONF_TOKEN]

            try:
                session = async_get_clientsession(self.hass)
                async with session.get(
                    f"{url}/api/terminal/auth",
                    headers={"Authorization": f"Bearer {token}"},
                    timeout=aiohttp.ClientTimeout(total=10),
                ) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        household = data.get("household", {})
                        household_id = household.get("_id", "")
                        household_name = household.get("name", "HaushaltsApp")

                        await self.async_set_unique_id(household_id)
                        self._abort_if_unique_id_configured()

                        return self.async_create_entry(
                            title=household_name,
                            data={CONF_URL: url, CONF_TOKEN: token},
                        )

                    if resp.status == 403:
                        errors["base"] = "invalid_auth"
                    else:
                        errors["base"] = "cannot_connect"

            except (aiohttp.ClientError, TimeoutError):
                errors["base"] = "cannot_connect"

        return self.async_show_form(
            step_id="user",
            data_schema=vol.Schema(
                {
                    vol.Required(CONF_URL): str,
                    vol.Required(CONF_TOKEN): str,
                }
            ),
            errors=errors,
        )
