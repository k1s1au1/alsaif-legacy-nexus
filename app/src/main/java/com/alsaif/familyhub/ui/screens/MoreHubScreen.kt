package com.alsaif.familyhub.ui.screens

import android.net.Uri
import android.widget.Toast
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.alsaif.familyhub.data.model.FamilyMember
import com.alsaif.familyhub.data.model.FamilyTask
import com.alsaif.familyhub.data.model.Occasion
import com.alsaif.familyhub.ui.AlsaifViewModel
import com.alsaif.familyhub.ui.components.EmptyStateView
import com.alsaif.familyhub.ui.theme.*
import com.alsaif.familyhub.util.InvitationCardHelper
import kotlinx.coroutines.launch

@Composable
fun MoreHubScreen(
    viewModel: AlsaifViewModel,
    modifier: Modifier = Modifier
) {
    var selectedSection by remember { mutableIntStateOf(0) }
    var showAddTaskDialog by remember { mutableStateOf(false) }
    var showAddOccasionDialog by remember { mutableStateOf(false) }
    var viewingOccasionCard by remember { mutableStateOf<Occasion?>(null) }

    val tasks by viewModel.tasks.collectAsState()
    val occasions by viewModel.occasions.collectAsState()
    val members by viewModel.members.collectAsState()

    Scaffold(
        modifier = modifier.testTag("more_hub_screen"),
        floatingActionButton = {
            if (selectedSection == 0 || selectedSection == 1) {
                FloatingActionButton(
                    onClick = {
                        if (selectedSection == 0) showAddTaskDialog = true else showAddOccasionDialog = true
                    },
                    containerColor = EmeraldPrimary,
                    contentColor = SurfaceWhite,
                    shape = CircleShape,
                    modifier = Modifier.testTag("more_add_fab")
                ) {
                    Icon(
                        imageVector = if (selectedSection == 0) Icons.Default.AddTask else Icons.Default.CardGiftcard,
                        contentDescription = "إضافة"
                    )
                }
            }
        }
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .background(MaterialTheme.colorScheme.background)
        ) {
            // Tabs
            Surface(
                modifier = Modifier.fillMaxWidth(),
                color = MaterialTheme.colorScheme.surface,
                shadowElevation = 2.dp
            ) {
                TabRow(
                    selectedTabIndex = selectedSection,
                    containerColor = MaterialTheme.colorScheme.surface,
                    contentColor = EmeraldPrimary
                ) {
                    Tab(
                        selected = selectedSection == 0,
                        onClick = { selectedSection = 0 },
                        text = { Text("المهام (${tasks.count { !it.isCompleted }})", fontWeight = FontWeight.Bold) },
                        icon = { Icon(Icons.Default.AssignmentTurnedIn, contentDescription = null) }
                    )
                    Tab(
                        selected = selectedSection == 1,
                        onClick = { selectedSection = 1 },
                        text = { Text("المناسبات (${occasions.size})", fontWeight = FontWeight.Bold) },
                        icon = { Icon(Icons.Default.Celebration, contentDescription = null) }
                    )
                    Tab(
                        selected = selectedSection == 2,
                        onClick = { selectedSection = 2 },
                        text = { Text("الشجرة (${members.size})", fontWeight = FontWeight.Bold) },
                        icon = { Icon(Icons.Default.AccountTree, contentDescription = null) }
                    )
                }
            }

            when (selectedSection) {
                0 -> TasksView(
                    tasks = tasks,
                    onToggleTask = { viewModel.toggleTask(it) }
                )
                1 -> OccasionsView(
                    occasions = occasions,
                    onViewCard = { viewingOccasionCard = it }
                )
                2 -> FamilyTreeView(members = members)
            }
        }
    }

    if (showAddTaskDialog) {
        AddTaskDialog(
            onDismiss = { showAddTaskDialog = false },
            onConfirm = { title, desc, assigned, due, priority ->
                viewModel.createTask(title, desc, assigned, due, priority)
                showAddTaskDialog = false
            }
        )
    }

    if (showAddOccasionDialog) {
        AddOccasionDialog(
            onDismiss = { showAddOccasionDialog = false },
            onConfirm = { type, title, person, date, loc, bless ->
                viewModel.createOccasion(type, title, person, date, loc, bless)
                showAddOccasionDialog = false
            }
        )
    }

    viewingOccasionCard?.let { occasion ->
        OccasionDetailDialog(
            occasion = occasion,
            onDismiss = { viewingOccasionCard = null }
        )
    }
}

