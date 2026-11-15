import { NextResponse } from 'next/server';
import { UUID_PATTERN } from '@/lib/diary-ideas';
import { hasTrustedRequestOrigin } from '@/lib/request-origin';
import { getSubjectAccount, subjectAccountError, SubjectAccountError } from '@/lib/subject-account';

async function requireOwnedSubject(subjectId: string, ownerId: string, supabase: Awaited<ReturnType<typeof getSubjectAccount>>['supabase']) {
  if (!UUID_PATTERN.test(subjectId)) throw new SubjectAccountError('Select a valid subject.', 400);
  const { data, error } = await supabase.from('subjects').select('id')
    .eq('id', subjectId).eq('google_owner_id', ownerId).maybeSingle();
  if (error) throw new SubjectAccountError('Your subject could not be checked. Please retry.', 503);
  if (!data) throw new SubjectAccountError('That subject is not available for the connected Google account.', 404);
}

export async function GET(request: Request) {
  try {
    const { ownerId, supabase } = await getSubjectAccount();
    const subjectId = new URL(request.url).searchParams.get('subjectId') ?? '';
    await requireOwnedSubject(subjectId, ownerId, supabase);
    const { data, error } = await supabase.from('diary_ideas')
      .select('id,subject_id,idea_text,created_at')
      .eq('subject_id', subjectId).is('used_at', null).order('created_at', { ascending: false });
    if (error) throw new SubjectAccountError('Your diary ideas could not be loaded. Apply the diary ideas database migration, then retry.', 503);
    return NextResponse.json({ ideas: data }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return subjectAccountError(error); }
}

export async function POST(request: Request) {
  try {
    if (!hasTrustedRequestOrigin(request)) throw new SubjectAccountError('Please add diary ideas from 1PicDiary.', 403);
    const { ownerId, supabase } = await getSubjectAccount();
    const body = await request.json().catch(() => null);
    const subjectId = typeof body?.subjectId === 'string' ? body.subjectId : '';
    const ideaText = typeof body?.ideaText === 'string' ? body.ideaText.trim() : '';
    if (!ideaText) throw new SubjectAccountError('Write something before adding it to your ideas.', 400);
    await requireOwnedSubject(subjectId, ownerId, supabase);
    const { data, error } = await supabase.from('diary_ideas').insert({ subject_id: subjectId, idea_text: ideaText })
      .select('id,subject_id,idea_text,created_at').single();
    if (error) throw new SubjectAccountError('Your diary idea could not be saved. Check the database migration and retry.', 503);
    return NextResponse.json({ idea: data }, { status: 201 });
  } catch (error) { return subjectAccountError(error); }
}
