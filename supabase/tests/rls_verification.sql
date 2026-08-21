-- Ejecutar en una base de pruebas después de la migración y el seed.
-- Estas consultas fallan deliberadamente si las operaciones protegidas llegan a permitirse.
begin;
select plan(12);
select policies_are('public','profiles',array['profiles_self_admin_select','profiles_self_insert','profiles_self_update']);
select policies_are('public','jobs',array['jobs_related_select']);
select policies_are('public','applications',array['applications_related_select']);
select policies_are('public','payments',array['payments_owner_admin_select']);
select policies_are('public','ratings',array['ratings_related_select']);
select policies_are('public','reports',array['reports_admin_update','reports_reporter_admin_select']);
select policies_are('public','user_activity',array['activity_own_admin_select']);
select policies_are('public','workers',array['workers_self_admin_select','workers_self_insert','workers_self_update']);
select policies_are('public','employers',array['employers_self_admin_select','employers_self_insert']);
select is(candidate_limit_for(1),5,'1 trabajador = 5 candidatos');
select is(candidate_limit_for(6),11,'6 trabajadores = 11 candidatos');
select is(candidate_limit_for(11),17,'11 trabajadores = 17 candidatos');
select * from finish();
rollback;
