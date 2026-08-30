package com.alsaif.familyhub;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import com.getcapacitor.annotation.ActivityCallback;
import androidx.activity.result.ActivityResult;

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

    private static final String TAG = "StepsPlugin";
    private static final String PREFS = "steps_challenge_prefs";
    private static final String KEY_BASELINE = "baseline_counter";
    private static final String KEY_BASE_DATE = "baseline_date";

    private SensorManager sensorManager;
    private Sensor stepSensor;
    private float lastCounter = -1f;

    @Override
    public void load() {
        Log.d(TAG, "Loading StepsPlugin...");
        sensorManager = (SensorManager) getContext().getSystemService(Context.SENSOR_SERVICE);
        if (sensorManager != null) {
            stepSensor = sensorManager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER);
            Log.d(TAG, "Step counter sensor available: " + (stepSensor != null));
            if (stepSensor != null && hasActivityPermission()) {
                Log.d(TAG, "Permissions already granted, registering listener.");
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
        Log.d(TAG, "requestActivityPermission called");
        if (hasActivityPermission()) {
            Log.d(TAG, "Already granted, starting sensor.");
            startSensor();
            JSObject ret = new JSObject();
            ret.put("granted", true);
            call.resolve(ret);
            return;
        }
        Log.d(TAG, "Requesting activity permission...");
        requestPermissionForAlias("activity", call, "activityPermsCallback");
    }

    @PermissionCallback
    public void activityPermsCallback(PluginCall call) {
        boolean granted = hasActivityPermission();
        Log.d(TAG, "activityPermsCallback: granted=" + granted);
        if (granted) startSensor();
        JSObject ret = new JSObject();
        ret.put("granted", granted);
        call.resolve(ret);
    }

    private void startSensor() {
        if (sensorManager != null && stepSensor != null) {
            Log.d(TAG, "Registering sensor listener manually.");
            sensorManager.registerListener(this, stepSensor, SensorManager.SENSOR_DELAY_NORMAL);
        }
    }

    @PluginMethod
    public void getTodaySteps(final PluginCall call) {
        Log.d(TAG, "getTodaySteps called");
        if (stepSensor == null) {
            Log.w(TAG, "Sensor not found.");
            call.reject("NO_SENSOR");
            return;
        }
        if (!hasActivityPermission()) {
            Log.w(TAG, "Permission not granted.");
            call.reject("NO_PERMISSION");
            return;
        }
        startSensor();

        // The step counter is cumulative since device boot, so we wait briefly
        // for the first sensor event, then subtract today's stored baseline.
        new Handler(Looper.getMainLooper()).postDelayed(() -> {
            Log.d(TAG, "Delayed execution: lastCounter=" + lastCounter);
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
        int status = HealthConnectBridge.sdkStatus(getContext());
        ret.put("status", status);
        ret.put("available", status == 1);
        call.resolve(ret);
    }

    @PluginMethod
    public void requestHealthConnectPermission(PluginCall call) {
        if (!HealthConnectBridge.isAvailable(getContext())) {
            call.reject("HC_UNAVAILABLE");
            return;
        }
        try {
            saveCall(call);
            startActivityForResult(call, HealthConnectBridge.permissionIntent(getContext()), "healthPermsResult");
        } catch (Exception e) {
            call.reject(e.getMessage() != null ? e.getMessage() : "HC_PERMISSION_FAILED");
        }
    }

    @ActivityCallback
    private void healthPermsResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        HealthConnectBridge.hasPermission(getContext(), (granted, error) -> {
            JSObject ret = new JSObject();
            ret.put("granted", granted);
            if (error != null) ret.put("error", error);
            call.resolve(ret);
        });
    }

    @PluginMethod
    public void getHealthConnectSteps(final PluginCall call) {
        int status = HealthConnectBridge.sdkStatus(getContext());
        if (status != 1) {
            call.reject("HC_UNAVAILABLE");
            return;
        }
        HealthConnectBridge.readTodaySteps(getContext(), (steps, error) -> {
            if (error != null) {
                if ("NO_PERMISSION".equals(error)) {
                    call.reject("NO_PERMISSION");
                } else {
                    call.reject(error);
                }
                return;
            }
            JSObject ret = new JSObject();
            ret.put("supported", true);
            ret.put("steps", steps == null ? 0 : steps.intValue());
            ret.put("date", today());
            ret.put("source", "health_connect");
            call.resolve(ret);
        });
    }

    @PluginMethod
    public void openHealthConnectSettings(PluginCall call) {
        try {
            Intent intent = new Intent("androidx.health.ACTION_HEALTH_CONNECT_SETTINGS");
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            try {
                Intent play = new Intent(Intent.ACTION_VIEW);
                play.setData(android.net.Uri.parse("market://details?id=com.google.android.apps.healthdata"));
                play.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(play);
                call.resolve();
            } catch (Exception e2) {
                call.reject("COULD_NOT_OPEN_SETTINGS");
            }
        }
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
