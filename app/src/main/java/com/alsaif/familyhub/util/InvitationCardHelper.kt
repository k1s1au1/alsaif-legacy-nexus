package com.alsaif.familyhub.util

import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.graphics.*
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import android.text.Layout
import android.text.StaticLayout
import android.text.TextPaint
import com.alsaif.familyhub.data.model.Occasion
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.OutputStream

object InvitationCardHelper {

    /**
     * Generates a high-resolution royal Najdi invitation card bitmap
     * with emerald gradient, gold borders, and Islamic calligraphy.
     */
    fun generateInvitationBitmap(context: Context, occasion: Occasion): Bitmap {
        val width = 1080
        val height = 1560
        val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)

        // 1. Background Gradient (Deep Emerald)
        val bgPaint = Paint().apply {
            shader = LinearGradient(
                0f, 0f, width.toFloat(), height.toFloat(),
                intArrayOf(
                    0xFF022C22.toInt(),
                    0xFF064E3B.toInt(),
                    0xFF022C22.toInt()
                ),
                floatArrayOf(0.0f, 0.45f, 1.0f),
                Shader.TileMode.CLAMP
            )
        }
        canvas.drawRect(0f, 0f, width.toFloat(), height.toFloat(), bgPaint)

        // 2. Outer and Inner Royal Gold Borders
        val outerBorderPaint = Paint().apply {
            color = 0xFFD4AF37.toInt()
            style = Paint.Style.STROKE
            strokeWidth = 6f
            isAntiAlias = true
        }
        val innerBorderPaint = Paint().apply {
            color = 0x88E6C25C.toInt()
            style = Paint.Style.STROKE
            strokeWidth = 2f
            isAntiAlias = true
        }

        val outerMargin = 40f
        canvas.drawRoundRect(
            outerMargin, outerMargin,
            width - outerMargin, height - outerMargin,
            24f, 24f,
            outerBorderPaint
        )

        val innerMargin = 56f
        canvas.drawRoundRect(
            innerMargin, innerMargin,
            width - innerMargin, height - innerMargin,
            16f, 16f,
            innerBorderPaint
        )

        // 3. Corner Ornaments (Traditional Najdi geometric motifs)
        val cornerPaint = Paint().apply {
            color = 0xFFE6C25C.toInt()
            style = Paint.Style.FILL_AND_STROKE
            strokeWidth = 3f
            isAntiAlias = true
        }

        fun drawCornerMotif(cx: Float, cy: Float) {
            val size = 20f
            val path = Path().apply {
                moveTo(cx, cy - size)
                lineTo(cx + size, cy)
                lineTo(cx, cy + size)
                lineTo(cx - size, cy)
                close()
            }
            canvas.drawPath(path, cornerPaint)
        }

        drawCornerMotif(outerMargin + 24f, outerMargin + 24f)
        drawCornerMotif(width - outerMargin - 24f, outerMargin + 24f)
        drawCornerMotif(outerMargin + 24f, height - outerMargin - 24f)
        drawCornerMotif(width - outerMargin - 24f, height - outerMargin - 24f)

        // 4. Bismillah Calligraphy Heading
        val bismillahPaint = TextPaint().apply {
            color = 0xFFE6C25C.toInt()
            textSize = 36f
            isAntiAlias = true
            textAlign = Paint.Align.CENTER
            typeface = Typeface.create(Typeface.SERIF, Typeface.BOLD)
        }
        canvas.drawText("بِسْمِ اللَّـهِ الرَّحْمَـٰنِ الرَّحِيمِ", width / 2f, 130f, bismillahPaint)

        // 5. Ornamental Divider Line
        val dividerPaint = Paint().apply {
            color = 0xCCD4AF37.toInt()
            strokeWidth = 3f
            isAntiAlias = true
        }
        canvas.drawLine(width / 2f - 200f, 160f, width / 2f + 200f, 160f, dividerPaint)
        // Diamond at center of divider
        drawCornerMotif(width / 2f, 160f)

