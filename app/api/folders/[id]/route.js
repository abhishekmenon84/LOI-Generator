import { NextResponse } from "next/server";
import { auth } from "../../../../lib/auth";
import { loadAccessibleFolder } from "../../../../lib/folderAccess";

export async function GET(request, { params }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const folder = await loadAccessibleFolder(params.id, session.user.id);
  if (!folder) {
    return NextResponse.json({ error: "Folder not found." }, { status: 404 });
  }
  return NextResponse.json({
    id: folder.id,
    name: folder.name,
    stage: folder.stage,
    priority: folder.priority,
    parentFolderId: folder.parentFolderId,
    orgId: folder.orgId,
    readOnly: !folder._writeAccess,
  });
}
