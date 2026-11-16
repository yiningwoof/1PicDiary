alter table public.diary_ideas
  add column if not exists source_type text not null default 'typed',
  add column if not exists raw_transcript text,
  add column if not exists audio_duration_seconds integer,
  add column if not exists transcription_model text,
  add column if not exists summary_model text,
  add column if not exists ai_input_tokens integer,
  add column if not exists ai_output_tokens integer;

alter table public.diary_ideas
  add constraint diary_ideas_source_type_check check (source_type in ('typed', 'voice')),
  add constraint diary_ideas_audio_duration_check check (audio_duration_seconds between 1 and 120),
  add constraint diary_ideas_ai_input_tokens_check check (ai_input_tokens is null or ai_input_tokens >= 0),
  add constraint diary_ideas_ai_output_tokens_check check (ai_output_tokens is null or ai_output_tokens >= 0);

comment on column public.diary_ideas.source_type is 'Whether the memory was typed or created from a voice recording.';
comment on column public.diary_ideas.raw_transcript is 'Original speech transcript for a voice memory; audio itself is not stored.';
comment on column public.diary_ideas.audio_duration_seconds is 'Length of the voice recording, capped at 120 seconds.';
comment on column public.diary_ideas.transcription_model is 'OpenAI model used to transcribe the recording.';
comment on column public.diary_ideas.summary_model is 'OpenAI model used to turn the transcript into a written memory.';
comment on column public.diary_ideas.ai_input_tokens is 'Input tokens reported for the written-summary request.';
comment on column public.diary_ideas.ai_output_tokens is 'Output tokens reported for the written-summary request.';
