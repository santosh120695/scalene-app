import { useQuery } from "@tanstack/react-query";
import { search } from "@/api/search";

export function useSearch(query: string) {
  const q = query.trim();
  return useQuery({
    queryKey: ["search", q],
    queryFn: () => search(q),
    enabled: q.length > 0,
  });
}
