-- Imagens de produtos e atualizacao em tempo real entre ADMIN e PDV.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "product images: equipe envia"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images' and public.is_staff());

create policy "product images: admin altera"
  on storage.objects for update to authenticated
  using (bucket_id = 'product-images' and public.is_admin())
  with check (bucket_id = 'product-images' and public.is_admin());

create policy "product images: admin remove"
  on storage.objects for delete to authenticated
  using (bucket_id = 'product-images' and public.is_admin());

alter publication supabase_realtime add table
  public.products, public.sales, public.cash_sessions, public.stock_movements, public.clients;
