-- MIGRATION: Permitir que o Administrador atualize os perfis (cargos) dos usuários

CREATE POLICY "Admin_Update_Perfis" ON public.perfis 
FOR UPDATE TO authenticated 
USING (auth_user_perfil() = 'Administrador')
WITH CHECK (auth_user_perfil() = 'Administrador');
