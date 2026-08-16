# RCC shared workspace service

This zero-dependency reference service implements RCC's shared-workspace API. Run it on a user-controlled host behind an HTTPS reverse proxy:

```powershell
$env:RCC_WORKSPACE_TOKEN = "generate-a-long-random-token"
$env:RCC_WORKSPACE_DATA = "C:\rcc-workspaces"
$env:PORT = "8080"
node server.mjs
```

Configure the public HTTPS base URL and the same bearer token in RCC. The service validates workspace IDs, limits requests to 2 MiB, uses constant-time token comparison, and writes through a temporary file. Production operators remain responsible for TLS, backups, firewalling, log retention, and process supervision.
