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
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.alsaif.familyhub.data.model.FinanceRecord
import com.alsaif.familyhub.ui.AlsaifViewModel
import com.alsaif.familyhub.ui.components.EmptyStateView
import com.alsaif.familyhub.ui.theme.*

@Composable
fun FinanceScreen(
    viewModel: AlsaifViewModel,
    modifier: Modifier = Modifier
) {
    val records by viewModel.financeRecords.collectAsState()
    var filterType by remember { mutableStateOf("ALL") } // "ALL", "INCOME", "EXPENSE"
    var showAddDialog by remember { mutableStateOf(false) }

    val totalIncome = records.filter { it.type == "INCOME" }.sumOf { it.amount }
    val totalExpense = records.filter { it.type == "EXPENSE" }.sumOf { it.amount }
    val currentBalance = totalIncome - totalExpense

    val filteredRecords = when (filterType) {
        "INCOME" -> records.filter { it.type == "INCOME" }
        "EXPENSE" -> records.filter { it.type == "EXPENSE" }
        else -> records
    }

    Scaffold(
        modifier = modifier.testTag("finance_screen"),
        floatingActionButton = {
            FloatingActionButton(
                onClick = { showAddDialog = true },
                containerColor = EmeraldPrimary,
                contentColor = SurfaceWhite,
                shape = CircleShape,
                modifier = Modifier.testTag("add_transaction_fab")
            ) {
                Icon(Icons.Default.AddCard, contentDescription = "إضافة قيد مالي")
            }
        }
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .background(MaterialTheme.colorScheme.background)
        ) {
            // Balance Card
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp),
                shape = RoundedCornerShape(20.dp),
                elevation = CardDefaults.cardElevation(defaultElevation = 4.dp)
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(
                            Brush.linearGradient(
                                colors = listOf(EmeraldPrimary, EmeraldDark)
                            )
                        )
                        .padding(20.dp)
                ) {
                    Column {
                        Text(
                            text = "صندوق عائلة السيف",
                            style = MaterialTheme.typography.titleMedium,
                            color = GoldLight
                        )
                        Spacer(modifier = Modifier.height(6.dp))
                        Text(
                            text = "%,.2f ر.س".format(currentBalance),
                            style = MaterialTheme.typography.headlineMedium.copy(
                                fontWeight = FontWeight.ExtraBold,
                                fontSize = 28.sp
                            ),
                            color = SurfaceWhite
                        )

                        Spacer(modifier = Modifier.height(16.dp))
                        HorizontalDivider(color = SurfaceWhite.copy(alpha = 0.2f))
                        Spacer(modifier = Modifier.height(12.dp))

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Column {
                                Text(
                                    text = "إجمالي الإيرادات",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = SurfaceWhite.copy(alpha = 0.8f)
                                )
                                Spacer(modifier = Modifier.height(2.dp))
                                Text(
                                    text = "+ %,.0f ر.س".format(totalIncome),
                                    style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold),
                                    color = GoldAccent
                                )
                            }

                            Column {
                                Text(
                                    text = "إجمالي المصروفات",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = SurfaceWhite.copy(alpha = 0.8f)
                                )
                                Spacer(modifier = Modifier.height(2.dp))
                                Text(
                                    text = "- %,.0f ر.س".format(totalExpense),
                                    style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold),
                                    color = SurfaceWhite
                                )
                            }
                        }
                    }
                }
            }

            // Filter Tabs
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                FilterChip(
                    selected = filterType == "ALL",
                    onClick = { filterType = "ALL" },
                    label = { Text("كافة العمليات") },
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = EmeraldPrimary,
                        selectedLabelColor = SurfaceWhite
                    )
                )
                FilterChip(
                    selected = filterType == "INCOME",
                    onClick = { filterType = "INCOME" },
                    label = { Text("الإيرادات والاشتراكات") },
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = EmeraldPrimary,
                        selectedLabelColor = SurfaceWhite
                    )
                )
                FilterChip(
                    selected = filterType == "EXPENSE",
                    onClick = { filterType = "EXPENSE" },
                    label = { Text("المصروفات والأنشطة") },
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = EmeraldPrimary,
                        selectedLabelColor = SurfaceWhite
                    )
                )
            }

            Spacer(modifier = Modifier.height(8.dp))

            // Records List
            if (filteredRecords.isEmpty()) {
                EmptyStateView(
                    message = "لا توجد حركات مالية مسجلة في هذه الفئة",
                    icon = Icons.Default.Savings,
                    modifier = Modifier.weight(1f)
                )
            } else {
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    items(filteredRecords, key = { it.id }) { record ->
                        FinanceRecordItem(record = record)
                    }
                }
            }
        }
    }

    if (showAddDialog) {
        AddFinanceDialog(
            onDismiss = { showAddDialog = false },
            onConfirm = { title, amount, type, category, notes ->
                viewModel.addTransaction(title, amount, type, category, notes)
                showAddDialog = false
            }
        )
    }
}

