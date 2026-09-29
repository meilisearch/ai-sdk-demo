export const TWICPICS_DOMAIN =
  process.env.NEXT_PUBLIC_TWICPICS_DOMAIN ?? "https://meilisearch.twic.pics";

export const MOVIE_POSTER_ASPECT_RATIO = "150/225";

export const CATEGORY_BACKDROP_ASPECT_RATIO = "16/9";

export const getTwicpicsUrl = (provider: "tmdb", url: string) => {
  return url.replace("https://image.tmdb.org/", `/${provider}/`);
};
