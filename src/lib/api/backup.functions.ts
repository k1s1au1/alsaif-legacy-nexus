import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Every public table included in the full system backup. */
const BACKUP_TABLES = [
  "profiles",
  "profile_phones",
  "user_roles",
  "section_heads",
  "account_requests",
  "profile_change_requests",
  "admin_activity_log",
  "app_settings",
  "notification_preferences",
  "push_tokens",
  "user_presence",
  "events",
  "event_attendees",
  "event_invitees",
  "meetings",
  "meeting_attendees",
  "meeting_presentations",
  "trips",
  "trip_attendees",
  "trip_items",
  "tasks",
  "majlis_posts",
  "majlis_comments",
  "member_posts",
  "member_post_comments",
  "member_post_votes",
  "conversations",
  "conversation_participants",
  "messages",
  "message_reactions",
  "message_deliveries",
  "archive_items",
  "secure_vault",
  "family_tree_extras",
  "family_projects",
  "family_project_contributions",
  "fund_transactions",
  "bank_transfers",
  "private_requests",
  "private_request_messages",
  "anonymous_suggestions",
  "bug_reports",
  "system_backups",
] as const;

const STORAGE_BUCKETS = [
  "app-backgrounds",
  "archive-media",
  "avatars",
  "chat-attachments",
  "community-media",
  "meeting-presentations",
  "trip-images",
  "vault-media",
] as const;

export type BackupResult = {
  fileName: string;
  /** base64 encoded ZIP archive */
  zipBase64: string;
  createdAt: string;
  tablesCount: number;
  rowsCount: number;
  bytesSize: number;
  tables: { table: string; rows: number; error?: string }[];
};

/**
 * Full system export (accounts, content, media index) for the chairman or the
 * technical admin. Runs with elevated privileges, so the caller's rank is
 * verified first through their own (RLS-scoped) session.
 */
