import { NextResponse } from "next/server";

import { hasTrustedRequestOrigin } from "@/lib/request-origin";
import {
  getSubjectAccount,
  subjectAccountError,
  SubjectAccountError,
} from "@/lib/subject-account";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    if (!hasTrustedRequestOrigin(request)) {
      throw new SubjectAccountError("Please delete subjects from 1PicDiary.", 403);
    }

    const { id } = await params;
    if (!UUID_PATTERN.test(id)) {
      throw new SubjectAccountError("That subject is not valid.", 400);
    }

    const { ownerId, supabase } = await getSubjectAccount();
    const { data, error } = await supabase
      .from("subjects")
      .delete()
      .eq("id", id)
      .eq("google_owner_id", ownerId)
      .select("id")
      .maybeSingle();

    if (error) {
      throw new SubjectAccountError(
        "The subject could not be deleted. Check that the subject deletion database migration has been applied, then retry.",
        503,
      );
    }
    if (!data) {
      throw new SubjectAccountError(
        "That subject was not found for the connected Google account.",
        404,
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return subjectAccountError(error);
  }
}
