import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { STORAGE_BUCKET } from "@/lib/config";
import { verifyUploadCompletionToken } from "@/lib/upload-token";

type CompleteRequest = {
  id?: string;
  path?: string;
  token?: string;
};

export async function POST(request: Request) {
  let payload: CompleteRequest;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const { id = "", path = "", token = "" } = payload;
  if (!id || !path || !token || !verifyUploadCompletionToken(id, path, token)) {
    return NextResponse.json({ error: "업로드 확인 토큰이 올바르지 않습니다." }, { status: 403 });
  }

  try {
    const supabase = createAdminClient();
    const { data: objectData, error: objectError } = await supabase.storage.from(STORAGE_BUCKET).list(
      path.split("/").slice(0, -1).join("/"),
      { search: path.split("/").at(-1), limit: 1 },
    );

    if (objectError || !objectData?.some((item: { name: string }) => path.endsWith(`/${item.name}`))) {
      return NextResponse.json({ error: "업로드된 파일을 확인할 수 없습니다." }, { status: 409 });
    }

    const { error } = await supabase
      .from("photos")
      .update({ is_ready: true })
      .eq("id", id)
      .eq("storage_path", path);

    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "업로드 완료 처리에 실패했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