export const createFullBackup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<BackupResult> => {
    const { userId, token } = context;
    const { getSupabaseAdmin, getSupabaseUserClient } = await import(
      "@/integrations/supabase/client.server"
    );
    const supabase = await getSupabaseUserClient(token);

    const [{ data: chairman }, { data: technical }] = await Promise.all([
      supabase.rpc("is_chairman", { _u: userId }),
      supabase.rpc("is_technical_admin", { _u: userId }),
    ]);
    if (!chairman && !technical) {
      throw new Error("ليس لديك صلاحية تنفيذ النسخ الاحتياطي");
    }

    const supabaseAdmin = await getSupabaseAdmin();
    const { zipSync, strToU8 } = await import("fflate");

    const createdAt = new Date().toISOString();
    const stamp = createdAt.replace(/[:.]/g, "-").slice(0, 19);
    const files: Record<string, Uint8Array> = {};
    const report: { table: string; rows: number; error?: string }[] = [];
    let rowsCount = 0;

    for (const table of BACKUP_TABLES) {
      const rows: any[] = [];
      let error: string | undefined;
      const pageSize = 1000;
      for (let page = 0; ; page += 1) {
        const { data, error: err } = await supabaseAdmin
          .from(table as any)
          .select("*")
          .range(page * pageSize, page * pageSize + pageSize - 1);
        if (err) {
          error = err.message;
          break;
        }
        rows.push(...(data ?? []));
        if (!data || data.length < pageSize) break;
      }
      report.push({ table, rows: rows.length, ...(error ? { error } : {}) });
      rowsCount += rows.length;
      files[`database/${table}.json`] = strToU8(JSON.stringify(rows, null, 2));
      files[`csv/${table}.csv`] = strToU8(toCsv(rows));
    }

    // Login accounts (emails + confirmation state) straight from the auth store.
    const authUsers: any[] = [];
    try {
      for (let page = 1; page <= 50; page += 1) {
        const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
        if (error) throw error;
        authUsers.push(
          ...(data.users ?? []).map((u) => ({
            id: u.id,
            email: u.email,
            phone: u.phone,
            created_at: u.created_at,
            last_sign_in_at: u.last_sign_in_at,
            email_confirmed_at: (u as any).email_confirmed_at ?? null,
            providers: (u.app_metadata as any)?.providers ?? [],
            user_metadata: u.user_metadata ?? {},
          })),
        );
        if (!data.users || data.users.length < 200) break;
      }
    } catch (err: any) {
      report.push({ table: "auth_users", rows: 0, error: err?.message ?? "unknown" });
    }
    files["accounts/auth_users.json"] = strToU8(JSON.stringify(authUsers, null, 2));
    files["accounts/auth_users.csv"] = strToU8(toCsv(authUsers));

    // Media index: every stored file with a long-lived download link.
    const media: Record<string, any[]> = {};
    for (const bucket of STORAGE_BUCKETS) {
      const entries: any[] = [];
      const walk = async (prefix: string, depth: number): Promise<void> => {
        if (depth > 4) return;
        const { data, error } = await supabaseAdmin.storage
          .from(bucket)
          .list(prefix, { limit: 1000, sortBy: { column: "name", order: "asc" } });
        if (error || !data) return;
        for (const item of data) {
          const path = prefix ? `${prefix}/${item.name}` : item.name;
          if (item.id === null) {
            await walk(path, depth + 1);
            continue;
          }
          const { data: signed } = await supabaseAdmin.storage
            .from(bucket)
            .createSignedUrl(path, 60 * 60 * 24 * 7);
          entries.push({
            path,
            size: (item.metadata as any)?.size ?? null,
            mime: (item.metadata as any)?.mimetype ?? null,
            updated_at: item.updated_at ?? null,
            download_url: signed?.signedUrl ?? null,
          });
        }
      };
      await walk("", 0);
      media[bucket] = entries;
      files[`media/${bucket}.csv`] = strToU8(toCsv(entries));
    }
    files["media/index.json"] = strToU8(JSON.stringify(media, null, 2));

    files["README.txt"] = strToU8(
      [
        "نسخة احتياطية كاملة لموقع عائلة السيف",
        `تاريخ النسخة: ${createdAt}`,
        "",
        "database/  : كل جداول البيانات بصيغة JSON",
        "csv/       : نفس الجداول بصيغة CSV لفتحها في Excel",
        "accounts/  : حسابات الدخول (البريد وحالة التأكيد وآخر دخول)",
        "media/     : فهرس كامل لكل الصور والملفات مع روابط تحميل صالحة 7 أيام",
        "",
        `عدد الجداول: ${BACKUP_TABLES.length}`,
        `عدد السجلات: ${rowsCount}`,
      ].join("\n"),
    );
    files["manifest.json"] = strToU8(
      JSON.stringify({ createdAt, actorId: userId, tables: report }, null, 2),
    );

    const zipped = zipSync(files, { level: 6 });
    const bytesSize = zipped.byteLength;

    await supabaseAdmin.from("system_backups" as any).insert({
      actor_id: userId,
      scope: "full",
      tables_count: BACKUP_TABLES.length,
      rows_count: rowsCount,
      bytes_size: bytesSize,
      details: { tables: report, accounts: authUsers.length },
    });

    return {
      fileName: `alsaif-backup-${stamp}.zip`,
      zipBase64: toBase64(zipped),
      createdAt,
      tablesCount: BACKUP_TABLES.length,
      rowsCount,
      bytesSize,
      tables: report,
    };
  });

function toCsv(rows: any[]): string {
  if (!rows.length) return "";
  const cols = Array.from(new Set(rows.flatMap((r) => Object.keys(r ?? {}))));
  const cell = (v: any) => {
    if (v === null || v === undefined) return "";
    const s = typeof v === "object" ? JSON.stringify(v) : String(v);
    return `"${s.replace(/"/g, '""')}"`;
  };
  return [
    cols.join(","),
    ...rows.map((r) => cols.map((c) => cell(r?.[c])).join(",")),
  ].join("\n");
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