        // 6. Family Crest & Header
        val familyTitlePaint = TextPaint().apply {
            color = 0xFFFFF7E6.toInt()
            textSize = 42f
            isAntiAlias = true
            textAlign = Paint.Align.CENTER
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
        }
        canvas.drawText("مجلس عائلة السيف المباركة", width / 2f, 225f, familyTitlePaint)

        // 7. Occasion Category Badge
        val badgeText = when (occasion.type) {
            "wedding" -> "عقد قران وزفاف مبارك"
            "newborn" -> "بشارة مولود جديد"
            "graduation" -> "تهنئة تخرج ونجاح"
            else -> "دعـوة وبطـاقـة تهنئـة"
        }
        val badgeRectPaint = Paint().apply {
            color = 0x33D4AF37.toInt()
            style = Paint.Style.FILL
            isAntiAlias = true
        }
        val badgeBorderPaint = Paint().apply {
            color = 0xFFD4AF37.toInt()
            style = Paint.Style.STROKE
            strokeWidth = 2f
            isAntiAlias = true
        }
        val badgeTextPaint = TextPaint().apply {
            color = 0xFFFFD770.toInt()
            textSize = 30f
            isAntiAlias = true
            textAlign = Paint.Align.CENTER
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
        }
        val badgeY = 270f
        val badgeWidth = 360f
        val badgeHeight = 54f
        canvas.drawRoundRect(
            width / 2f - badgeWidth / 2f, badgeY,
            width / 2f + badgeWidth / 2f, badgeY + badgeHeight,
            12f, 12f, badgeRectPaint
        )
        canvas.drawRoundRect(
            width / 2f - badgeWidth / 2f, badgeY,
            width / 2f + badgeWidth / 2f, badgeY + badgeHeight,
            12f, 12f, badgeBorderPaint
        )
        canvas.drawText(badgeText, width / 2f, badgeY + 38f, badgeTextPaint)

        // 8. Main Occasion Title
        val titlePaint = TextPaint().apply {
            color = 0xFFFFFFFF.toInt()
            textSize = 48f
            isAntiAlias = true
            textAlign = Paint.Align.CENTER
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
            setShadowLayer(6f, 0f, 3f, 0xAA000000.toInt())
        }

        val titleLayout = StaticLayout.Builder.obtain(
            occasion.title, 0, occasion.title.length, titlePaint, width - 180
        )
            .setAlignment(Layout.Alignment.ALIGN_CENTER)
            .setLineSpacing(0f, 1.2f)
            .build()

        canvas.save()
        canvas.translate(width / 2f, 370f)
        titleLayout.draw(canvas)
        canvas.restore()

        var currentY = 370f + titleLayout.height + 30f

        // 9. Honored Person Banner
        val personBgPaint = Paint().apply {
            color = 0x22FFFFFF.toInt()
            style = Paint.Style.FILL
            isAntiAlias = true
        }
        val personBorderPaint = Paint().apply {
            color = 0x88D4AF37.toInt()
            style = Paint.Style.STROKE
            strokeWidth = 2f
            isAntiAlias = true
        }
        val personBannerHeight = 70f
        canvas.drawRoundRect(
            120f, currentY,
            width - 120f, currentY + personBannerHeight,
            16f, 16f, personBgPaint
        )
        canvas.drawRoundRect(
            120f, currentY,
            width - 120f, currentY + personBannerHeight,
            16f, 16f, personBorderPaint
        )

        val personPaint = TextPaint().apply {
            color = 0xFFFFD770.toInt()
            textSize = 34f
            isAntiAlias = true
            textAlign = Paint.Align.CENTER
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
        }
        canvas.drawText("المحتفى به: ${occasion.personName}", width / 2f, currentY + 46f, personPaint)

        currentY += personBannerHeight + 35f

        // 10. Blessing Card Box (Parchment styled)
        val blessingBoxPaint = Paint().apply {
            color = 0x44021D17.toInt()
            style = Paint.Style.FILL
            isAntiAlias = true
        }
        val blessingOutlinePaint = Paint().apply {
            color = 0x66E6C25C.toInt()
            style = Paint.Style.STROKE
            strokeWidth = 2f
            isAntiAlias = true
        }

