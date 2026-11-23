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
| Backend API | TypeScript on Cloudflare Workers |
| Production database and retrieval | Cloudflare D1 with SQLite FTS5 |
| Answer generation | Claude Messages API, called by the Worker using fetch |
| Data import | Node.js and TypeScript for the import script, with Wrangler to load data into D1 |
| Development and version control | npm, Wrangler, Git, and GitHub |

The Claude model will be selected during implementation.

## Civilopedia indexing

The import script draws from an installed Steam copy of Civilization VI and from Civilopedia.net. The game files supply localized text and structured gameplay data. The web source supplies entries and links that can be checked against the same game version. The downloaded and extracted corpus is kept as a local working copy for import.

The initial inventory found Spanish source records for the base game and both expansions in the game files, along with separate files for optional modes, leader packs, and scenarios. Civilopedia.net has Spanish examples for the base game, both expansions, and some optional modes. Its scenario coverage remains to be verified. [Civ VI Anthology content](https://store.steampowered.com/bundle/21432/Sid_Meiers_Civilization_VI_Anthology/) · [Base game districts](https://www.civilopedia.net/es/standard-rules/concepts/cities_10/) · [Rise and Fall Campus](https://www.civilopedia.net/es/rise-and-fall/districts/district_campus/) · [Gathering Storm Apocalypse mode](https://www.civilopedia.net/es/gathering-storm/concepts/megadisasters/)

The importer combines matching records into one entry per language and applicable game version, mode, or scenario. Each entry retains its title, section, applicability, and source references. When both sources disagree on the same entry and version, review the discrepancy before importing the disputed data. Cloudflare D1 uses SQLite FTS5 to search entry titles and text. [D1 support for FTS5](https://developers.cloudflare.com/d1/sql-api/sql-statements/)

## Question and answer flow

1. The chat sends the question, the selected game version, and relevant conversation context to the Worker.
2. The Worker searches D1 for entries that apply to the selected version. Context from the conversation helps interpret follow-up questions.
3. The Worker sends the question and the relevant excerpts to the Claude API. The API key is stored as a Worker secret. [Workers secrets](https://developers.cloudflare.com/workers/configuration/secrets/)
4. The response cites the Civilopedia entries it uses, with verified web links where available. If the question is ambiguous, the assistant asks for clarification. If the available entries still do not support an answer for the selected version, the assistant says it could not confirm the answer.

## Development workflow

The project follows acceptance test-driven development (ATDD). GitHub Issues track research, setup, implementation, and deployment. Give each issue a concrete completion check. For changes to application behavior, define the expected behavior with an example and write the acceptance test before implementing it. Run the test to confirm it fails for the expected reason, implement the change, and commit when the test passes.

For the first retrieval issue, load a small sample of Spanish Gathering Storm entries. When a player asks about Campus adjacency, the search must return the relevant Campus entry with its Civilopedia reference. Verify retrieval independently, then use a separate acceptance test for the Claude integration to check that the response cites the retrieved evidence.

## Local development

Wrangler runs the Worker and a separate D1 database locally for development. The deployed Worker uses its production D1 binding to query the database hosted by Cloudflare. [Local development with D1](https://developers.cloudflare.com/d1/best-practices/local-development/)

## Demo deployment

The first demo runs locally. After local validation, the demo is deployed for public access without sign-in. Vercel hosts the web frontend. Cloudflare Workers runs the API, and Cloudflare D1 stores and searches the Civilopedia entries. The Worker can use a workers.dev subdomain. [Vercel deployments](https://vercel.com/docs/deployments)

The demo can use the Cloudflare Free plan for Workers and D1. The free tier includes up to 100,000 Worker requests per day, 5 million D1 rows read per day, 100,000 D1 rows written per day, and 500 MB per database. Cloudflare rejects affected requests or queries when their daily quota is exhausted. [Workers limits](https://developers.cloudflare.com/workers/platform/limits/) · [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/) · [D1 limits](https://developers.cloudflare.com/d1/platform/limits/) · [workers.dev routing](https://developers.cloudflare.com/workers/configuration/routing/workers-dev/)
