"use client";

export type MovieCardHit = {
  id?: string | number;
  title: string;
  year?: string;
  posterPath?: string;
};

function MovieCard({ movie }: { movie: MovieCardHit }) {
  const key = movie.id ?? movie.title;

  return (
    <article
      key={key}
      className="flex min-w-0 flex-col gap-1"
      aria-label={movie.title}
    >
      {movie.posterPath ? (
        // eslint-disable-next-line @next/next/no-img-element -- streamed chat cards should render raw TMDB poster URLs.
        <img
          src={movie.posterPath}
          alt={movie.title}
          loading="lazy"
          decoding="async"
          className="bg-muted aspect-[2/3] w-full rounded-md object-cover"
        />
      ) : (
        <div className="bg-muted text-muted-foreground aspect-[2/3] w-full rounded-md px-2 text-center text-xs font-medium leading-tight">
          <div className="flex h-full items-center justify-center">No poster</div>
        </div>
      )}

      <p className="text-foreground truncate text-xs font-medium">{movie.title}</p>
      {movie.year ? (
        <p className="text-muted-foreground text-[0.7rem] tabular-nums">{movie.year}</p>
      ) : null}
    </article>
  );
}

export function MovieGrid({ movies }: { movies: MovieCardHit[] }) {
  if (movies.length === 0) return null;

  return (
    <ol className="mt-1 grid w-full grid-cols-3 gap-2">
      {movies.map((movie, index) => (
        <li key={movie.id ?? `${movie.title}-${index}`} className="min-w-0">
          <MovieCard movie={movie} />
        </li>
      ))}
    </ol>
  );
}
