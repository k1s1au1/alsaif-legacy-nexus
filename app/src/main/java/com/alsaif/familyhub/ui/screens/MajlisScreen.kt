package com.alsaif.familyhub.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
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
import com.alsaif.familyhub.data.model.FamilyPost
import com.alsaif.familyhub.ui.AlsaifViewModel
import com.alsaif.familyhub.ui.components.EmptyStateView
import com.alsaif.familyhub.ui.theme.*

@Composable
fun MajlisScreen(
    viewModel: AlsaifViewModel,
    modifier: Modifier = Modifier
) {
    val posts by viewModel.posts.collectAsState()
    val selectedCategory by viewModel.selectedPostCategory.collectAsState()
    var showAddDialog by remember { mutableStateOf(false) }

    val categories = listOf("الكل", "عام", "بشارة", "استشارة", "مناسبة")
    val filteredPosts = if (selectedCategory == "الكل") {
        posts
    } else {
        posts.filter { it.category == selectedCategory }
    }

    Scaffold(
        modifier = modifier.testTag("majlis_screen"),
        floatingActionButton = {
            FloatingActionButton(
                onClick = { showAddDialog = true },
                containerColor = EmeraldPrimary,
                contentColor = SurfaceWhite,
                shape = CircleShape,
                modifier = Modifier.testTag("add_post_fab")
            ) {
                Icon(Icons.Default.PostAdd, contentDescription = "إضافة مشاركة جديدة")
            }
        }
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .background(MaterialTheme.colorScheme.background)
        ) {
            // Header Bar
            Surface(
                modifier = Modifier.fillMaxWidth(),
                color = MaterialTheme.colorScheme.surface,
                shadowElevation = 2.dp
            ) {
                Column(
                    modifier = Modifier.padding(16.dp)
                ) {
                    Text(
                        text = "مجلس العائلة",
                        style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold),
                        color = MaterialTheme.colorScheme.onSurface
                    )
                    Text(
                        text = "حائط الأخبار، البشارات، والمشاورات بين أفراد العائلة",
                        style = MaterialTheme.typography.bodySmall,
                        color = TextSecondary
                    )

                    Spacer(modifier = Modifier.height(12.dp))

                    // Categories Horizontal Filter
                    LazyRow(
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        items(categories) { cat ->
                            val isSelected = cat == selectedCategory
                            FilterChip(
                                selected = isSelected,
                                onClick = { viewModel.selectPostCategory(cat) },
                                label = { Text(cat) },
                                colors = FilterChipDefaults.filterChipColors(
                                    selectedContainerColor = EmeraldPrimary,
                                    selectedLabelColor = SurfaceWhite
                                )
                            )
                        }
                    }
                }
            }

            // Posts List
            if (filteredPosts.isEmpty()) {
                EmptyStateView(
                    message = "لا توجد مشاركات في هذا التصنيف حالياً",
                    icon = Icons.Default.Forum,
                    modifier = Modifier.weight(1f)
                )
            } else {
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(14.dp)
                ) {
                    items(filteredPosts, key = { it.id }) { post ->
                        PostCard(
                            post = post,
                            onLike = { viewModel.togglePostLike(post) }
                        )
                    }
                }
            }
        }
    }

    if (showAddDialog) {
        AddPostDialog(
            categories = categories.filter { it != "الكل" },
            onDismiss = { showAddDialog = false },
            onConfirm = { title, content, author, category ->
                viewModel.createPost(title, content, author, category)
                showAddDialog = false
            }
        )
    }
}

