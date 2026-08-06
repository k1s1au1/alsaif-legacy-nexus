package com.alsaif.familyhub;

import android.Manifest;
import android.content.Context;
import android.content.SharedPreferences;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

@CapacitorPlugin(
    name = "StepsPlugin",
    permissions = {
        @Permission(alias = "activity", strings = { Manifest.permission.ACTIVITY_RECOGNITION })
    }
)
public class StepsPlugin extends Plugin implements SensorEventListener {

    private static final String PREFS = "steps_challenge_prefs";
    private static final String KEY_BASELINE = "baseline_counter";
    private static final String KEY_BASE_DATE = "baseline_date";

    private SensorManager sensorManager;
    private Sensor stepSensor;
    private float lastCounter = -1f;

    @Override
    public void load() {
        sensorManager = (SensorManager) getContext().getSystemService(Context.SENSOR_SERVICE);
        if (sensorManager != null) {
            stepSensor = sensorManager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER);
            if (stepSensor != null && hasActivityPermission()) {
                sensorManager.registerListener(this, stepSensor, SensorManager.SENSOR_DELAY_NORMAL);
            }
        }
    }

    private boolean hasActivityPermission() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return true;
        return getPermissionState("activity") == PermissionState.GRANTED;
    }

    private String today() {
        return new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
    }

    private SharedPreferences prefs() {
        return getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    @PluginMethod
    public void isAvailable(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("available", stepSensor != null);
        ret.put("granted", hasActivityPermission());
        call.resolve(ret);
    }

    @PluginMethod
    public void requestActivityPermission(PluginCall call) {
        if (hasActivityPermission()) {
            startSensor();
            JSObject ret = new JSObject();
            ret.put("granted", true);
            call.resolve(ret);
            return;
        }
        requestPermissionForAlias("activity", call, "activityPermsCallback");
    }

    @PermissionCallback
    private void activityPermsCallback(PluginCall call) {
        boolean granted = hasActivityPermission();
        if (granted) startSensor();
        JSObject ret = new JSObject();
        ret.put("granted", granted);
        call.resolve(ret);
    }

    private void startSensor() {
        if (sensorManager != null && stepSensor != null) {
            sensorManager.registerListener(this, stepSensor, SensorManager.SENSOR_DELAY_NORMAL);
        }
    }

    @PluginMethod
    public void getTodaySteps(final PluginCall call) {
        if (stepSensor == null) {
            call.reject("NO_SENSOR");
            return;
        }
        if (!hasActivityPermission()) {
            call.reject("NO_PERMISSION");
            return;
        }
        startSensor();

        // The step counter is cumulative since device boot, so we wait briefly
        // for the first sensor event, then subtract today's stored baseline.
        new Handler(Looper.getMainLooper()).postDelayed(() -> {
            if (lastCounter < 0) {
                call.reject("NO_DATA");
                return;
            }
            call.resolve(buildTodayResult());
        }, lastCounter < 0 ? 2500 : 0);
    }

    private JSObject buildTodayResult() {
        SharedPreferences p = prefs();
        String today = today();
        String storedDate = p.getString(KEY_BASE_DATE, null);
        float baseline = p.getFloat(KEY_BASELINE, -1f);

        // New day, or device rebooted (counter reset below the baseline).
        if (storedDate == null || !storedDate.equals(today) || baseline < 0 || lastCounter < baseline) {
            baseline = lastCounter;
            p.edit().putString(KEY_BASE_DATE, today).putFloat(KEY_BASELINE, baseline).apply();
        }

        int steps = Math.max(0, (int) (lastCounter - baseline));
        JSObject ret = new JSObject();
        ret.put("steps", steps);
        ret.put("total", (int) lastCounter);
        ret.put("date", today);
        return ret;
    }

    @PluginMethod
    public void checkHealthConnect(PluginCall call) {
        JSObject ret = new JSObject();
        try {
            int status = androidx.health.connect.client.HealthConnectClient.getSdkStatus(getContext(), "com.google.android.apps.healthdata");
            ret.put("status", status);
        } catch (Exception e) {
            ret.put("status", 2);
        }
        call.resolve(ret);
    }

    @Override
    public void onSensorChanged(SensorEvent event) {
        if (event.sensor.getType() == Sensor.TYPE_STEP_COUNTER) {
            lastCounter = event.values[0];
            // Seed the baseline the first time we ever see a value today.
            SharedPreferences p = prefs();
            if (!today().equals(p.getString(KEY_BASE_DATE, null))) {
                p.edit().putString(KEY_BASE_DATE, today()).putFloat(KEY_BASELINE, lastCounter).apply();
            }
        }
    }

    @Override
    public void onAccuracyChanged(Sensor sensor, int accuracy) {
        // Not needed
    }

    @Override
    protected void handleOnDestroy() {
        super.handleOnDestroy();
        if (sensorManager != null) {
            sensorManager.unregisterListener(this);
        }
    }
}
