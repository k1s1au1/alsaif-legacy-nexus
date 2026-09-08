package com.alsaif.familyhub.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.alsaif.familyhub.data.model.Meeting
import com.alsaif.familyhub.data.model.Trip
import com.alsaif.familyhub.ui.AlsaifViewModel
import com.alsaif.familyhub.ui.components.EmptyStateView
import com.alsaif.familyhub.ui.theme.*

@Composable
fun MeetingsAndTripsScreen(
    viewModel: AlsaifViewModel,
    modifier: Modifier = Modifier
) {
    var selectedTab by remember { mutableIntStateOf(0) }
    var showAddMeetingDialog by remember { mutableStateOf(false) }
    var showAddTripDialog by remember { mutableStateOf(false) }

    val meetings by viewModel.meetings.collectAsState()
    val trips by viewModel.trips.collectAsState()

    Scaffold(
        modifier = modifier.testTag("meetings_trips_screen"),
        floatingActionButton = {
            FloatingActionButton(
                onClick = {
                    if (selectedTab == 0) showAddMeetingDialog = true else showAddTripDialog = true
                },
                containerColor = EmeraldPrimary,
                contentColor = SurfaceWhite,
                shape = CircleShape,
                modifier = Modifier.testTag("add_event_fab")
            ) {
                Icon(
                    imageVector = if (selectedTab == 0) Icons.Default.AddHomeWork else Icons.Default.AddLocationAlt,
                    contentDescription = if (selectedTab == 0) "إضافة لقاء" else "إضافة رحلة"
                )
            }
        }
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .background(MaterialTheme.colorScheme.background)
        ) {
            // Header & Tabs
            Surface(
                modifier = Modifier.fillMaxWidth(),
                color = MaterialTheme.colorScheme.surface,
                shadowElevation = 2.dp
            ) {
                Column {
                    TabRow(
                        selectedTabIndex = selectedTab,
                        containerColor = MaterialTheme.colorScheme.surface,
                        contentColor = EmeraldPrimary
                    ) {
                        Tab(
                            selected = selectedTab == 0,
                            onClick = { selectedTab = 0 },
                            text = { Text("اللقاءات العائلية (${meetings.size})", fontWeight = FontWeight.Bold) },
                            icon = { Icon(Icons.Default.Groups, contentDescription = null) }
                        )
                        Tab(
                            selected = selectedTab == 1,
                            onClick = { selectedTab = 1 },
                            text = { Text("الرحلات والأنشطة (${trips.size})", fontWeight = FontWeight.Bold) },
                            icon = { Icon(Icons.Default.Explore, contentDescription = null) }
                        )
                    }
                }
            }

            if (selectedTab == 0) {
                // Meetings List
                if (meetings.isEmpty()) {
                    EmptyStateView(
                        message = "لا توجد لقاءات مجدولة حالياً",
                        icon = Icons.Default.EventBusy,
                        modifier = Modifier.weight(1f)
                    )
                } else {
                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(14.dp)
                    ) {
                        items(meetings, key = { it.id }) { meeting ->
                            MeetingCard(
                                meeting = meeting,
                                onRsvpToggle = { viewModel.toggleMeetingAttendance(meeting) }
                            )
                        }
                    }
                }
            } else {
                // Trips List
                if (trips.isEmpty()) {
                    EmptyStateView(
                        message = "لا توجد رحلات معلنة حالياً",
                        icon = Icons.Default.FlightTakeoff,
                        modifier = Modifier.weight(1f)
                    )
                } else {
                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(14.dp)
                    ) {
                        items(trips, key = { it.id }) { trip ->
                            TripCard(
                                trip = trip,
                                onRegisterToggle = { viewModel.toggleTripRegistration(trip) }
                            )
                        }
                    }
                }
            }
        }
    }

    if (showAddMeetingDialog) {
        AddMeetingDialog(
            onDismiss = { showAddMeetingDialog = false },
            onConfirm = { title, date, time, location, desc ->
                viewModel.createMeeting(title, date, time, location, desc)
                showAddMeetingDialog = false
            }
        )
    }

    if (showAddTripDialog) {
        AddTripDialog(
            onDismiss = { showAddTripDialog = false },
            onConfirm = { title, dest, start, end, desc, maxPart ->
                viewModel.createTrip(title, dest, start, end, desc, maxPart)
                showAddTripDialog = false
            }
        )
    }
}