@Composable
fun FinanceRecordItem(record: FinanceRecord) {
    val isIncome = record.type == "INCOME"

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        border = BorderStroke(1.dp, SurfaceCardBorder),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(14.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.weight(1f)
            ) {
                Box(
                    modifier = Modifier
                        .size(42.dp)
                        .clip(CircleShape)
                        .background(if (isIncome) EmeraldContainer else Color(0xFFFFEBEE)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = if (isIncome) Icons.Default.ArrowDownward else Icons.Default.ArrowUpward,
                        contentDescription = null,
                        tint = if (isIncome) StatusSuccess else StatusError,
                        modifier = Modifier.size(20.dp)
                    )
                }
                Spacer(modifier = Modifier.width(12.dp))
                Column {
                    Text(
                        text = record.title,
                        style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold),
                        color = MaterialTheme.colorScheme.onSurface
                    )
                    Text(
                        text = "${record.category} • ${record.date}",
                        style = MaterialTheme.typography.bodySmall,
                        color = TextSecondary
                    )
                    if (record.notes.isNotBlank()) {
                        Text(
                            text = record.notes,
                            style = MaterialTheme.typography.labelSmall,
                            color = TextLightMuted
                        )
                    }
                }
            }

            Text(
                text = "${if (isIncome) "+" else "-"} %,.0f ر.س".format(record.amount),
                style = MaterialTheme.typography.titleMedium.copy(
                    fontWeight = FontWeight.Bold,
                    fontSize = 16.sp
                ),
                color = if (isIncome) StatusSuccess else StatusError
            )
        }
    }
}

@Composable
fun AddFinanceDialog(
    onDismiss: () -> Unit,
    onConfirm: (String, Double, String, String, String) -> Unit
) {
    var title by remember { mutableStateOf("") }
    var amountText by remember { mutableStateOf("") }
    var type by remember { mutableStateOf("INCOME") } // "INCOME" or "EXPENSE"
    var category by remember { mutableStateOf("اشتراكات") }
    var notes by remember { mutableStateOf("") }

    val categories = if (type == "INCOME") {
        listOf("اشتراكات", "دعم الصندوق", "تبرعات", "أخرى")
    } else {
        listOf("ضيافة وصيانة", "أنشطة ورحلات", "إيجار المجلس", "مساعدات", "أخرى")
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("تسجيل حركة مالية جديدة", fontWeight = FontWeight.Bold) },
        text = {
            Column(
                modifier = Modifier.fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                // Type Switcher
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Button(
                        onClick = {
                            type = "INCOME"
                            category = "اشتراكات"
                        },
                        modifier = Modifier.weight(1f),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = if (type == "INCOME") EmeraldPrimary else MaterialTheme.colorScheme.surfaceVariant
                        )
                    ) {
                        Text("إيداع (دخل)")
                    }
                    Button(
                        onClick = {
                            type = "EXPENSE"
                            category = "ضيافة وصيانة"
                        },
                        modifier = Modifier.weight(1f),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = if (type == "EXPENSE") StatusError else MaterialTheme.colorScheme.surfaceVariant
                        )
                    ) {
                        Text("صرف (مصروف)")
                    }
                }

                OutlinedTextField(
                    value = title,
                    onValueChange = { title = it },
                    label = { Text("بيان الحركة (مثال: اشتراك شهر رمضان)") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )

                OutlinedTextField(
                    value = amountText,
                    onValueChange = { amountText = it },
                    label = { Text("المبلغ (بالريال السعودي)") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )

                Text("التصنيف:", style = MaterialTheme.typography.labelMedium)
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    categories.take(3).forEach { cat ->
                        FilterChip(
                            selected = category == cat,
                            onClick = { category = cat },
                            label = { Text(cat, fontSize = 12.sp) }
                        )
                    }
                }

                OutlinedTextField(
                    value = notes,
                    onValueChange = { notes = it },
                    label = { Text("ملاحظات إضافية") },
                    maxLines = 2,
                    modifier = Modifier.fillMaxWidth()
                )
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    val amt = amountText.toDoubleOrNull() ?: 0.0
                    if (title.isNotBlank() && amt > 0) {
                        onConfirm(title, amt, type, category, notes)
                    }
                },
                enabled = title.isNotBlank() && (amountText.toDoubleOrNull() ?: 0.0) > 0,
                colors = ButtonDefaults.buttonColors(containerColor = EmeraldPrimary)
            ) {
                Text("حفظ العملية")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("إلغاء") }
        }
    )
}
