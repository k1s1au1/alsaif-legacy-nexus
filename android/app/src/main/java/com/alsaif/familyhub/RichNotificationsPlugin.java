package com.alsaif.familyhub;

import android.Manifest;
import android.app.PendingIntent;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.Executors;

/** Foreground image notification; background notifications remain owned by FCM. */
@CapacitorPlugin(name = "RichNotifications")
public class RichNotificationsPlugin extends Plugin {
    @PluginMethod
    public void show(PluginCall call) {
        final String title = call.getString("title", "إشعار جديد");
        final String body = call.getString("body", "");
        final String image = call.getString("image", "");
        final String path = call.getString("url", "/");
        if (Build.VERSION.SDK_INT >= 33 && ContextCompat.checkSelfPermission(getContext(), Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            call.reject("Notification permission not granted");
            return;
        }
        java.util.concurrent.ExecutorService executor = Executors.newSingleThreadExecutor();
        executor.execute(() -> {
            try {
                int id = (int) (System.currentTimeMillis() & 0x7fffffff);
                Intent intent = new Intent(getContext(), MainActivity.class);
                intent.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
                // Capacitor forwards this same bundle through its normal push tap listener.
                intent.putExtra("google.message_id", "foreground-" + id);
                intent.putExtra("url", path.startsWith("/") && !path.startsWith("//") ? path : "/");
                PendingIntent tap = PendingIntent.getActivity(getContext(), id, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
                NotificationCompat.Builder builder = new NotificationCompat.Builder(getContext(), "alsaif_notifications")
                    .setSmallIcon(getContext().getApplicationInfo().icon)
                    .setContentTitle(title).setContentText(body).setAutoCancel(true)
                    .setContentIntent(tap).setPriority(NotificationCompat.PRIORITY_HIGH)
                    .setStyle(new NotificationCompat.BigTextStyle().bigText(body));
                Bitmap bitmap = downloadImage(image);
                if (bitmap != null) {
                    builder.setLargeIcon(bitmap).setStyle(new NotificationCompat.BigPictureStyle()
                        .bigPicture(bitmap).setBigContentTitle(title).setSummaryText(body));
                }
                NotificationManagerCompat.from(getContext()).notify(id, builder.build());
                call.resolve();
            } catch (Exception error) {
                call.reject("Unable to display notification", error);
            } finally {
                executor.shutdown();
            }
        });
    }

    private Bitmap downloadImage(String value) {
        HttpURLConnection connection = null;
        try {
            URL url = new URL(value);
            if (!"https".equals(url.getProtocol())) return null;
            connection = (HttpURLConnection) url.openConnection();
            connection.setConnectTimeout(4000);
            connection.setReadTimeout(4000);
            connection.setInstanceFollowRedirects(false);
            if (connection.getResponseCode() != 200) return null;
            try (InputStream input = connection.getInputStream(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
                byte[] buffer = new byte[8192];
                int bytes;
                while ((bytes = input.read(buffer)) != -1) {
                    if (output.size() + bytes > 2 * 1024 * 1024) return null;
                    output.write(buffer, 0, bytes);
                }
                byte[] data = output.toByteArray();
                BitmapFactory.Options options = new BitmapFactory.Options();
                options.inJustDecodeBounds = true;
                BitmapFactory.decodeByteArray(data, 0, data.length, options);
                options.inSampleSize = 1;
                while (options.outWidth / options.inSampleSize > 1600 || options.outHeight / options.inSampleSize > 1600) options.inSampleSize *= 2;
                options.inJustDecodeBounds = false;
                return BitmapFactory.decodeByteArray(data, 0, data.length, options);
            }
        } catch (Exception ignored) {
            return null; // Always retain the expanded text if the image is unavailable.
        } finally {
            if (connection != null) connection.disconnect();
        }
    }
}