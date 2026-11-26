# Civilization VI RAG

A Spanish-language assistant for Civilization VI gameplay questions, grounded in the Civilopedia entries and gameplay data from a local Steam installation.

## Repository layout

| Path | Purpose |
| --- | --- |
| `frontend/` | React and TypeScript web app built with Vite. |
| `importer/` | Node.js and TypeScript configuration for importing Civilopedia entries from a private working copy of the Steam files. |
| `api/` | ASP.NET Core API for retrieval and answer generation. |
| `database/` | SQL Server schema migrations. |

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

### Run the API

```sh
dotnet run --project api/CivilizationVI.Rag.Api.csproj
```

Open [the health endpoint](http://127.0.0.1:5080/health) or run `curl -i http://127.0.0.1:5080/health` from another terminal. The endpoint returns HTTP `200 OK` and `Healthy` when the API is running.

In Visual Studio, open `api/CivilizationVI.Rag.Api.csproj` and press **F5** to run with the debugger. The launch profile uses the same local address.

### Set up the development database

Create an empty `CivilizationVI_Rag_Dev` database on your local SQL Server instance. In SSMS, open [`database/001_initial_schema.sql`](database/001_initial_schema.sql), select that database in the editor toolbar, and execute the migration once. It creates the tables for Civilopedia entries, searchable fragments, and source references.

On Windows, set the connection string in the PowerShell session before starting the API. The example uses Windows authentication and trusts the server certificate for the local instance.

```powershell
$env:ConnectionStrings__Civilopedia = 'Server=lpc:.;Database=CivilizationVI_Rag_Dev;Integrated Security=True;Encrypt=True;TrustServerCertificate=True'
dotnet run --project api/CivilizationVI.Rag.Api.csproj
```

In the Development environment, open [the database health endpoint](http://127.0.0.1:5080/health/database). It returns HTTP `200 OK` and `Healthy` when the API can query the entries table, including when the table is empty. It returns HTTP `503 Service Unavailable` and `Unhealthy` if the connection is missing or the query fails.

Keep credentials in local environment variables or untracked local configuration. Keep the private working copy and extracted corpus outside the tracked source tree. The repository ignores dependency directories, build outputs and the local npm cache.

See [ARCHITECTURE.md](ARCHITECTURE.md) for the RAG design and deployment targets.
