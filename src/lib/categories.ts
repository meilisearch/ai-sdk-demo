import { connection } from "next/server";

import { getMeilisearch } from "@/lib/meilisearch";

const TOP_GENRES = 12;
const CANDIDATES_PER_GENRE = 5;
const TMDB_BACKDROP_PREFIX = "https://image.tmdb.org/t/p/w780";

export type CategoryCard = {
  name: string;
  backdropUrl?: string;
};

type MovieHit = {
  id?: unknown;
  backdrop_path?: unknown;
  title?: unknown;
};

function escapeFilterValue(value: string) {
  return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

function movieKey(hit: MovieHit) {
  if (typeof hit.id === "string" || typeof hit.id === "number") {
    return String(hit.id);
  }
  if (typeof hit.backdrop_path === "string" && hit.backdrop_path.length > 0) {
    return hit.backdrop_path;
  }
  return undefined;
}

function pickUnusedHit(hits: MovieHit[], used: Set<string>) {
  for (const hit of hits) {
    const key = movieKey(hit);
    if (!key || used.has(key)) continue;
    used.add(key);
    return hit;
  }
  return undefined;
}

function backdropUrl(path: unknown) {
  if (typeof path !== "string" || path.length === 0) return undefined;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${TMDB_BACKDROP_PREFIX}${path.startsWith("/") ? path : `/${path}`}`;
}

function genreQueries(indexUid: string, genres: string[]) {
  return genres.map((value) => ({
    indexUid,
    q: "",
    filter: `genres = "${escapeFilterValue(value)}"`,
    limit: CANDIDATES_PER_GENRE,
    attributesToRetrieve: ["id", "backdrop_path", "title"],
  }));
}

export async function getTopGenres(): Promise<CategoryCard[]> {
  try {
    await connection();
    const { client, indexUid } = getMeilisearch();
    const index = client.index(indexUid);

    const { facetHits } = await index.searchForFacetValues({
      facetName: "genres",
    });

    const top = [...facetHits]
      .sort((a, b) => b.count - a.count)
      .slice(0, TOP_GENRES)
      .map((hit) => hit.value);

    if (top.length === 0) return [];

    // Default ranking already surfaces popular titles; `sort` is not enabled
    // on this index (not listed in rankingRules).
    const { results } = await client.multiSearch({
      queries: genreQueries(indexUid, top),
    });

    const used = new Set<string>();

    return top.map((name, index) => {
      const hits = (results[index]?.hits ?? []) as MovieHit[];
      const hit = pickUnusedHit(hits, used);
      return {
        name,
        backdropUrl: backdropUrl(hit?.backdrop_path),
      };
    });
  } catch (error) {
    console.error("[categories] failed to load genres", error);
    return [];
  }
}
