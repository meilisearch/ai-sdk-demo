import { Meilisearch } from "meilisearch";

export function getMeilisearch() {
  const host = process.env.MEILISEARCH_HOST;
  const indexUid = process.env.MEILISEARCH_INDEX;

  if (!host || !indexUid) {
    throw new Error("Missing MEILISEARCH_HOST or MEILISEARCH_INDEX");
  }

  return {
    client: new Meilisearch({
      host,
      apiKey: process.env.MEILISEARCH_SEARCH_API_KEY,
    }),
    indexUid,
  };
}