@Composable
fun MeetingCard(
    meeting: Meeting,
    onRsvpToggle: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        border = BorderStroke(1.dp, SurfaceCardBorder),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = meeting.title,
                    style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                    color = MaterialTheme.colorScheme.onSurface,
                    modifier = Modifier.weight(1f)
                )

                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(8.dp))
                        .background(if (meeting.isPast) IvoryBackground else EmeraldContainer)
                        .padding(horizontal = 8.dp, vertical = 4.dp)
                ) {
                    Text(
                        text = if (meeting.isPast) "منقضي" else "قادم",
                        style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold),
                        color = if (meeting.isPast) TextSecondary else EmeraldPrimary
                    )
                }
            }

            Spacer(modifier = Modifier.height(10.dp))

            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    imageVector = Icons.Default.CalendarMonth,
                    contentDescription = null,
                    tint = EmeraldPrimary,
                    modifier = Modifier.size(16.dp)
                )
                Spacer(modifier = Modifier.width(6.dp))
                Text(
                    text = "${meeting.date}  |  ${meeting.time}",
                    style = MaterialTheme.typography.bodySmall,
                    color = TextSecondary
                )
            }

            Spacer(modifier = Modifier.height(4.dp))

            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    imageVector = Icons.Default.Place,
                    contentDescription = null,
                    tint = GoldAccent,
                    modifier = Modifier.size(16.dp)
                )
                Spacer(modifier = Modifier.width(6.dp))
                Text(
                    text = meeting.location,
                    style = MaterialTheme.typography.bodySmall,
                    color = TextSecondary
                )
            }

            if (meeting.description.isNotBlank()) {
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = meeting.description,
                    style = MaterialTheme.typography.bodyMedium,
                    color = TextPrimary
                )
            }

            Spacer(modifier = Modifier.height(14.dp))
            HorizontalDivider(color = SurfaceCardBorder, thickness = 0.5.dp)
            Spacer(modifier = Modifier.height(10.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        imageVector = Icons.Default.PeopleAlt,
                        contentDescription = null,
                        tint = EmeraldPrimary,
                        modifier = Modifier.size(18.dp)
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        text = "${meeting.attendeeCount} فرداً أكدوا الحضور",
                        style = MaterialTheme.typography.labelMedium,
                        color = EmeraldPrimary,
                        fontWeight = FontWeight.SemiBold
                    )
                }

                Button(
                    onClick = onRsvpToggle,
                    colors = ButtonDefaults.buttonColors(
                        containerColor = if (meeting.isAttending) StatusSuccess else EmeraldPrimary
                    ),
                    shape = RoundedCornerShape(10.dp)
                ) {
                    Icon(
                        imageVector = if (meeting.isAttending) Icons.Default.Check else Icons.Default.Add,
                        contentDescription = null,
                        modifier = Modifier.size(16.dp)
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(if (meeting.isAttending) "حاضر" else "تأكيد الحضور")
                }
            }
        }
    }
}

@Composable
fun TripCard(
    trip: Trip,
    onRegisterToggle: () -> Unit
) {
    val progress = (trip.currentParticipants.toFloat() / trip.maxParticipants.toFloat()).coerceIn(0f, 1f)

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        border = BorderStroke(1.dp, SurfaceCardBorder),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = trip.title,
                    style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                    color = MaterialTheme.colorScheme.onSurface,
                    modifier = Modifier.weight(1f)
                )

                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(8.dp))
                        .background(GoldContainer)
                        .padding(horizontal = 8.dp, vertical = 4.dp)
                ) {
                    Text(
                        text = trip.status,
                        style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold),
                        color = GoldDark
                    )
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    imageVector = Icons.Default.FmdGood,
                    contentDescription = null,
                    tint = StatusInfo,
                    modifier = Modifier.size(16.dp)
                )
                Spacer(modifier = Modifier.width(6.dp))
                Text(
                    text = trip.destination,
                    style = MaterialTheme.typography.bodySmall.copy(fontWeight = FontWeight.SemiBold),
                    color = StatusInfo
                )
            }

            Spacer(modifier = Modifier.height(4.dp))

            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    imageVector = Icons.Default.DateRange,
                    contentDescription = null,
                    tint = TextSecondary,
                    modifier = Modifier.size(16.dp)
                )
                Spacer(modifier = Modifier.width(6.dp))
                Text(
                    text = "من ${trip.startDate} إلى ${trip.endDate}",
                    style = MaterialTheme.typography.bodySmall,
                    color = TextSecondary
                )
            }

            Spacer(modifier = Modifier.height(8.dp))

            Text(
                text = trip.description,
                style = MaterialTheme.typography.bodyMedium,
                color = TextPrimary
            )

            Spacer(modifier = Modifier.height(12.dp))

            // Capacity Bar
            Column {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(
                        text = "المسجلون: ${trip.currentParticipants} من ${trip.maxParticipants}",
                        style = MaterialTheme.typography.labelSmall,
                        color = TextSecondary
                    )
                    Text(
                        text = "${(progress * 100).toInt()}%",
                        style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold),
                        color = EmeraldPrimary
                    )
                }
                Spacer(modifier = Modifier.height(4.dp))
                LinearProgressIndicator(
                    progress = { progress },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(8.dp)
                        .clip(RoundedCornerShape(4.dp)),
                    color = EmeraldPrimary,
                    trackColor = EmeraldContainer
                )
            }

            Spacer(modifier = Modifier.height(14.dp))

            Button(
                onClick = onRegisterToggle,
                modifier = Modifier.fillMaxWidth(),
                colors = ButtonDefaults.buttonColors(
                    containerColor = if (trip.isRegistered) StatusSuccess else EmeraldPrimary
                ),
                shape = RoundedCornerShape(10.dp)
            ) {
                Icon(
                    imageVector = if (trip.isRegistered) Icons.Default.DoneAll else Icons.Default.GroupAdd,
                    contentDescription = null,
                    modifier = Modifier.size(18.dp)
                )
                Spacer(modifier = Modifier.width(6.dp))
                Text(if (trip.isRegistered) "أنت مسجل في هذه الرحلة" else "الانضمام للرحلة")
            }
        }
    }
}

