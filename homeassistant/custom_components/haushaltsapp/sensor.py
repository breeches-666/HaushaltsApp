"""Sensor platform for HaushaltsApp."""

from __future__ import annotations

from homeassistant.components.sensor import SensorEntity, SensorStateClass
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.device_registry import DeviceEntryType
from homeassistant.helpers.entity import DeviceInfo
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import (
    ATTR_DUE_TODAY,
    ATTR_LAST_UPDATED,
    ATTR_MEMBERS,
    ATTR_NO_DEADLINE,
    ATTR_OVERDUE,
    ATTR_SUMMARY,
    ATTR_TASKS,
    DOMAIN,
)
from .coordinator import HaushaltsAppCoordinator


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up HaushaltsApp sensors from a config entry."""
    coordinator: HaushaltsAppCoordinator = hass.data[DOMAIN][entry.entry_id]

    async_add_entities(
        [
            HaushaltsAppTotalSensor(coordinator, entry),
            HaushaltsAppOverdueSensor(coordinator, entry),
            HaushaltsAppTodaySensor(coordinator, entry),
        ]
    )


class HaushaltsAppBaseSensor(CoordinatorEntity[HaushaltsAppCoordinator], SensorEntity):
    """Base sensor for HaushaltsApp."""

    _attr_state_class = SensorStateClass.MEASUREMENT
    _attr_has_entity_name = True

    def __init__(
        self,
        coordinator: HaushaltsAppCoordinator,
        entry: ConfigEntry,
        key: str,
    ) -> None:
        """Initialize the sensor."""
        super().__init__(coordinator)
        household_name = entry.title
        self._attr_unique_id = f"{entry.entry_id}_{key}"
        self._attr_device_info = DeviceInfo(
            identifiers={(DOMAIN, entry.entry_id)},
            name="HaushaltsApp",
            manufacturer="HaushaltsApp",
            model=household_name,
            entry_type=DeviceEntryType.SERVICE,
        )


class HaushaltsAppTotalSensor(HaushaltsAppBaseSensor):
    """Sensor for total open tasks."""

    _attr_translation_key = "open_tasks"
    _attr_icon = "mdi:clipboard-list"
    _attr_native_unit_of_measurement = "Aufgaben"

    def __init__(self, coordinator: HaushaltsAppCoordinator, entry: ConfigEntry) -> None:
        """Initialize the sensor."""
        super().__init__(coordinator, entry, "open_tasks")

    @property
    def native_value(self) -> int | None:
        """Return the total number of open tasks."""
        if self.coordinator.data is None:
            return None
        return self.coordinator.data.get("summary", {}).get("totalOpen", 0)

    @property
    def extra_state_attributes(self) -> dict:
        """Return all task data as attributes."""
        if self.coordinator.data is None:
            return {}
        data = self.coordinator.data
        return {
            ATTR_SUMMARY: data.get("summary"),
            ATTR_MEMBERS: data.get("members"),
            ATTR_TASKS: data.get("tasks"),
            ATTR_LAST_UPDATED: data.get("lastUpdated"),
        }


class HaushaltsAppOverdueSensor(HaushaltsAppBaseSensor):
    """Sensor for overdue tasks."""

    _attr_translation_key = "overdue_tasks"
    _attr_icon = "mdi:alert-circle"
    _attr_native_unit_of_measurement = "Aufgaben"

    def __init__(self, coordinator: HaushaltsAppCoordinator, entry: ConfigEntry) -> None:
        """Initialize the sensor."""
        super().__init__(coordinator, entry, "overdue_tasks")

    @property
    def native_value(self) -> int | None:
        """Return the number of overdue tasks."""
        if self.coordinator.data is None:
            return None
        return self.coordinator.data.get("summary", {}).get("overdueCount", 0)

    @property
    def extra_state_attributes(self) -> dict:
        """Return overdue task list as attributes."""
        if self.coordinator.data is None:
            return {}
        return {
            ATTR_OVERDUE: self.coordinator.data.get("tasks", {}).get("overdue", []),
            ATTR_LAST_UPDATED: self.coordinator.data.get("lastUpdated"),
        }


class HaushaltsAppTodaySensor(HaushaltsAppBaseSensor):
    """Sensor for tasks due today."""

    _attr_translation_key = "today_tasks"
    _attr_icon = "mdi:calendar-today"
    _attr_native_unit_of_measurement = "Aufgaben"

    def __init__(self, coordinator: HaushaltsAppCoordinator, entry: ConfigEntry) -> None:
        """Initialize the sensor."""
        super().__init__(coordinator, entry, "today_tasks")

    @property
    def native_value(self) -> int | None:
        """Return the number of tasks due today."""
        if self.coordinator.data is None:
            return None
        return self.coordinator.data.get("summary", {}).get("dueTodayCount", 0)

    @property
    def extra_state_attributes(self) -> dict:
        """Return today's task list as attributes."""
        if self.coordinator.data is None:
            return {}
        return {
            ATTR_DUE_TODAY: self.coordinator.data.get("tasks", {}).get("due_today", []),
            ATTR_LAST_UPDATED: self.coordinator.data.get("lastUpdated"),
        }
