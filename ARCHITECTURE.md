# Civilization VI RAG architecture

The first version answers Civilization VI gameplay questions using the Civilopedia as its primary source. It retrieves relevant entries and gives Claude the evidence needed to answer with references.

## Product scope

The first release covers the base game, Rise and Fall, Gathering Storm, and official add-on content, including leader packs, optional modes, and scenarios. The initial corpus and answers are in Spanish. English support is deferred.

The assistant answers general questions about Civilization VI. The chat uses the current conversation for follow-up questions. The **Versión del juego** selector requires a choice on the first visit and remembers the last choice in the browser. If the player changes the version during a conversation, the chat keeps the context and indicates that subsequent answers use the newly selected version.

## Selected stack

| Area | Tools |
| --- | --- |
| Knowledge sources | Civilization VI game files and Civilopedia.net |
| Web frontend | React, TypeScript, and Vite, deployed on Vercel |
| Backend API | C# and ASP.NET Core, deployed on Azure App Service |
| Local database | SQL Server 2022 |
| Production database | Azure SQL Database |
| Retrieval | SQL Server Full-Text Search |
| Answer generation | Claude Messages API, called from the ASP.NET Core backend |
| Data import | Node.js and TypeScript import script targeting SQL Server locally and Azure SQL Database in production |
| Development and version control | .NET SDK, Visual Studio, SSMS, npm, Git, and GitHub |

The target .NET version and Claude model will be selected during implementation.

## Civilopedia indexing

The import script draws from an installed Steam copy of Civilization VI and from Civilopedia.net. The game files supply localized text and structured gameplay data. The web source supplies entries and links that can be checked against the same game version. The downloaded and extracted corpus is kept as a local working copy for import.

The initial inventory found Spanish source records for the base game and both expansions in the game files, along with separate files for optional modes, leader packs, and scenarios. Civilopedia.net has Spanish examples for the base game, both expansions, and some optional modes. Its scenario coverage remains to be verified. [Civ VI Anthology content](https://store.steampowered.com/bundle/21432/Sid_Meiers_Civilization_VI_Anthology/) · [Base game districts](https://www.civilopedia.net/es/standard-rules/concepts/cities_10/) · [Rise and Fall Campus](https://www.civilopedia.net/es/rise-and-fall/districts/district_campus/) · [Gathering Storm Apocalypse mode](https://www.civilopedia.net/es/gathering-storm/concepts/megadisasters/)

The importer combines matching records into one entry per language and applicable game version, mode, or scenario. Each entry retains its title, section, applicability, and source references. When both sources disagree on the same entry and version, review the discrepancy before importing the disputed data. SQL Server Full-Text Search indexes the Spanish titles and text. The API filters retrieval by the selected game version and applicable content. [Full-Text Search](https://learn.microsoft.com/en-us/sql/relational-databases/search/full-text-search)

## Question and answer flow

1. The chat sends the question, the selected game version, and relevant conversation context to the ASP.NET Core API.
2. The API queries the full-text index for entries that apply to the selected version. Context from the conversation helps interpret follow-up questions.
3. The API sends the question and the relevant excerpts to the Claude Messages API. The backend holds the API key and database connection settings.
4. The response cites the Civilopedia entries it uses, with verified web links where available. If the question is ambiguous, the assistant asks for clarification. If the available entries still do not support an answer for the selected version, the assistant says it could not confirm the answer.

## Development workflow

The project follows acceptance test-driven development (ATDD). GitHub Issues track research, setup, implementation, and deployment. Give each issue a concrete completion check. For changes to application behavior, define the expected behavior with an example and write the acceptance test before implementing it. Run the test to confirm it fails for the expected reason, implement the change, and commit when the test passes.

For the first retrieval issue, load a small sample of Spanish Gathering Storm entries. When a player asks about Campus adjacency, the search must return the relevant Campus entry with its Civilopedia reference. Verify retrieval independently, then use a separate acceptance test for the Claude integration to check that the response cites the retrieved evidence.

## Local development

Run the ASP.NET Core API against a development database on the local SQL Server 2022 instance. Verify that SQL Server's optional Full-Text Search component is available before applying the full-text index. Apply the database schema and import the Civilopedia corpus using T-SQL compatible with SQL Server and Azure SQL Database. Use SSMS to inspect the local database and its indexes. [SQL Server Full-Text Search](https://learn.microsoft.com/en-us/sql/relational-databases/search/full-text-search)

## Demo deployment

Validate the demo locally first. The public demo runs without sign-in, with the frontend on Vercel and the ASP.NET Core API on Azure App Service. The deployed API queries Azure SQL Database using its backend configuration. [Vercel deployments](https://vercel.com/docs/deployments) · [Deploy ASP.NET Core to Azure App Service](https://learn.microsoft.com/en-us/azure/app-service/quickstart-dotnetcore)

The demo targets Azure App Service Free (F1), which includes 60 CPU minutes per day, and the Azure SQL Database free tier, which includes 100,000 vCore seconds per month and up to 32 GB of data storage per database. Configure Azure SQL Database to pause until the following month when the free allowance is exhausted. Claude API usage is billed separately. [App Service pricing](https://azure.microsoft.com/en-us/pricing/details/app-service/linux/) · [Azure SQL Database free tier](https://learn.microsoft.com/en-us/azure/azure-sql/database/free-tier?view=azuresql)
