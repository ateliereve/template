import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { STORAGE_BUCKET } from "@/lib/config";

type DeleteRequest = {
  photos?: Array<{ id?: string; path?: string }>;
};

export async function POST(request: Request) {
  const authorization = request.headers.get("authorization") || "";
  const accessToken = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!accessToken) {
    return NextResponse.json({ error: "관리자 로그인이 필요합니다." }, { status: 401 });
  }

  let payload: DeleteRequest;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const photos = (payload.photos || []).filter((photo) => photo.id && photo.path).slice(0, 100);
  if (photos.length === 0) {
    return NextResponse.json({ error: "삭제할 이미지를 선택해 주세요." }, { status: 400 });
  }

  try {
    const supabase = createAdminClient();
    const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);
    if (userError || !userData.user) {
      return NextResponse.json({ error: "로그인 세션이 유효하지 않습니다." }, { status: 401 });
    }

    const { data: adminRow } = await supabase
      .from("admins")
      .select("user_id")
      .eq("user_id", userData.user.id)
      .maybeSingle();

    if (!adminRow) {
      return NextResponse.json({ error: "관리자 권한이 없습니다." }, { status: 403 });
    }

    const paths = photos.map((photo) => photo.path as string);
    const ids = photos.map((photo) => photo.id as string);

    const { error: storageError } = await supabase.storage.from(STORAGE_BUCKET).remove(paths);
    if (storageError) throw new Error(storageError.message);

    const { error: dbError } = await supabase.from("photos").delete().in("id", ids);
    if (dbError) throw new Error(dbError.message);

    return NextResponse.json({ ok: true, deleted: ids.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : "삭제에 실패했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
