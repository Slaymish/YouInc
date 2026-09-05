# Self-hosting

The current setup, backup/restore instructions and access model are maintained
in the [README](../README.md). YouInc is a single Node application backed by one
local SQLite file; it has no Supabase or Docker dependency.

Run the app on your computer, or keep it bound to loopback on your own server and
connect through an SSH tunnel. Personal mode has no web account system and must
not be published on the internet. `YOUINC_DEMO=1` disables personal data access
for the public portfolio demo.

The older documents under `docs/superpowers/` record past designs and are not
current installation instructions.