        val blessingTextPaint = TextPaint().apply {
            color = 0xFFE6F4EA.toInt()
            textSize = 32f
            isAntiAlias = true
            textAlign = Paint.Align.CENTER
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.NORMAL)
        }

        val wrappedBlessing = "« ${occasion.blessingText} »"
        val blessingContentWidth = width - 260
        val blessingLayout = StaticLayout.Builder.obtain(
            wrappedBlessing, 0, wrappedBlessing.length, blessingTextPaint, blessingContentWidth
        )
            .setAlignment(Layout.Alignment.ALIGN_CENTER)
            .setLineSpacing(0f, 1.3f)
            .build()

        val blessingBoxHeight = blessingLayout.height + 60f
        canvas.drawRoundRect(
            100f, currentY,
            width - 100f, currentY + blessingBoxHeight,
            18f, 18f, blessingBoxPaint
        )
        canvas.drawRoundRect(
            100f, currentY,
            width - 100f, currentY + blessingBoxHeight,
            18f, 18f, blessingOutlinePaint
        )

        canvas.save()
        canvas.translate(width / 2f, currentY + 30f)
        blessingLayout.draw(canvas)
        canvas.restore()

        currentY += blessingBoxHeight + 40f

        // 11. Date and Location Info Cards
        val detailCardPaint = Paint().apply {
            color = 0x22D4AF37.toInt()
            style = Paint.Style.FILL
            isAntiAlias = true
        }
        val detailBorderPaint = Paint().apply {
            color = 0x88D4AF37.toInt()
            style = Paint.Style.STROKE
            strokeWidth = 1.5f
            isAntiAlias = true
        }
        val detailLabelPaint = TextPaint().apply {
            color = 0xFFD4AF37.toInt()
            textSize = 24f
            isAntiAlias = true
            textAlign = Paint.Align.CENTER
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
        }
        val detailValuePaint = TextPaint().apply {
            color = 0xFFFFFFFF.toInt()
            textSize = 28f
            isAntiAlias = true
            textAlign = Paint.Align.CENTER
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.NORMAL)
        }

        // Date Box
        val boxWidth = (width - 240f) / 2f
        val boxHeight = 100f
        val dateLeft = 100f
        canvas.drawRoundRect(dateLeft, currentY, dateLeft + boxWidth, currentY + boxHeight, 14f, 14f, detailCardPaint)
        canvas.drawRoundRect(dateLeft, currentY, dateLeft + boxWidth, currentY + boxHeight, 14f, 14f, detailBorderPaint)
        canvas.drawText("التاريخ واليوم", dateLeft + boxWidth / 2f, currentY + 36f, detailLabelPaint)
        canvas.drawText(occasion.date, dateLeft + boxWidth / 2f, currentY + 74f, detailValuePaint)

        // Location Box
        val locLeft = width - 100f - boxWidth
        canvas.drawRoundRect(locLeft, currentY, locLeft + boxWidth, currentY + boxHeight, 14f, 14f, detailCardPaint)
        canvas.drawRoundRect(locLeft, currentY, locLeft + boxWidth, currentY + boxHeight, 14f, 14f, detailBorderPaint)
        canvas.drawText("المكان والمقر", locLeft + boxWidth / 2f, currentY + 36f, detailLabelPaint)
        val locText = if (occasion.location.isNotBlank()) occasion.location else "ديوانية عائلة السيف"
        val cleanLoc = if (locText.length > 20) locText.take(18) + "..." else locText
        canvas.drawText(cleanLoc, locLeft + boxWidth / 2f, currentY + 74f, detailValuePaint)

        currentY += boxHeight + 45f

        // 12. Bottom Floral / Geometric Accent
        canvas.drawLine(width / 2f - 180f, currentY, width / 2f + 180f, currentY, dividerPaint)
        drawCornerMotif(width / 2f, currentY)

        currentY += 40f

        // 13. Hospitality Greeting
        val welcomePaint = TextPaint().apply {
            color = 0xFFE6C25C.toInt()
            textSize = 30f
            isAntiAlias = true
            textAlign = Paint.Align.CENTER
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
        }
        canvas.drawText("حضوركم شرف لنا ومشاركتكم تزيدنا بهجة وسروراً", width / 2f, currentY, welcomePaint)

        currentY += 45f

        // 14. Signature / Council Endorsement
        val footerSignPaint = TextPaint().apply {
            color = 0xFFC2DED0.toInt()
            textSize = 24f
            isAntiAlias = true
            textAlign = Paint.Align.CENTER
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.NORMAL)
        }
        canvas.drawText("الداعي: مجلس إدارة ملتقى عائلة السيف المباركة", width / 2f, currentY, footerSignPaint)

        // 15. Seal watermark
        val watermarkPaint = TextPaint().apply {
            color = 0x66D4AF37.toInt()
            textSize = 20f
            isAntiAlias = true
            textAlign = Paint.Align.CENTER
        }
        canvas.drawText("Alsaif Family Hub • منصة عائلة السيف", width / 2f, height - 70f, watermarkPaint)

        return bitmap
    }

    /**
     * Saves the generated invitation bitmap directly into the user's phone photo gallery.
     * Compatible with Android 10+ Scoped Storage (no broad storage permissions required),
     * and supports legacy versions via MediaStore.
     */
    suspend fun saveBitmapToGallery(
        context: Context,
        bitmap: Bitmap,
        occasionTitle: String
    ): Uri? = withContext(Dispatchers.IO) {
        val sanitizedTitle = occasionTitle.replace(Regex("[^a-zA-Z0-9\\u0600-\\u06FF]"), "_")
            .take(30)
            .ifBlank { "بطاقة_دعوة" }
        val filename = "Alsaif_${sanitizedTitle}_${System.currentTimeMillis()}.jpg"

        val contentValues = ContentValues().apply {
            put(MediaStore.Images.Media.DISPLAY_NAME, filename)
            put(MediaStore.Images.Media.MIME_TYPE, "image/jpeg")
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                put(MediaStore.Images.Media.RELATIVE_PATH, "${Environment.DIRECTORY_PICTURES}/AlsaifFamilyHub")
                put(MediaStore.Images.Media.IS_PENDING, 1)
            }
        }

        val resolver = context.contentResolver
        val uri = resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, contentValues)
            ?: return@withContext null

        try {
            resolver.openOutputStream(uri)?.use { stream: OutputStream ->
                val success = bitmap.compress(Bitmap.CompressFormat.JPEG, 95, stream)
                if (!success) {
                    throw IllegalStateException("Failed to compress bitmap to stream")
                }
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                contentValues.clear()
                contentValues.put(MediaStore.Images.Media.IS_PENDING, 0)
                resolver.update(uri, contentValues, null, null)
            }

            uri
        } catch (e: Exception) {
            e.printStackTrace()
            try {
                resolver.delete(uri, null, null)
            } catch (_: Exception) {}
            null
        }
    }

    /**
     * Share invitation text and optionally the image card
     */
    fun shareInvitation(context: Context, occasion: Occasion, imageUri: Uri? = null) {
        val text = buildString {
            appendLine("✨ دعوة مباركة من عائلة السيف ✨")
            appendLine("العنوان: ${occasion.title}")
            appendLine("المحتفى به: ${occasion.personName}")
            appendLine("التاريخ: ${occasion.date}")
            if (occasion.location.isNotBlank()) {
                appendLine("المكان: ${occasion.location}")
            }
            appendLine()
            appendLine("« ${occasion.blessingText} »")
            appendLine()
            append("— مجلس عائلة السيف المباركة")
        }

        val shareIntent = Intent(Intent.ACTION_SEND).apply {
            if (imageUri != null) {
                type = "image/jpeg"
                putExtra(Intent.EXTRA_STREAM, imageUri)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            } else {
                type = "text/plain"
            }
            putExtra(Intent.EXTRA_TEXT, text)
            putExtra(Intent.EXTRA_SUBJECT, occasion.title)
        }

        context.startActivity(Intent.createChooser(shareIntent, "مشاركة بطاقة الدعوة"))
    }
}
