package com.alsaif.familyhub;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.provider.DocumentsContract;
import android.util.Base64;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;

@CapacitorPlugin(name = "FamilyFileSave")
public class FileSavePlugin extends Plugin {
    private static final int MAX_BYTES = 50 * 1024 * 1024;
    private boolean saveInProgress;

    @PluginMethod
    public void save(PluginCall call) {
        String fileName = call.getString("fileName");
        String base64Data = call.getString("base64Data");
        if (fileName == null || !fileName.matches("[A-Za-z0-9][A-Za-z0-9._-]{0,179}\\.zip")) {
            call.reject("اسم ملف النسخة غير صالح.", "INVALID_FILE_NAME");
            return;
        }
        if (base64Data == null || base64Data.isEmpty()
            || base64Data.length() % 4 != 0 || !base64Data.matches("[A-Za-z0-9+/]*={0,2}")) {
            call.reject("بيانات النسخة غير صالحة. أعد إنشاء النسخة.", "INVALID_DATA");
            return;
        }
        if (base64Data.length() > 4L * ((MAX_BYTES + 2L) / 3L)) {
            call.reject("النسخة كبيرة للحفظ داخل التطبيق. نزّلها من الموقع في المتصفح.", "FILE_TOO_LARGE");
            return;
        }
        synchronized (this) {
            if (saveInProgress) {
                call.reject("انتظر حتى تنتهي عملية الحفظ الحالية.", "SAVE_IN_PROGRESS");
                return;
            }
            saveInProgress = true;
        }

        new Thread(() -> {
            File cached = null;
            try {
                byte[] bytes = Base64.decode(base64Data, Base64.DEFAULT);
                if (bytes.length == 0 || bytes.length > MAX_BYTES) throw new IOException("Invalid backup size");
                File directory = new File(getContext().getCacheDir(), "backup-saves");
                if (!directory.exists() && !directory.mkdirs()) throw new IOException("Cannot create backup cache");
                File[] abandoned = directory.listFiles();
                if (abandoned != null) {
                    for (File file : abandoned) {
                        if (file.getName().startsWith("backup-")
                            && file.lastModified() < System.currentTimeMillis() - 86400000L) file.delete();
                    }
                }
                cached = File.createTempFile("backup-", ".zip", directory);
                try (OutputStream stream = new FileOutputStream(cached)) {
                    stream.write(bytes);
                }
                // Capacitor saves activity-call arguments. Keep the ZIP out of that Bundle.
                call.getData().remove("base64Data");
                call.getData().put("_backupCacheName", cached.getName());
                File prepared = cached;

                Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("application/zip");
                intent.putExtra(Intent.EXTRA_TITLE, fileName);
                getActivity().runOnUiThread(() -> {
                    try {
                        startActivityForResult(call, intent, "documentCreated");
                    } catch (Exception error) {
                        prepared.delete();
                        finishSave();
                        call.reject("تعذر فتح نافذة الحفظ. نزّل النسخة من الموقع في المتصفح.", "PICKER_UNAVAILABLE", error);
                    }
                });
            } catch (Exception error) {
                if (cached != null) cached.delete();
                finishSave();
                call.reject("تعذر تجهيز ملف النسخة للحفظ. أعد المحاولة.", "PREPARE_FAILED", error);
            }
        }, "family-backup-prepare").start();
    }

    @ActivityCallback
    private void documentCreated(PluginCall call, ActivityResult result) {
        if (call == null) {
            finishSave();
            return;
        }
        File cached = preparedBackup(call);
        if (result.getResultCode() != Activity.RESULT_OK) {
            if (cached != null) cached.delete();
            finishSave();
            JSObject response = new JSObject();
            response.put("saved", false);
            call.resolve(response);
            return;
        }
        Intent data = result.getData();
        Uri uri = data == null ? null : data.getData();
        if (uri == null || cached == null || !cached.isFile()) {
            if (cached != null) cached.delete();
            finishSave();
            call.reject("تعذر الوصول إلى الملف أو مكان الحفظ. أعد المحاولة.", "SAVE_FAILED");
            return;
        }

        new Thread(() -> {
            try {
                try (InputStream input = new FileInputStream(cached);
                     OutputStream output = getContext().getContentResolver().openOutputStream(uri, "w")) {
                    if (output == null) throw new IOException("Cannot open selected document");
                    byte[] buffer = new byte[64 * 1024];
                    int count;
                    while ((count = input.read(buffer)) != -1) output.write(buffer, 0, count);
                    output.flush();
                }
                // Resolve only after writing and closing the selected document succeeded.
                cached.delete();
                finishSave();
                JSObject response = new JSObject();
                response.put("saved", true);
                call.resolve(response);
            } catch (Exception error) {
                cached.delete();
                try {
                    DocumentsContract.deleteDocument(getContext().getContentResolver(), uri);
                } catch (Exception ignored) {
                    // Some providers cannot remove an incomplete document.
                }
                finishSave();
                call.reject("تعذر حفظ النسخة في المكان المحدد. اختر مجلدًا آخر.", "SAVE_FAILED", error);
            }
        }, "family-backup-save").start();
    }

    private File preparedBackup(PluginCall call) {
        String name = call.getString("_backupCacheName");
        if (name == null || !name.startsWith("backup-") || !name.endsWith(".zip")
            || !name.equals(new File(name).getName()) || name.contains("\\")) return null;
        return new File(new File(getContext().getCacheDir(), "backup-saves"), name);
    }

    private synchronized void finishSave() {
        saveInProgress = false;
    }
}
