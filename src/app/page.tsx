import { MovieChat } from "@/components/movie-chat";
import { getTopGenres } from "@/lib/categories";

export default async function Page() {
  const categories = await getTopGenres();

  return <MovieChat categories={categories} />;
}
