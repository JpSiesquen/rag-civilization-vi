# Civilization VI RAG

A Spanish-language assistant for Civilization VI gameplay questions, grounded in Civilopedia entries and structured game data.

## Repository layout

| Path | Purpose |
| --- | --- |
| `frontend/` | React and TypeScript web app built with Vite. |
| `importer/` | Node.js and TypeScript configuration for importing Civilopedia entries. |
| `api/` (planned) | ASP.NET Core API for retrieval and answer generation. |
| `database/` (planned) | SQL Server schema migrations. |

## Local development

Use Node.js 24, npm 11 and the .NET 11 SDK. Run these commands from the repository root. In Windows PowerShell, use `npm.cmd` if PowerShell blocks the `npm.ps1` shim.

```sh
dotnet --list-sdks
node --version
npm --version
npm --prefix frontend ci --cache .npm-cache
npm --prefix importer ci --cache .npm-cache
npm --prefix frontend --cache .npm-cache run build
npm --prefix frontend --cache .npm-cache run dev
```

The build type-checks the frontend and writes the production output to `frontend/dist/`. The dev command prints the local URL. The importer configuration is ready for TypeScript source as it is added.

Keep credentials in local environment variables or untracked local configuration and keep the extracted corpus outside the tracked source tree. The repository ignores dependency directories, build outputs and the local npm cache.

See [ARCHITECTURE.md](ARCHITECTURE.md) for the RAG design and deployment targets.
