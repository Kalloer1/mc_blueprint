export const useFetchUserGet = (nameOrId: number | string) =>
  useFetch<Profile, ErrorResponse>(`/api/users/${nameOrId}`);
