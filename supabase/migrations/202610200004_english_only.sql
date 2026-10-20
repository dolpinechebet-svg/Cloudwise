delete from public.ai_explanations;

alter table public.ai_explanations
  drop constraint if exists ai_explanations_question_id_selected_index_language_key;

alter table public.ai_explanations
  drop column if exists language;

alter table public.ai_explanations
  add constraint ai_explanations_question_id_selected_index_key
  unique (question_id, selected_index);

alter table public.profiles
  drop column if exists preferred_language;