@Composable
fun AddMeetingDialog(
    onDismiss: () -> Unit,
    onConfirm: (String, String, String, String, String) -> Unit
) {
    var title by remember { mutableStateOf("") }
    var date by remember { mutableStateOf("") }
    var time by remember { mutableStateOf("") }
    var location by remember { mutableStateOf("") }
    var description by remember { mutableStateOf("") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("إضافة لقاء عائلي جديد", fontWeight = FontWeight.Bold) },
        text = {
            Column(
                modifier = Modifier.fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                OutlinedTextField(
                    value = title,
                    onValueChange = { title = it },
                    label = { Text("عنوان اللقاء (مثال: اللقاء الشهري)") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                OutlinedTextField(
                    value = date,
                    onValueChange = { date = it },
                    label = { Text("التاريخ (مثال: ١٤٤٧/١٠/٠١ هـ)") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                OutlinedTextField(
                    value = time,
                    onValueChange = { time = it },
                    label = { Text("الوقت (مثال: ٠٨:٣٠ مساءً)") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                OutlinedTextField(
                    value = location,
                    onValueChange = { location = it },
                    label = { Text("المكان (مثال: ديوانية السيف)") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                OutlinedTextField(
                    value = description,
                    onValueChange = { description = it },
                    label = { Text("جدول الأعمال والملاحظات") },
                    maxLines = 3,
                    modifier = Modifier.fillMaxWidth()
                )
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    if (title.isNotBlank() && date.isNotBlank()) {
                        onConfirm(title, date, time, location, description)
                    }
                },
                enabled = title.isNotBlank() && date.isNotBlank(),
                colors = ButtonDefaults.buttonColors(containerColor = EmeraldPrimary)
            ) {
                Text("حفظ اللقاء")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("إلغاء") }
        }
    )
}

@Composable
fun AddTripDialog(
    onDismiss: () -> Unit,
    onConfirm: (String, String, String, String, String, Int) -> Unit
) {
    var title by remember { mutableStateOf("") }
    var destination by remember { mutableStateOf("") }
    var startDate by remember { mutableStateOf("") }
    var endDate by remember { mutableStateOf("") }
    var description by remember { mutableStateOf("") }
    var maxParticipants by remember { mutableStateOf("40") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("إضافة رحلة عائلية جديدة", fontWeight = FontWeight.Bold) },
        text = {
            Column(
                modifier = Modifier.fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                OutlinedTextField(
                    value = title,
                    onValueChange = { title = it },
                    label = { Text("عنوان الرحلة") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                OutlinedTextField(
                    value = destination,
                    onValueChange = { destination = it },
                    label = { Text("الوجهة (المدينة أو المنطقة)") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    OutlinedTextField(
                        value = startDate,
                        onValueChange = { startDate = it },
                        label = { Text("تاريخ البداية") },
                        modifier = Modifier.weight(1f)
                    )
                    OutlinedTextField(
                        value = endDate,
                        onValueChange = { endDate = it },
                        label = { Text("تاريخ النهاية") },
                        modifier = Modifier.weight(1f)
                    )
                }
                OutlinedTextField(
                    value = maxParticipants,
                    onValueChange = { maxParticipants = it },
                    label = { Text("العدد الأقصى للمشاركين") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                OutlinedTextField(
                    value = description,
                    onValueChange = { description = it },
                    label = { Text("برنامج وتفاصيل الرحلة") },
                    maxLines = 3,
                    modifier = Modifier.fillMaxWidth()
                )
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    if (title.isNotBlank() && destination.isNotBlank()) {
                        val maxP = maxParticipants.toIntOrNull() ?: 40
                        onConfirm(title, destination, startDate, endDate, description, maxP)
                    }
                },
                enabled = title.isNotBlank() && destination.isNotBlank(),
                colors = ButtonDefaults.buttonColors(containerColor = EmeraldPrimary)
            ) {
                Text("اعتماد الرحلة")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("إلغاء") }
        }
    )
}
