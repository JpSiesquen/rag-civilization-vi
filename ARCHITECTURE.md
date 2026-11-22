# Civilization VI RAG architecture

The first version answers Civilization VI gameplay questions using the Civilopedia as its primary source. It retrieves relevant entries and gives Claude the evidence needed to answer with references.

## Selected stack

| Area | Tools |
| --- | --- |
| Knowledge source | Civilization VI Civilopedia |
| Web frontend | React, TypeScript, and Vite, deployed on Vercel |
| Backend API | TypeScript on Cloudflare Workers |
| Production database and retrieval | Cloudflare D1 with SQLite FTS5 |
| Answer generation | Claude Messages API, called by the Worker using fetch |
| Data import | Node.js and TypeScript for the import script, with Wrangler to load data into D1 |
| Development and version control | npm, Wrangler, Git, and GitHub |

The Claude model will be selected during implementation.

## Civilopedia indexing

A separate import script prepares the Civilopedia entries and loads them into Cloudflare D1. Each entry retains its title, section, language, ruleset, and source reference. The first corpus targets Gathering Storm in Spanish. D1 uses SQLite FTS5 to search entry titles and text. [D1 support for FTS5](https://developers.cloudflare.com/d1/sql-api/sql-statements/)

## Question and answer flow

1. The web chat hosted on Vercel sends the question to the API running on Cloudflare Workers.
2. The Worker searches D1 for relevant entries from the selected ruleset.
3. The Worker sends the question and the relevant excerpts to the Claude API. The API key is stored as a Worker secret. [Workers secrets](https://developers.cloudflare.com/workers/configuration/secrets/)
4. The response cites the Civilopedia entries it used. If the available entries do not support an answer, the app says so.

## Local development

Wrangler runs the Worker and a separate D1 database locally for development. The deployed Worker uses its production D1 binding to query the database hosted by Cloudflare. [Local development with D1](https://developers.cloudflare.com/d1/best-practices/local-development/)

## Demo deployment

Vercel hosts the web frontend. Cloudflare Workers runs the API, and Cloudflare D1 stores and searches the Civilopedia entries. The Worker can use a workers.dev subdomain. [Vercel deployments](https://vercel.com/docs/deployments)

The demo can use the Cloudflare Free plan for Workers and D1. The free tier includes up to 100,000 Worker requests per day, 5 million D1 rows read per day, 100,000 D1 rows written per day, and 500 MB per database. Cloudflare rejects affected requests or queries when their daily quota is exhausted. [Workers limits](https://developers.cloudflare.com/workers/platform/limits/) · [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/) · [D1 limits](https://developers.cloudflare.com/d1/platform/limits/) · [workers.dev routing](https://developers.cloudflare.com/workers/configuration/routing/workers-dev/)
