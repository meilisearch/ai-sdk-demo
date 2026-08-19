<p align="center">
  <a href="https://www.meilisearch.com/?utm_campaign=ai-sdk-demo&utm_source=github&utm_medium=readme" target="_blank">
    <img src="https://github.com/meilisearch/meilisearch/blob/main/assets/logo.svg" alt="Meilisearch" width="200" height="200" />
  </a>
</p>

<h1 align="center">Meilisearch AI SDK demo</h1>

<h4 align="center">
  <a href="https://www.meilisearch.com/?utm_campaign=ai-sdk-demo&utm_source=github&utm_medium=readme">Website</a> |
  <a href="https://www.meilisearch.com/cloud?utm_campaign=ai-sdk-demo&utm_source=github&utm_medium=readme">Meilisearch Cloud</a> |
  <a href="https://www.meilisearch.com/blog?utm_campaign=ai-sdk-demo&utm_source=github&utm_medium=readme">Blog</a> |
  <a href="https://www.meilisearch.com/docs/?utm_campaign=ai-sdk-demo&utm_source=github&utm_medium=readme">Documentation</a> |
  <a href="https://dub.sh/meili-discord/?utm_campaign=ai-sdk-demo&utm_source=github&utm_medium=readme">Discord</a>
</h4>
<br/>

> Meilisearch is an open-source search engine for user-facing search and AI retrieval

## Features

This app uses [`@meilisearch/ai-sdk`](https://github.com/meilisearch/ai-sdk) with the [Vercel AI SDK](https://ai-sdk.dev/) to build a movie recommendation chatbot.

## Setup

### Dependencies

Install the dependencies with PNPM:

```bash
pnpm install
```

### Environment

Create an `.env` file and update it with your credentials.

```bash
# .env

OPENROUTER_API_KEY="use your OpenRouter API key here"
OPENROUTER_MODEL="openai/gpt-4o-mini"

# You can use the credentials below to use the public movies dataset
MEILISEARCH_HOST="https://ms-69223ce62f2d-106.lon.meilisearch.io"
MEILISEARCH_API_KEY="e29f206c5c55fb9a4d0763ccd981b7e76ea2f5ca6fb349275782efa3d19d1427"
MEILISEARCH_INDEX="movies-en-US"
```

### Running the app

Start the development server on http://localhost:3000

```bash
pnpm dev
```