@Composable
fun TasksView(
    tasks: List<FamilyTask>,
    onToggleTask: (FamilyTask) -> Unit
) {
    if (tasks.isEmpty()) {
        EmptyStateView(
            message = "لا توجد مهام مسندة حالياً",
            icon = Icons.Default.Task,
            modifier = Modifier.fillMaxSize()
        )
    } else {
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            items(tasks, key = { it.id }) { task ->
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(14.dp),
                    colors = CardDefaults.cardColors(
                        containerColor = if (task.isCompleted) IvoryBackground else MaterialTheme.colorScheme.surface
                    ),
                    border = BorderStroke(1.dp, SurfaceCardBorder),
                    elevation = CardDefaults.cardElevation(defaultElevation = if (task.isCompleted) 0.dp else 1.dp)
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(14.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Checkbox(
                            checked = task.isCompleted,
                            onCheckedChange = { onToggleTask(task) },
                            colors = CheckboxDefaults.colors(
                                checkedColor = EmeraldPrimary,
                                uncheckedColor = TextSecondary
                            )
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Column(modifier = Modifier.weight(1f)) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = task.title,
                                    style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold),
                                    color = if (task.isCompleted) TextSecondary else MaterialTheme.colorScheme.onSurface
                                )
                                Box(
                                    modifier = Modifier
                                        .clip(RoundedCornerShape(6.dp))
                                        .background(
                                            when (task.priority) {
                                                "عاجلة" -> StatusError.copy(alpha = 0.12f)
                                                "عالية" -> StatusWarning.copy(alpha = 0.12f)
                                                else -> EmeraldContainer
                                            }
                                        )
                                        .padding(horizontal = 6.dp, vertical = 2.dp)
                                ) {
                                    Text(
                                        text = task.priority,
                                        style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold),
                                        color = when (task.priority) {
                                            "عاجلة" -> StatusError
                                            "عالية" -> StatusWarning
                                            else -> EmeraldPrimary
                                        }
                                    )
                                }
                            }

                            if (task.description.isNotBlank()) {
                                Spacer(modifier = Modifier.height(4.dp))
                                Text(
                                    text = task.description,
                                    style = MaterialTheme.typography.bodySmall,
                                    color = TextSecondary
                                )
                            }

                            Spacer(modifier = Modifier.height(6.dp))
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(
                                    imageVector = Icons.Default.Person,
                                    contentDescription = null,
                                    tint = TextLightMuted,
                                    modifier = Modifier.size(14.dp)
                                )
                                Spacer(modifier = Modifier.width(4.dp))
                                Text(
                                    text = task.assignedTo,
                                    style = MaterialTheme.typography.labelSmall,
                                    color = TextLightMuted
                                )
                                Spacer(modifier = Modifier.width(12.dp))
                                Icon(
                                    imageVector = Icons.Default.AccessTime,
                                    contentDescription = null,
                                    tint = TextLightMuted,
                                    modifier = Modifier.size(14.dp)
                                )
                                Spacer(modifier = Modifier.width(4.dp))
                                Text(
                                    text = task.dueDate,
                                    style = MaterialTheme.typography.labelSmall,
                                    color = TextLightMuted
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun OccasionsView(
    occasions: List<Occasion>,
    onViewCard: (Occasion) -> Unit
) {
    if (occasions.isEmpty()) {
        EmptyStateView(
            message = "لا توجد مناسبات مسجلة حالياً",
            icon = Icons.Default.Celebration,
            modifier = Modifier.fillMaxSize()
        )
    } else {
        val context = LocalContext.current
        val coroutineScope = rememberCoroutineScope()

        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            items(occasions, key = { it.id }) { item ->
                var isCardDownloading by remember { mutableStateOf(false) }

                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { onViewCard(item) }
                        .testTag("occasion_card_${item.id}"),
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    border = BorderStroke(1.dp, GoldAccent.copy(alpha = 0.5f)),
                    elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(8.dp))
                                    .background(GoldContainer)
                                    .padding(horizontal = 8.dp, vertical = 4.dp)
                            ) {
                                Text(
                                    text = when (item.type) {
                                        "wedding" -> "عقد قران وزفاف"
                                        "newborn" -> "مولود جديد"
                                        "graduation" -> "تخرج ونجاح"
                                        else -> "مناسبة عائلية"
                                    },
                                    style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold),
                                    color = GoldDark
                                )
                            }
                            Text(
                                text = item.date,
                                style = MaterialTheme.typography.bodySmall,
                                color = TextSecondary
                            )
                        }

                        Spacer(modifier = Modifier.height(10.dp))

                        Text(
                            text = item.title,
                            style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                            color = MaterialTheme.colorScheme.onSurface
                        )

                        Spacer(modifier = Modifier.height(4.dp))

                        Text(
                            text = "المحتفى به: ${item.personName}",
                            style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.SemiBold),
                            color = EmeraldPrimary
                        )

                        Spacer(modifier = Modifier.height(8.dp))

                        // Luxury Traditional Blessing Card
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(10.dp))
                                .background(EmeraldContainer.copy(alpha = 0.5f))
                                .padding(12.dp)
                        ) {
                            Text(
                                text = item.blessingText,
                                style = MaterialTheme.typography.bodyMedium,
                                color = EmeraldDark,
                                lineHeight = 22.sp
                            )
                        }

                        if (item.location.isNotBlank()) {
                            Spacer(modifier = Modifier.height(8.dp))
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(
                                    imageVector = Icons.Default.Place,
                                    contentDescription = null,
                                    tint = GoldAccent,
                                    modifier = Modifier.size(16.dp)
                                )
                                Spacer(modifier = Modifier.width(6.dp))
                                Text(
                                    text = item.location,
                                    style = MaterialTheme.typography.bodySmall,
                                    color = TextSecondary
                                )
                            }
                        }

                        Spacer(modifier = Modifier.height(12.dp))
                        HorizontalDivider(color = GoldAccent.copy(alpha = 0.25f), thickness = 1.dp)
                        Spacer(modifier = Modifier.height(10.dp))

                        // Card Actions: View Card & Quick Download
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Button(
                                onClick = { onViewCard(item) },
                                modifier = Modifier
                                    .weight(1f)
                                    .testTag("view_occasion_button_${item.id}"),
                                colors = ButtonDefaults.buttonColors(
                                    containerColor = EmeraldPrimary,
                                    contentColor = SurfaceWhite
                                ),
                                shape = RoundedCornerShape(10.dp),
                                contentPadding = PaddingValues(vertical = 8.dp, horizontal = 12.dp)
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Visibility,
                                    contentDescription = null,
                                    modifier = Modifier.size(18.dp)
                                )
                                Spacer(modifier = Modifier.width(6.dp))
                                Text("عرض بطاقة الدعوة", fontSize = 13.sp, fontWeight = FontWeight.Bold)
                            }

                            FilledTonalButton(
                                onClick = {
                                    if (!isCardDownloading) {
                                        coroutineScope.launch {
                                            isCardDownloading = true
                                            val bitmap = InvitationCardHelper.generateInvitationBitmap(context, item)
                                            val uri = InvitationCardHelper.saveBitmapToGallery(context, bitmap, item.title)
                                            isCardDownloading = false
                                            if (uri != null) {
                                                Toast.makeText(
                                                    context,
                                                    "تم حفظ بطاقة الدعوة بنجاح في معرض الصور",
                                                    Toast.LENGTH_LONG
                                                ).show()
                                            } else {
                                                Toast.makeText(
                                                    context,
                                                    "تعذر حفظ بطاقة الدعوة، يرجى المحاولة لاحقاً",
                                                    Toast.LENGTH_SHORT
                                                ).show()
                                            }
                                        }
                                    }
                                },
                                modifier = Modifier.testTag("download_occasion_button_${item.id}"),
                                colors = ButtonDefaults.filledTonalButtonColors(
                                    containerColor = GoldContainer,
                                    contentColor = GoldDark
                                ),
                                shape = RoundedCornerShape(10.dp),
                                contentPadding = PaddingValues(vertical = 8.dp, horizontal = 12.dp),
                                enabled = !isCardDownloading
                            ) {
                                if (isCardDownloading) {
                                    CircularProgressIndicator(
                                        modifier = Modifier.size(16.dp),
                                        color = GoldDark,
                                        strokeWidth = 2.dp
                                    )
                                } else {
                                    Icon(
                                        imageVector = Icons.Default.Download,
                                        contentDescription = "تحميل البطاقة",
                                        modifier = Modifier.size(18.dp)
                                    )
                                }
                                Spacer(modifier = Modifier.width(4.dp))
                                Text("تحميل", fontSize = 13.sp, fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun OccasionDetailDialog(
    occasion: Occasion,
    onDismiss: () -> Unit
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()
    var isSaving by remember { mutableStateOf(false) }
    var isSaved by remember { mutableStateOf(false) }
    var savedUri by remember { mutableStateOf<Uri?>(null) }

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
        Surface(
            modifier = Modifier
                .fillMaxWidth(0.94f)
                .wrapContentHeight()
                .padding(vertical = 16.dp)
                .testTag("occasion_detail_window"),
            shape = RoundedCornerShape(24.dp),
            color = MaterialTheme.colorScheme.surface,
            tonalElevation = 6.dp,
            shadowElevation = 8.dp
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState())
                    .padding(16.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                // Window Header
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            modifier = Modifier
                                .size(36.dp)
                                .clip(CircleShape)
                                .background(GoldContainer),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.CardGiftcard,
                                contentDescription = null,
                                tint = GoldDark,
                                modifier = Modifier.size(20.dp)
                            )
                        }
                        Spacer(modifier = Modifier.width(10.dp))
                        Column {
                            Text(
                                text = "بطاقة الدعوة الرسمية",
                                style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                                color = MaterialTheme.colorScheme.onSurface
                            )
                            Text(
                                text = "عائلة السيف المباركة",
                                style = MaterialTheme.typography.bodySmall,
                                color = TextSecondary
                            )
                        }
                    }

                    IconButton(
                        onClick = onDismiss,
                        modifier = Modifier.testTag("close_occasion_dialog")
                    ) {
                        Icon(
                            imageVector = Icons.Default.Close,
                            contentDescription = "إغلاق",
                            tint = TextSecondary
                        )
                    }
                }

                Spacer(modifier = Modifier.height(14.dp))

                // The Royal Invitation Card Design
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .testTag("invitation_card_preview"),
                    shape = RoundedCornerShape(18.dp),
                    colors = CardDefaults.cardColors(containerColor = EmeraldDark),
                    border = BorderStroke(2.dp, GoldAccent)
                ) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(
                                Brush.verticalGradient(
                                    colors = listOf(
                                        EmeraldDark,
                                        EmeraldPrimary,
                                        EmeraldDark
                                    )
                                )
                            )
                            .padding(18.dp)
                    ) {
                        Column(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            // Bismillah
                            Text(
                                text = "بِسْمِ اللَّـهِ الرَّحْمَـٰنِ الرَّحِيمِ",
                                style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold),
                                color = GoldLight,
                                textAlign = TextAlign.Center
                            )

                            Spacer(modifier = Modifier.height(8.dp))

                            // Decorative Divider
                            Row(
                                modifier = Modifier.fillMaxWidth(0.65f),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.Center
                            ) {
                                HorizontalDivider(modifier = Modifier.weight(1f), color = GoldAccent.copy(alpha = 0.6f))
                                Box(
                                    modifier = Modifier
                                        .padding(horizontal = 6.dp)
                                        .size(8.dp)
                                        .clip(CircleShape)
                                        .background(GoldAccent)
                                )
                                HorizontalDivider(modifier = Modifier.weight(1f), color = GoldAccent.copy(alpha = 0.6f))
                            }

                            Spacer(modifier = Modifier.height(10.dp))

                            Text(
                                text = "مجلس عائلة السيف المباركة",
                                style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.ExtraBold),
                                color = SurfaceWhite,
                                textAlign = TextAlign.Center
                            )

                            Spacer(modifier = Modifier.height(8.dp))

                            // Badge
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(8.dp))
                                    .background(GoldDark.copy(alpha = 0.35f))
                                    .border(1.dp, GoldAccent, RoundedCornerShape(8.dp))
                                    .padding(horizontal = 12.dp, vertical = 4.dp)
                            ) {
                                Text(
                                    text = when (occasion.type) {
                                        "wedding" -> "عقد قران وزفاف مبارك"
                                        "newborn" -> "بشارة مولود جديد"
                                        "graduation" -> "تهنئة تخرج ونجاح"
                                        else -> "دعـوة وبطـاقـة تهنئـة"
                                    },
                                    style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold),
                                    color = GoldLight
                                )
                            }

                            Spacer(modifier = Modifier.height(14.dp))

                            // Main Title
                            Text(
                                text = occasion.title,
                                style = MaterialTheme.typography.titleLarge.copy(
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 20.sp
                                ),
                                color = SurfaceWhite,
                                textAlign = TextAlign.Center
                            )

                            Spacer(modifier = Modifier.height(10.dp))

                            // Honored Person Box
                            Surface(
                                shape = RoundedCornerShape(10.dp),
                                color = SurfaceWhite.copy(alpha = 0.12f),
                                border = BorderStroke(1.dp, GoldLight.copy(alpha = 0.6f))
                            ) {
                                Text(
                                    text = "المحتفى به: ${occasion.personName}",
                                    style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Bold),
                                    color = GoldLight,
                                    modifier = Modifier.padding(horizontal = 14.dp, vertical = 6.dp)
                                )
                            }

                            Spacer(modifier = Modifier.height(14.dp))

                            // Blessing Card
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clip(RoundedCornerShape(12.dp))
                                    .background(EmeraldDark.copy(alpha = 0.65f))
                                    .border(1.dp, GoldAccent.copy(alpha = 0.4f), RoundedCornerShape(12.dp))
                                    .padding(14.dp)
                            ) {
                                Text(
                                    text = "« ${occasion.blessingText} »",
                                    style = MaterialTheme.typography.bodyMedium.copy(lineHeight = 22.sp),
                                    color = EmeraldContainer,
                                    textAlign = TextAlign.Center,
                                    modifier = Modifier.fillMaxWidth()
                                )
                            }

                            Spacer(modifier = Modifier.height(14.dp))

                            // Date & Location
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                // Date
                                Box(
                                    modifier = Modifier
                                        .weight(1f)
                                        .clip(RoundedCornerShape(10.dp))
                                        .background(SurfaceWhite.copy(alpha = 0.08f))
                                        .border(1.dp, GoldAccent.copy(alpha = 0.3f), RoundedCornerShape(10.dp))
                                        .padding(8.dp),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                        Row(verticalAlignment = Alignment.CenterVertically) {
                                            Icon(
                                                imageVector = Icons.Default.CalendarToday,
                                                contentDescription = null,
                                                tint = GoldAccent,
                                                modifier = Modifier.size(14.dp)
                                            )
                                            Spacer(modifier = Modifier.width(4.dp))
                                            Text(
                                                text = "التاريخ",
                                                style = MaterialTheme.typography.labelSmall,
                                                color = GoldLight
                                            )
                                        }
                                        Spacer(modifier = Modifier.height(2.dp))
                                        Text(
                                            text = occasion.date,
                                            style = MaterialTheme.typography.bodySmall.copy(fontWeight = FontWeight.SemiBold),
                                            color = SurfaceWhite
                                        )
                                    }
                                }

                                // Location
                                Box(
                                    modifier = Modifier
                                        .weight(1f)
                                        .clip(RoundedCornerShape(10.dp))
                                        .background(SurfaceWhite.copy(alpha = 0.08f))
                                        .border(1.dp, GoldAccent.copy(alpha = 0.3f), RoundedCornerShape(10.dp))
                                        .padding(8.dp),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                        Row(verticalAlignment = Alignment.CenterVertically) {
                                            Icon(
                                                imageVector = Icons.Default.Place,
                                                contentDescription = null,
                                                tint = GoldAccent,
                                                modifier = Modifier.size(14.dp)
                                            )
                                            Spacer(modifier = Modifier.width(4.dp))
                                            Text(
                                                text = "المكان",
                                                style = MaterialTheme.typography.labelSmall,
                                                color = GoldLight
                                            )
                                        }
                                        Spacer(modifier = Modifier.height(2.dp))
                                        Text(
                                            text = if (occasion.location.isNotBlank()) occasion.location else "ديوانية العائلة",
                                            style = MaterialTheme.typography.bodySmall.copy(fontWeight = FontWeight.SemiBold),
                                            color = SurfaceWhite,
                                            maxLines = 1
                                        )
                                    }
                                }
                            }

                            Spacer(modifier = Modifier.height(14.dp))

                            Text(
                                text = "حضوركم شرف لنا ومشاركتكم تزيدنا بهجة وسروراً",
                                style = MaterialTheme.typography.labelSmall,
                                color = GoldLight.copy(alpha = 0.9f),
                                textAlign = TextAlign.Center
                            )

                            Spacer(modifier = Modifier.height(4.dp))

                            Text(
                                text = "مجلس إدارة ملتقى عائلة السيف المباركة",
                                style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold),
                                color = EmeraldContainer.copy(alpha = 0.8f),
                                textAlign = TextAlign.Center
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(18.dp))

                // Prominent Download Button to save card directly to gallery
                Button(
                    onClick = {
                        coroutineScope.launch {
                            isSaving = true
                            val bitmap = InvitationCardHelper.generateInvitationBitmap(context, occasion)
                            val uri = InvitationCardHelper.saveBitmapToGallery(context, bitmap, occasion.title)
                            isSaving = false
                            if (uri != null) {
                                savedUri = uri
                                isSaved = true
                                Toast.makeText(
                                    context,
                                    "تم حفظ بطاقة الدعوة بنجاح في معرض الصور",
                                    Toast.LENGTH_LONG
                                ).show()
                            } else {
                                Toast.makeText(
                                    context,
                                    "تعذر حفظ بطاقة الدعوة، يرجى المحاولة لاحقاً",
                                    Toast.LENGTH_SHORT
                                ).show()
                            }
                        }
                    },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(52.dp)
                        .testTag("download_card_button"),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = if (isSaved) StatusSuccess else EmeraldPrimary,
                        contentColor = SurfaceWhite
                    ),
                    shape = RoundedCornerShape(12.dp),
                    enabled = !isSaving
                ) {
                    if (isSaving) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(20.dp),
                            color = SurfaceWhite,
                            strokeWidth = 2.dp
                        )
                        Spacer(modifier = Modifier.width(10.dp))
                        Text("جارٍ حفظ البطاقة في المعرض...", fontWeight = FontWeight.Bold)
                    } else if (isSaved) {
                        Icon(
                            imageVector = Icons.Default.CheckCircle,
                            contentDescription = null,
                            modifier = Modifier.size(22.dp)
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("تم الحفظ في معرض الصور بنجاح ✓", fontWeight = FontWeight.Bold)
                    } else {
                        Icon(
                            imageVector = Icons.Default.Download,
                            contentDescription = "تحميل",
                            modifier = Modifier.size(22.dp)
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("تحميل بطاقة الدعوة في المعرض", fontWeight = FontWeight.Bold)
                    }
                }

                Spacer(modifier = Modifier.height(10.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    OutlinedButton(
                        onClick = {
                            InvitationCardHelper.shareInvitation(context, occasion, savedUri)
                        },
                        modifier = Modifier
                            .weight(1f)
                            .testTag("share_card_button"),
                        shape = RoundedCornerShape(12.dp),
                        border = BorderStroke(1.dp, EmeraldPrimary)
                    ) {
                        Icon(
                            imageVector = Icons.Default.Share,
                            contentDescription = "مشاركة",
                            tint = EmeraldPrimary,
                            modifier = Modifier.size(18.dp)
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("مشاركة", color = EmeraldPrimary)
                    }

                    TextButton(
                        onClick = onDismiss,
                        modifier = Modifier
                            .weight(1f)
                            .testTag("dismiss_dialog_button"),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Text("إغلاق", color = TextSecondary)
                    }
                }
            }
        }
    }
}

