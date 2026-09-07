# Togetherly v1.11 — Live Location + Automatic Timezone

## Live location
- Together → Location opens the couple map.
- Each person controls their own `Share my location` toggle.
- Location remains enabled until that person turns it off.
- Participant colours identify the map markers.
- The map shows current/last shared positions, stale-update age and distance apart.
- Across the Distance gets a compact Location row only while at least one person is sharing.
- The server never exposes coordinates for an account whose sharing toggle is off.

## Update behaviour
- Expo Go / normal foreground testing: position updates while Togetherly is running, approximately every 15 seconds or 25 metres when the OS provides an update.
- Development/standalone iOS build: the project is configured for background location. Enabling sharing requests the appropriate background permission and starts the Togetherly background location task when permission is granted.
- Stale locations are labelled by update age rather than presented as permanently live.

## Timezone
- Profiles now have `Automatic` and `Manual` timezone modes.
- Automatic mode derives the IANA timezone from device coordinates using `tz-lookup`.
- Automatic timezone does not require permanent location sharing: saving profile/setup can perform a one-time location check.
- Manual mode uses a searchable timezone picker with standard IANA regions and UTC-offset labels; there is no free-text timezone field.

## Privacy
- Sharing is opt-in per user and cannot be enabled by the partner.
- Turning sharing off immediately makes that user's coordinates unavailable through the couple location endpoint.
- Togetherly stores the latest location rather than building a movement-history table.


## v1.11 hardening

Automatic timezone now refreshes opportunistically when Togetherly returns to the foreground (when location permission is already granted), even if live sharing is off. The background location task also restores the persisted authenticated session before sending a location update.
