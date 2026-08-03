package com.alsaif.familyhub;

import android.content.Context;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "StepsPlugin")
public class StepsPlugin extends Plugin implements SensorEventListener {
    private SensorManager sensorManager;
    private Sensor stepSensor;
    private int currentSteps = 0;

    @Override
    public void load() {
        sensorManager = (SensorManager) getContext().getSystemService(Context.SENSOR_SERVICE);
        stepSensor = sensorManager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER);
        
        if (stepSensor != null) {
            sensorManager.registerListener(this, stepSensor, SensorManager.SENSOR_DELAY_UI);
        }
    }

    @PluginMethod
    public void getTodaySteps(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("steps", currentSteps);
        call.resolve(ret);
    }

    @PluginMethod
    public void checkHealthConnect(PluginCall call) {
        JSObject ret = new JSObject();
        try {
            int status = androidx.health.connect.client.HealthConnectClient.getSdkStatus(getContext(), "com.google.android.apps.healthdata");
            ret.put("status", status);
            // 1: NOT_INSTALLED, 2: NOT_SUPPORTED, 3: SDK_AVAILABLE
            call.resolve(ret);
        } catch (Exception e) {
            ret.put("status", 2);
            call.resolve(ret);
        }
    }

    @Override
    public void onSensorChanged(SensorEvent event) {
        if (event.sensor.getType() == Sensor.TYPE_STEP_COUNTER) {
            currentSteps = (int) event.values[0];
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
