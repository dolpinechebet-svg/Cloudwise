create unique index if not exists flashcards_user_question_unique
  on public.flashcards (user_id, question_id);
