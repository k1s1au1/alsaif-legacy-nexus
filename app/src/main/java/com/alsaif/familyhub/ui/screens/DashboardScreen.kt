package com.alsaif.familyhub.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.alsaif.familyhub.R
import com.alsaif.familyhub.ui.AlsaifViewModel
import com.alsaif.familyhub.ui.components.MetricCard
import com.alsaif.familyhub.ui.components.SectionHeader
import com.alsaif.familyhub.ui.theme.*

@Composable
fun DashboardScreen(
    viewModel: AlsaifViewModel,
    onNavigateToTab: (Int) -> Unit,
    modifier: Modifier = Modifier
) {
    val posts by viewModel.posts.collectAsState()
    val meetings by viewModel.meetings.collectAsState()
    val trips by viewModel.trips.collectAsState()
    val tasks by viewModel.tasks.collectAsState()
    val finances by viewModel.financeRecords.collectAsState()

    val totalBalance = finances.filter { it.type == "INCOME" }.sumOf { it.amount } -
            finances.filter { it.type == "EXPENSE" }.sumOf { it.amount }
    val pendingTasksCount = tasks.count { !it.isCompleted }
    val upcomingMeetingsCount = meetings.count { !it.isPast }
    val latestAnnouncement = posts.firstOrNull()
    val nextMeeting = meetings.firstOrNull()

    LazyColumn(
        modifier = modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .testTag("dashboard_screen"),
        contentPadding = PaddingValues(bottom = 24.dp)
    ) {
        // Hero Header Banner
        item {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(230.dp)
            ) {
                // Background image or gradient
                Image(
                    painter = painterResource(id = R.drawable.alsaif_majlis_hero),
                    contentDescription = "مجلس عائلة السيف",
                    modifier = Modifier.fillMaxSize(),
                    contentScale = ContentScale.Crop
                )

                // Gradient Overlay
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(
                            Brush.verticalGradient(
                                colors = listOf(
                                    Color.Black.copy(alpha = 0.35f),
                                    EmeraldPrimary.copy(alpha = 0.90f)
                                )
                            )
                        )
                )

                // Header Content
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(20.dp),
                    verticalArrangement = Arrangement.Bottom
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Image(
                            painter = painterResource(id = R.drawable.ic_launcher_alsaif),
                            contentDescription = "شعار السيف",
                            modifier = Modifier
                                .size(48.dp)
                                .clip(CircleShape)
                                .border(2.dp, GoldAccent, CircleShape)
                        )
                        Spacer(modifier = Modifier.width(12.dp))
                        Column {
                            Text(
                                text = "مجلس عائلة السيف",
                                style = MaterialTheme.typography.titleLarge.copy(
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 22.sp
                                ),
                                color = SurfaceWhite
                            )
                            Text(
                                text = "المنصة الرقمية الموحدة للتواصل والتوثيق",
                                style = MaterialTheme.typography.bodySmall,
                                color = GoldLight
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(14.dp))

                    // Date & Status Tag
                    Row(
                        modifier = Modifier
                            .clip(RoundedCornerShape(20.dp))
                            .background(Color.White.copy(alpha = 0.15f))
                            .padding(horizontal = 12.dp, vertical = 6.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            imageVector = Icons.Default.CalendarToday,
                            contentDescription = null,
                            tint = GoldLight,
                            modifier = Modifier.size(16.dp)
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            text = "شهر رمضان المبارك ١٤٤٧ هـ | الرياض",
                            style = MaterialTheme.typography.labelSmall,
                            color = SurfaceWhite
                        )
                    }
                }
            }
        }

        // Executive Quick Stats
        item {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp)
            ) {
                Text(
                    text = "نظرة عامة على أنشطة العائلة",
                    style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                    color = MaterialTheme.colorScheme.onBackground
                )
                Spacer(modifier = Modifier.height(12.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    MetricCard(
                        title = "صندوق العائلة",
                        value = "%,.0f ر.س".format(totalBalance),
                        icon = Icons.Default.AccountBalanceWallet,
                        accentColor = EmeraldPrimary,
                        modifier = Modifier
                            .weight(1f)
                            .clickable { onNavigateToTab(3) }
                    )
                    MetricCard(
                        title = "اللقاءات القادمة",
                        value = "$upcomingMeetingsCount لقاءات",
                        icon = Icons.Default.Groups,
                        accentColor = GoldAccent,
                        modifier = Modifier
                            .weight(1f)
                            .clickable { onNavigateToTab(2) }
                    )
                }

                Spacer(modifier = Modifier.height(12.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    MetricCard(
                        title = "الرحلات النشطة",
                        value = "${trips.size} رحلات",
                        icon = Icons.Default.Explore,
                        accentColor = StatusInfo,
                        modifier = Modifier
                            .weight(1f)
                            .clickable { onNavigateToTab(2) }
                    )
                    MetricCard(
                        title = "المهام الجارية",
                        value = "$pendingTasksCount مهام",
                        icon = Icons.Default.CheckCircle,
                        accentColor = StatusWarning,
                        modifier = Modifier
                            .weight(1f)
                            .clickable { onNavigateToTab(4) }
                    )
                }
            }
        }

        // Quick Navigation Grid
        item {
            SectionHeader(
                title = "بوابات المجلس",
                subtitle = "الوصول السريع للأقسام الرئيسية"
            )

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                QuickHubActionItem(
                    label = "المجلس",
                    icon = Icons.Default.Forum,
                    color = EmeraldPrimary,
                    onClick = { onNavigateToTab(1) }
                )
                QuickHubActionItem(
                    label = "اللقاءات",
                    icon = Icons.Default.Event,
                    color = GoldAccent,
                    onClick = { onNavigateToTab(2) }
                )
                QuickHubActionItem(
                    label = "الرحلات",
                    icon = Icons.Default.Luggage,
                    color = StatusInfo,
                    onClick = { onNavigateToTab(2) }
                )
                QuickHubActionItem(
                    label = "صندوق العائلة",
                    icon = Icons.Default.MonetizationOn,
                    color = EmeraldLight,
                    onClick = { onNavigateToTab(3) }
                )
            }
        }

        // Latest Majlis Announcement Banner
        if (latestAnnouncement != null) {
            item {
                Spacer(modifier = Modifier.height(16.dp))
                SectionHeader(
                    title = "آخر إعلانات المجلس",
                    actionText = "عرض الكل",
                    onActionClick = { onNavigateToTab(1) }
                )

                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp)
                        .clickable { onNavigateToTab(1) },
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.surface
                    ),
                    border = BorderStroke(1.dp, GoldAccent.copy(alpha = 0.4f)),
                    elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
                ) {
                    Column(
                        modifier = Modifier.padding(16.dp)
                    ) {
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
                                    text = latestAnnouncement.category,
                                    style = MaterialTheme.typography.labelSmall,
                                    color = GoldDark,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                            Text(
                                text = latestAnnouncement.date,
                                style = MaterialTheme.typography.bodySmall,
                                color = TextSecondary
                            )
                        }

                        Spacer(modifier = Modifier.height(8.dp))

                        Text(
                            text = latestAnnouncement.title,
                            style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                            color = MaterialTheme.colorScheme.onSurface
                        )

                        Spacer(modifier = Modifier.height(6.dp))

                        Text(
                            text = latestAnnouncement.content,
                            style = MaterialTheme.typography.bodyMedium,
                            color = TextSecondary,
                            maxLines = 2
                        )
                    }
                }
            }
        }

        // Next Meeting Preview
        if (nextMeeting != null) {
            item {
                Spacer(modifier = Modifier.height(16.dp))
                SectionHeader(
                    title = "اللقاء العائلي القادم",
                    actionText = "إدارة اللقاءات",
                    onActionClick = { onNavigateToTab(2) }
                )

                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp),
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.surface
                    ),
                    border = BorderStroke(1.dp, SurfaceCardBorder),
                    elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
                ) {
                    Column(
                        modifier = Modifier.padding(16.dp)
                    ) {
                        Text(
                            text = nextMeeting.title,
                            style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                            color = MaterialTheme.colorScheme.onSurface
                        )

                        Spacer(modifier = Modifier.height(8.dp))

                        Row(
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(
                                imageVector = Icons.Default.AccessTime,
                                contentDescription = null,
                                tint = EmeraldPrimary,
                                modifier = Modifier.size(16.dp)
                            )
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(
                                text = "${nextMeeting.date} • ${nextMeeting.time}",
                                style = MaterialTheme.typography.bodySmall,
                                color = TextSecondary
                            )
                        }

                        Spacer(modifier = Modifier.height(4.dp))

                        Row(
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(
                                imageVector = Icons.Default.Place,
                                contentDescription = null,
                                tint = GoldAccent,
                                modifier = Modifier.size(16.dp)
                            )
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(
                                text = nextMeeting.location,
                                style = MaterialTheme.typography.bodySmall,
                                color = TextSecondary
                            )
                        }

                        Spacer(modifier = Modifier.height(14.dp))

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "المؤكدون: ${nextMeeting.attendeeCount} فرداً",
                                style = MaterialTheme.typography.labelMedium,
                                color = EmeraldPrimary,
                                fontWeight = FontWeight.SemiBold
                            )

                            Button(
                                onClick = { viewModel.toggleMeetingAttendance(nextMeeting) },
                                colors = ButtonDefaults.buttonColors(
                                    containerColor = if (nextMeeting.isAttending) StatusSuccess else EmeraldPrimary
                                ),
                                shape = RoundedCornerShape(12.dp)
                            ) {
                                Icon(
                                    imageVector = if (nextMeeting.isAttending) Icons.Default.Check else Icons.Default.PersonAdd,
                                    contentDescription = null,
                                    modifier = Modifier.size(18.dp)
                                )
                                Spacer(modifier = Modifier.width(6.dp))
                                Text(
                                    text = if (nextMeeting.isAttending) "مؤكد حضورك" else "تأكيد الحضور"
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
private fun QuickHubActionItem(
    label: String,
    icon: ImageVector,
    color: Color,
    onClick: () -> Unit
) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier
            .clip(RoundedCornerShape(12.dp))
            .clickable(onClick = onClick)
            .padding(8.dp)
    ) {
        Box(
            modifier = Modifier
                .size(54.dp)
                .clip(CircleShape)
                .background(color.copy(alpha = 0.12f)),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = icon,
                contentDescription = label,
                tint = color,
                modifier = Modifier.size(26.dp)
            )
        }
        Spacer(modifier = Modifier.height(6.dp))
        Text(
            text = label,
            style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Medium),
            color = MaterialTheme.colorScheme.onBackground
        )
    }
}
