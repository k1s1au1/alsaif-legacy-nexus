package com.alsaif.familyhub

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.alsaif.familyhub.ui.AlsaifViewModel
import com.alsaif.familyhub.ui.screens.*
import com.alsaif.familyhub.ui.theme.*

class MainActivity : ComponentActivity() {

    private val viewModel: AlsaifViewModel by viewModels()

    @OptIn(ExperimentalMaterial3Api::class)
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        setContent {
            AlsaifTheme {
                var currentTab by remember { mutableIntStateOf(0) }

                Scaffold(
                    modifier = Modifier
                        .fillMaxSize()
                        .testTag("alsaif_main_scaffold"),
                    topBar = {
                        TopAppBar(
                            title = {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Image(
                                        painter = painterResource(id = R.drawable.ic_launcher_alsaif),
                                        contentDescription = "شعار السيف",
                                        modifier = Modifier
                                            .size(36.dp)
                                            .clip(CircleShape)
                                    )
                                    Spacer(modifier = Modifier.width(10.dp))
                                    Column {
                                        Text(
                                            text = "مجلس عائلة السيف",
                                            style = MaterialTheme.typography.titleMedium.copy(
                                                fontWeight = FontWeight.Bold,
                                                fontSize = 17.sp
                                            ),
                                            color = SurfaceWhite
                                        )
                                        Text(
                                            text = "المنصة الرسمية الموحدة",
                                            style = MaterialTheme.typography.labelSmall,
                                            color = GoldLight
                                        )
                                    }
                                }
                            },
                            colors = TopAppBarDefaults.topAppBarColors(
                                containerColor = EmeraldPrimary,
                                titleContentColor = SurfaceWhite
                            )
                        )
                    },
                    bottomBar = {
                        NavigationBar(
                            containerColor = MaterialTheme.colorScheme.surface,
                            tonalElevation = 8.dp
                        ) {
                            val navItems = listOf(
                                NavItem("الرئيسية", Icons.Filled.Home, Icons.Outlined.Home, "nav_dashboard"),
                                NavItem("المجلس", Icons.Filled.Forum, Icons.Outlined.Forum, "nav_majlis"),
                                NavItem("اللقاءات", Icons.Filled.Groups, Icons.Outlined.Groups, "nav_meetings_trips"),
                                NavItem("المالية", Icons.Filled.AccountBalanceWallet, Icons.Outlined.AccountBalanceWallet, "nav_finance"),
                                NavItem("المزيد", Icons.Filled.MoreHoriz, Icons.Outlined.MoreHoriz, "nav_more")
                            )

                            navItems.forEachIndexed { index, item ->
                                val selected = currentTab == index
                                NavigationBarItem(
                                    selected = selected,
                                    onClick = { currentTab = index },
                                    icon = {
                                        Icon(
                                            imageVector = if (selected) item.selectedIcon else item.unselectedIcon,
                                            contentDescription = item.title
                                        )
                                    },
                                    label = {
                                        Text(
                                            text = item.title,
                                            fontWeight = if (selected) FontWeight.Bold else FontWeight.Normal
                                        )
                                    },
                                    colors = NavigationBarItemDefaults.colors(
                                        selectedIconColor = EmeraldPrimary,
                                        selectedTextColor = EmeraldPrimary,
                                        indicatorColor = EmeraldContainer,
                                        unselectedIconColor = TextSecondary,
                                        unselectedTextColor = TextSecondary
                                    ),
                                    modifier = Modifier.testTag(item.testTag)
                                )
                            }
                        }
                    }
                ) { innerPadding ->
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(innerPadding)
                    ) {
                        when (currentTab) {
                            0 -> DashboardScreen(
                                viewModel = viewModel,
                                onNavigateToTab = { currentTab = it }
                            )
                            1 -> MajlisScreen(viewModel = viewModel)
                            2 -> MeetingsAndTripsScreen(viewModel = viewModel)
                            3 -> FinanceScreen(viewModel = viewModel)
                            4 -> MoreHubScreen(viewModel = viewModel)
                        }
                    }
                }
            }
        }
    }
}

private data class NavItem(
    val title: String,
    val selectedIcon: ImageVector,
    val unselectedIcon: ImageVector,
    val testTag: String
)
