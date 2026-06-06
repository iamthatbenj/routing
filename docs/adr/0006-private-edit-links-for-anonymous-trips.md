# Use private edit links for anonymous Trip editing

Trips will support anonymous multi-session editing through long, unguessable private edit links, with separate read-only share links for viewers. This avoids account, password, and SSO complexity while still letting travelers return to planning work across sessions and devices, at the cost of treating edit links as sensitive secrets that must not be exposed in analytics or logs and may need regeneration/revocation support later.
