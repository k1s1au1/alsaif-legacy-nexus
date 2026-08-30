package com.alsaif.familyhub

import android.content.Context
import android.content.Intent
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.health.connect.client.aggregate.AggregationResult
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.request.AggregateRequest
import androidx.health.connect.client.time.TimeRangeFilter
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.LocalDateTime

/**
 * Kotlin bridge for Health Connect. Reads step totals written by any connected
 * health app (Google Fit, Samsung Health, Huawei Health, ...) once the user has
 * granted the READ_STEPS permission inside Health Connect.
 */
fun interface BoolCallback {
    fun onResult(granted: Boolean, error: String?)
}

fun interface StepsCallback {
    fun onResult(steps: Long?, error: String?)
}

object HealthConnectBridge {

    private const val PROVIDER = "com.google.android.apps.healthdata"

    private val readPermissions = setOf(HealthPermission.getReadPermission(StepsRecord::class))

    /** 1 = available, 2 = update required, 3 = not installed. */
    @JvmStatic
    fun sdkStatus(context: Context): Int = try {
        HealthConnectClient.getSdkStatus(context, PROVIDER)
    } catch (e: Throwable) {
        3
    }

    @JvmStatic
    fun isAvailable(context: Context): Boolean = sdkStatus(context) == HealthConnectClient.SDK_AVAILABLE

    /** Intent that opens the Health Connect permission sheet for step reading. */
    @JvmStatic
    fun permissionIntent(context: Context): Intent =
        PermissionController.createRequestPermissionResultContract()
            .createIntent(context, readPermissions)

    @JvmStatic
    fun hasPermission(context: Context, callback: BoolCallback) {
        if (!isAvailable(context)) {
            callback.onResult(false, "HC_UNAVAILABLE")
            return
        }
        CoroutineScope(Dispatchers.Main).launch {
            try {
                val client = HealthConnectClient.getOrCreate(context, PROVIDER)
                val granted = client.permissionController.getGrantedPermissions()
                callback.onResult(granted.containsAll(readPermissions), null)
            } catch (e: Throwable) {
                callback.onResult(false, e.message)
            }
        }
    }

    /** Reads the aggregated step count for today from Health Connect. */
    @JvmStatic
    fun readTodaySteps(context: Context, callback: StepsCallback) {
        if (!isAvailable(context)) {
            callback.onResult(null, "HC_UNAVAILABLE")
            return
        }
        CoroutineScope(Dispatchers.Main).launch {
            try {
                val client = HealthConnectClient.getOrCreate(context, PROVIDER)
                val granted = client.permissionController.getGrantedPermissions()
                if (!granted.containsAll(readPermissions)) {
                    callback.onResult(null, "NO_PERMISSION")
                    return@launch
                }
                val start = LocalDate.now().atStartOfDay()
                val end = LocalDateTime.now()
                val result: AggregationResult = client.aggregate(
                    AggregateRequest(
                        metrics = setOf(StepsRecord.COUNT_TOTAL),
                        timeRangeFilter = TimeRangeFilter.between(start, end),
                    ),
                )
                callback.onResult(result[StepsRecord.COUNT_TOTAL] ?: 0L, null)
            } catch (e: Throwable) {
                callback.onResult(null, e.message ?: "HC_READ_FAILED")
            }
        }
    }
}
