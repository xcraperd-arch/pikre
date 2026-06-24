
revoke execute on function public.match_twin_documents(uuid, vector, int) from public, anon, authenticated;
grant execute on function public.match_twin_documents(uuid, vector, int) to service_role;
