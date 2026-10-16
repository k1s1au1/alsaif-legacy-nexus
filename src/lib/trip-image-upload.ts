import { supabase } from "@/integrations/supabase/client";

export function tripImageUploadErrorDescription(error: unknown): string {
  const details = error && typeof error === "object" ? error : {};
  const { code, statusCode, status, message } = details as {
    code?: string;
    statusCode?: number | string;
    status?: number | string;
    message?: string;
  };
  const errorCode = String(code ?? "").toLowerCase();
  const httpStatus = Number(statusCode ?? status);
  const errorMessage = String(message ?? "").toLowerCase();

  if (httpStatus === 401 || /invalidjwt|expiredtoken|invalidtoken/.test(errorCode)) {
    return "انتهت جلسة تسجيل الدخول. سجّل دخولك مجددًا ثم أعد رفع الصورة.";
  }
  if (
    httpStatus === 403 ||
    errorCode === "accessdenied" ||
    /row.level security|permission denied|access denied/.test(errorMessage)
  ) {
    return "حسابك لا يملك صلاحية رفع صور الرحلات. راجع صلاحيات إدارة الرحلات.";
  }
  if (httpStatus === 413 || errorCode === "entitytoolarge") {
    return "حجم الصورة يتجاوز الحد المسموح. اختر صورة بحجم أصغر.";
  }
  if (httpStatus === 415 || errorCode === "invalidmimetype") {
    return "صيغة الصورة غير مدعومة. جرّب صورة بصيغة JPG أو PNG.";
  }
  if (errorCode === "nosuchbucket" || /bucket not found/.test(errorMessage)) {
    return "خدمة حفظ صور الرحلات غير متاحة حاليًا. حاول لاحقًا.";
  }
  if (/failed to fetch|fetch failed|load failed|network|internet/.test(errorMessage)) {
    return "تعذّر الاتصال بخدمة رفع الصور. تحقق من الإنترنت وأعد المحاولة.";
  }
  return "تعذّر رفع الصورة حاليًا. أعد المحاولة بعد قليل.";
}

export class TripImageUploadError extends Error {
  constructor(cause: unknown) {
    super(tripImageUploadErrorDescription(cause), { cause });
    this.name = "TripImageUploadError";
  }
}

/** Upload a new private object; replacements also get a new unique path. */
export async function uploadTripImage(file: File, userId: string): Promise<string> {
  const extension = file.name.split(".").pop() || "jpg";
  const path = `${userId}/${crypto.randomUUID()}.${extension}`;
  try {
    const { error } = await supabase.storage.from("trip-images").upload(path, file);
    if (error) throw error;
    return path;
  } catch (error) {
    throw new TripImageUploadError(error);
  }
}
