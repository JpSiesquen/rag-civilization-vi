# Civilization VI RAG

A Spanish-language assistant for Civilization VI gameplay questions, grounded in the Civilopedia entries and gameplay data from a local Steam installation.

## Repository layout

| Path | Purpose |
| --- | --- |
| `frontend/` | React and TypeScript web app built with Vite. |
| `importer/` | TypeScript importer for Civilopedia entries from a private working copy of the Steam files. |
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

The build type-checks the frontend and writes the production output to `frontend/dist/`. The dev command prints the local URL.

### Verify the Steam sample

With the private Steam sample in `datos-locales/`, run these commands from the repository root in PowerShell.

```powershell
$env:CIVILOPEDIA_SNAPSHOT = (Resolve-Path datos-locales).Path
npm.cmd --prefix importer run check
npm.cmd --prefix importer test
npm.cmd --prefix importer --silent run sample
```

The sample prints JSON with the Campus entry for each game version and examples of how Steam declares a DLC, a mode, and a scenario. It reads the private copy and writes to standard output.

### Load the Steam sample into local SQL Server

With the schema applied and `CIVILOPEDIA_SNAPSHOT` set as above, run `npm.cmd --prefix importer run load:sample`. The loader uses the installed `sqlcmd` and Windows authentication to write to `CivilizationVI_Rag_Dev` on the local default instance. A second load of the same sample preserves existing entry, fragment, and source IDs.

Run `npm.cmd --prefix importer run test:load` to load the sample twice and verify the saved rows. The test writes to the local development database and leaves the sample available for search development.

### Verify local full-text retrieval

Add the **Full-Text and Semantic Extractions for Search** feature to the local SQL Server 2022 instance. With the sample loaded, run the migration and acceptance check from the repository root.

```powershell
sqlcmd -S lpc:. -E -N -C -b -d CivilizationVI_Rag_Dev -i database/002_civilopedia_full_text.sql
sqlcmd -S lpc:. -E -N -C -b -d CivilizationVI_Rag_Dev -i database/check_civilopedia_search.sql
```

Allow SQL Server to populate the indexes before running the check. `dbo.SearchCivilopedia` returns ranked Spanish fragments with their version, applicability and source references.

Apply the version filter migration and run its acceptance check with the sample loaded.

```powershell
sqlcmd -S lpc:. -E -N -C -b -d CivilizationVI_Rag_Dev -i database/003_civilopedia_search_version.sql
sqlcmd -S lpc:. -E -N -C -b -d CivilizationVI_Rag_Dev -i database/check_civilopedia_search_versions.sql
```

Pass `@GameVersion` to `dbo.SearchCivilopedia` using `RULESET_STANDARD`, `RULESET_EXPANSION_1` or `RULESET_EXPANSION_2`. The procedure filters fragments by version before limiting the results.

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

Keep credentials in local environment variables or untracked local configuration. Keep the private working copy and any extracts under `datos-locales/`. Git ignores that directory along with dependency directories, build outputs and the local npm cache.

See [ARCHITECTURE.md](ARCHITECTURE.md) for the RAG design and deployment targets.
