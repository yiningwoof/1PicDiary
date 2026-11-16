import { NextResponse } from 'next/server';
import { UUID_PATTERN } from '@/lib/diary-ideas';
import { hasTrustedRequestOrigin } from '@/lib/request-origin';
import { getSubjectAccount, subjectAccountError, SubjectAccountError } from '@/lib/subject-account';

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!hasTrustedRequestOrigin(request)) throw new SubjectAccountError('Please delete diary ideas from 1PicDiary.', 403);
    const { id } = await params;
    if (!UUID_PATTERN.test(id)) throw new SubjectAccountError('That diary idea is not valid.', 400);
    const { ownerId, supabase } = await getSubjectAccount();
    const { data: idea, error: ideaError } = await supabase.from('diary_ideas')
      .select('id,subject_id').eq('id', id).is('used_at', null).maybeSingle();
    if (ideaError) throw new SubjectAccountError('That diary idea could not be loaded.', 503);
    if (!idea) throw new SubjectAccountError('That unused diary idea was not found.', 404);
    const { data: subject, error: subjectError } = await supabase.from('subjects').select('id')
      .eq('id', idea.subject_id).eq('google_owner_id', ownerId).maybeSingle();
    if (subjectError) throw new SubjectAccountError('The diary idea owner could not be checked.', 503);
    if (!subject) throw new SubjectAccountError('That diary idea is not available for the connected Google account.', 404);
    const { data, error } = await supabase.from('diary_ideas').delete()
      .eq('id', id).eq('subject_id', subject.id).is('used_at', null).select('id').maybeSingle();
    if (error) throw new SubjectAccountError('The diary idea could not be deleted. Please retry.', 503);
    if (!data) throw new SubjectAccountError('That unused diary idea was not found.', 404);
    return NextResponse.json({ success: true });
  } catch (error) { return subjectAccountError(error); }
}
