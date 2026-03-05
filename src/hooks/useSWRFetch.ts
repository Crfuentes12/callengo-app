import useSWR, { SWRConfiguration } from 'swr';

const defaultFetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const error = new Error('An error occurred while fetching data.');
    throw error;
  }
  return res.json();
};

export function useAPI<T = unknown>(
  url: string | null,
  config?: SWRConfiguration
) {
  const { data, error, isLoading, isValidating, mutate } = useSWR<T>(
    url,
    defaultFetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 10000,
      ...config,
    }
  );

  return {
    data,
    error,
    isLoading,
    isValidating,
    mutate,
  };
}
