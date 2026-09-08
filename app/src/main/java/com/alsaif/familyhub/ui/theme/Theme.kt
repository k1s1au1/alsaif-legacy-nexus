package com.alsaif.familyhub.ui.theme

import android.app.Activity
import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat

private val LightColorScheme = lightColorScheme(
    primary = EmeraldPrimary,
    onPrimary = SurfaceWhite,
    primaryContainer = EmeraldContainer,
    onPrimaryContainer = OnEmeraldContainer,
    secondary = GoldAccent,
    onSecondary = ObsidianDark,
    secondaryContainer = GoldContainer,
    onSecondaryContainer = GoldDark,
    tertiary = GoldDark,
    background = IvoryBackground,
    onBackground = TextPrimary,
    surface = SurfaceWhite,
    onSurface = TextPrimary,
    surfaceVariant = EmeraldContainer,
    onSurfaceVariant = EmeraldPrimary,
    outline = SurfaceCardBorder
)

private val DarkColorScheme = darkColorScheme(
    primary = GoldAccent,
    onPrimary = ObsidianDark,
    primaryContainer = EmeraldDark,
    onPrimaryContainer = GoldLight,
    secondary = GoldLight,
    onSecondary = ObsidianDark,
    background = ObsidianDark,
    onBackground = SurfaceWhite,
    surface = DarkSurfaceCard,
    onSurface = SurfaceWhite,
    surfaceVariant = DarkSurfaceCard,
    onSurfaceVariant = GoldLight,
    outline = DarkSurfaceBorder
)

@Composable
fun AlsaifTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit
) {
    val colorScheme = if (darkTheme) DarkColorScheme else LightColorScheme

    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as Activity).window
            window.statusBarColor = colorScheme.primary.toArgb()
            WindowCompat.getInsetsController(window, view).isAppearanceLightStatusBars = darkTheme
        }
    }

    MaterialTheme(
        colorScheme = colorScheme,
        content = content
    )
}