@Composable
fun FamilyTreeView(members: List<FamilyMember>) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = EmeraldPrimary)
            ) {
                Column(modifier = Modifier.padding(18.dp)) {
                    Text(
                        text = "مشجّر عائلة السيف المباركة",
                        style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                        color = SurfaceWhite
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = "توثيق الأنساب والفروع المتصلة عبر الأجيال المتعاقبة",
                        style = MaterialTheme.typography.bodySmall,
                        color = GoldLight
                    )
                }
            }
        }

        val groupedByBranch = members.groupBy { it.branch }

        groupedByBranch.forEach { (branch, branchMembers) ->
            item {
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = branch,
                    style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                    color = MaterialTheme.colorScheme.onBackground,
                    modifier = Modifier.padding(horizontal = 4.dp)
                )
            }

            items(branchMembers, key = { it.id }) { member ->
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    border = BorderStroke(1.dp, SurfaceCardBorder)
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Box(
                                modifier = Modifier
                                    .size(38.dp)
                                    .clip(CircleShape)
                                    .background(GoldContainer),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    text = member.name.take(1),
                                    color = GoldDark,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                            Spacer(modifier = Modifier.width(10.dp))
                            Column {
                                Text(
                                    text = member.name,
                                    style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold),
                                    color = MaterialTheme.colorScheme.onSurface
                                )
                                Text(
                                    text = "${member.role} • الجيل ${member.generation}",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = TextSecondary
                                )
                            }
                        }

                        if (member.phone.isNotBlank()) {
                            Icon(
                                imageVector = Icons.Default.Phone,
                                contentDescription = "اتصال",
                                tint = EmeraldPrimary,
                                modifier = Modifier.size(20.dp)
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun AddTaskDialog(
    onDismiss: () -> Unit,
    onConfirm: (String, String, String, String, String) -> Unit
) {
    var title by remember { mutableStateOf("") }
    var desc by remember { mutableStateOf("") }
    var assignedTo by remember { mutableStateOf("") }
    var dueDate by remember { mutableStateOf("") }
    var priority by remember { mutableStateOf("متوسطة") }

    val priorities = listOf("عاجلة", "عالية", "متوسطة", "عادية")

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("إسناد مهمة جديدة", fontWeight = FontWeight.Bold) },
        text = {
            Column(
                modifier = Modifier.fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                OutlinedTextField(
                    value = title,
                    onValueChange = { title = it },
                    label = { Text("عنوان المهمة") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                OutlinedTextField(
                    value = assignedTo,
                    onValueChange = { assignedTo = it },
                    label = { Text("المسند إليه") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                OutlinedTextField(
                    value = dueDate,
                    onValueChange = { dueDate = it },
                    label = { Text("الموعد النهائي (تاريخ الإنجاز)") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )

                Text("الأولوية:", style = MaterialTheme.typography.labelMedium)
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    priorities.forEach { p ->
                        FilterChip(
                            selected = priority == p,
                            onClick = { priority = p },
                            label = { Text(p, fontSize = 12.sp) }
                        )
                    }
                }

                OutlinedTextField(
                    value = desc,
                    onValueChange = { desc = it },
                    label = { Text("تفاصيل المهمة") },
                    maxLines = 3,
                    modifier = Modifier.fillMaxWidth()
                )
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    if (title.isNotBlank()) {
                        onConfirm(title, desc, assignedTo, dueDate, priority)
                    }
                },
                enabled = title.isNotBlank(),
                colors = ButtonDefaults.buttonColors(containerColor = EmeraldPrimary)
            ) {
                Text("إسناد المهمة")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("إلغاء") }
        }
    )
}

@Composable
fun AddOccasionDialog(
    onDismiss: () -> Unit,
    onConfirm: (String, String, String, String, String, String) -> Unit
) {
    var type by remember { mutableStateOf("wedding") }
    var title by remember { mutableStateOf("") }
    var personName by remember { mutableStateOf("") }
    var date by remember { mutableStateOf("") }
    var location by remember { mutableStateOf("") }
    var blessing by remember { mutableStateOf("") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("إضافة مناسبة عائلية", fontWeight = FontWeight.Bold) },
        text = {
            Column(
                modifier = Modifier.fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                OutlinedTextField(
                    value = title,
                    onValueChange = { title = it },
                    label = { Text("عنوان المناسبة (مثال: زواج نجل الشيخ فهد)") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                OutlinedTextField(
                    value = personName,
                    onValueChange = { personName = it },
                    label = { Text("اسم المحتفى به / العروسين") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                OutlinedTextField(
                    value = date,
                    onValueChange = { date = it },
                    label = { Text("التاريخ") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                OutlinedTextField(
                    value = location,
                    onValueChange = { location = it },
                    label = { Text("المكان") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                OutlinedTextField(
                    value = blessing,
                    onValueChange = { blessing = it },
                    label = { Text("نص التهنئة والدعاء") },
                    maxLines = 3,
                    modifier = Modifier.fillMaxWidth()
                )
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    if (title.isNotBlank()) {
                        onConfirm(type, title, personName, date, location, blessing)
                    }
                },
                enabled = title.isNotBlank(),
                colors = ButtonDefaults.buttonColors(containerColor = EmeraldPrimary)
            ) {
                Text("نشر المناسبة")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("إلغاء") }
        }
    )
}