@Composable
fun PostCard(
    post: FamilyPost,
    onLike: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
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
            // Author & Category Header
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier = Modifier
                            .size(40.dp)
                            .clip(CircleShape)
                            .background(EmeraldContainer),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = post.authorName.take(1),
                            color = EmeraldPrimary,
                            fontWeight = FontWeight.Bold,
                            fontSize = 16.sp
                        )
                    }
                    Spacer(modifier = Modifier.width(10.dp))
                    Column {
                        Text(
                            text = post.authorName,
                            style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold),
                            color = MaterialTheme.colorScheme.onSurface
                        )
                        Text(
                            text = "${post.authorRole} • ${post.date}",
                            style = MaterialTheme.typography.labelSmall,
                            color = TextSecondary
                        )
                    }
                }

                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(8.dp))
                        .background(
                            when (post.category) {
                                "بشارة" -> EmeraldContainer
                                "استشارة" -> GoldContainer
                                else -> IvoryBackground
                            }
                        )
                        .padding(horizontal = 10.dp, vertical = 4.dp)
                ) {
                    Text(
                        text = post.category,
                        style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold),
                        color = when (post.category) {
                            "بشارة" -> EmeraldPrimary
                            "استشارة" -> GoldDark
                            else -> TextSecondary
                        }
                    )
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Post Title & Body
            Text(
                text = post.title,
                style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                color = MaterialTheme.colorScheme.onSurface
            )

            Spacer(modifier = Modifier.height(6.dp))

            Text(
                text = post.content,
                style = MaterialTheme.typography.bodyMedium,
                color = TextPrimary,
                lineHeight = 22.sp
            )

            Spacer(modifier = Modifier.height(14.dp))
            HorizontalDivider(color = SurfaceCardBorder, thickness = 0.5.dp)
            Spacer(modifier = Modifier.height(8.dp))

            // Interactive Actions: Like & Comment Counters
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier
                        .clip(RoundedCornerShape(8.dp))
                        .clickable(onClick = onLike)
                        .padding(horizontal = 8.dp, vertical = 4.dp)
                ) {
                    Icon(
                        imageVector = if (post.isLiked) Icons.Default.Favorite else Icons.Default.FavoriteBorder,
                        contentDescription = "إعجاب",
                        tint = if (post.isLiked) StatusError else TextSecondary,
                        modifier = Modifier.size(20.dp)
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        text = "${post.likesCount} إعجاب",
                        style = MaterialTheme.typography.labelMedium,
                        color = if (post.isLiked) StatusError else TextSecondary
                    )
                }

                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.ChatBubbleOutline,
                        contentDescription = "الردود",
                        tint = TextSecondary,
                        modifier = Modifier.size(18.dp)
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        text = "مناقشة المجلس",
                        style = MaterialTheme.typography.labelMedium,
                        color = TextSecondary
                    )
                }
            }
        }
    }
}

@Composable
fun AddPostDialog(
    categories: List<String>,
    onDismiss: () -> Unit,
    onConfirm: (String, String, String, String) -> Unit
) {
    var title by remember { mutableStateOf("") }
    var content by remember { mutableStateOf("") }
    var author by remember { mutableStateOf("") }
    var selectedCat by remember { mutableStateOf(categories.firstOrNull() ?: "عام") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Text(
                text = "مشاركة جديدة في المجلس",
                fontWeight = FontWeight.Bold
            )
        },
        text = {
            Column(
                modifier = Modifier.fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                OutlinedTextField(
                    value = title,
                    onValueChange = { title = it },
                    label = { Text("عنوان المشاركة") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )

                OutlinedTextField(
                    value = author,
                    onValueChange = { author = it },
                    label = { Text("اسم الكاتب") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )

                // Category selector
                Text("التصنيف:", style = MaterialTheme.typography.labelMedium)
                LazyRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    items(categories) { cat ->
                        FilterChip(
                            selected = cat == selectedCat,
                            onClick = { selectedCat = cat },
                            label = { Text(cat) }
                        )
                    }
                }

                OutlinedTextField(
                    value = content,
                    onValueChange = { content = it },
                    label = { Text("نص المشاركة أو التفاصيل") },
                    minLines = 3,
                    maxLines = 5,
                    modifier = Modifier.fillMaxWidth()
                )
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    if (title.isNotBlank() && content.isNotBlank()) {
                        onConfirm(title, content, author, selectedCat)
                    }
                },
                enabled = title.isNotBlank() && content.isNotBlank(),
                colors = ButtonDefaults.buttonColors(containerColor = EmeraldPrimary)
            ) {
                Text("نشر في المجلس")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("إلغاء")
            }
        }
    )
}
