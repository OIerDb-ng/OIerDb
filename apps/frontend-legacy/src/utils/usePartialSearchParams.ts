import { useSearchParams } from 'react-router-dom';

export default function usePartialSearchParams() {
  const [searchParams, _setSearchParams] = useSearchParams();

  const setSearchParams = (newParams: Record<string, string>) => {
    const params = new URLSearchParams(searchParams);
    const _newParams = new URLSearchParams(newParams);

    for (const [key, value] of _newParams) {
      params.set(key, value);
    }

    _setSearchParams(params);
  };

  return [searchParams, setSearchParams] as const;
}
