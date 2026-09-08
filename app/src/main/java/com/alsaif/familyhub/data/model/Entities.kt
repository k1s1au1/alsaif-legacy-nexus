package com.alsaif.familyhub.data.model

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "posts")
data class FamilyPost(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val title: String,
    val content: String,
    val authorName: String,
    val authorRole: String = "عضو المجلس",
    val category: String = "عام", // عام، استشارة، بشارة، مناسبة
    val date: String,
    val likesCount: Int = 0,
    val isLiked: Boolean = false
)

@Entity(tableName = "meetings")
data class Meeting(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val title: String,
    val date: String,
    val time: String,
    val location: String,
    val description: String,
    val attendeeCount: Int = 12,
    val isAttending: Boolean = false,
    val isPast: Boolean = false
)

@Entity(tableName = "trips")
data class Trip(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val title: String,
    val destination: String,
    val startDate: String,
    val endDate: String,
    val description: String,
    val maxParticipants: Int = 30,
    val currentParticipants: Int = 14,
    val isRegistered: Boolean = false,
    val status: String = "متاحة للتسجيل" // متاحة للتسجيل، مكتملة، جارية
)

@Entity(tableName = "finance_records")
data class FinanceRecord(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val title: String,
    val amount: Double,
    val type: String, // "INCOME" أو "EXPENSE"
    val category: String, // اشتراكات، ضيافة، صيانة، أنشطة
    val date: String,
    val notes: String = ""
)

@Entity(tableName = "tasks")
data class FamilyTask(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val title: String,
    val description: String,
    val assignedTo: String,
    val dueDate: String,
    val priority: String = "متوسطة", // عاجلة، متوسطة، عادية
    val isCompleted: Boolean = false
)

@Entity(tableName = "occasions")
data class Occasion(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val type: String, // wedding, newborn, graduation, birthday, gathering, recovery
    val title: String,
    val personName: String,
    val date: String,
    val location: String = "ديوانية عائلة السيف",
    val blessingText: String
)

@Entity(tableName = "family_members")
data class FamilyMember(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val name: String,
    val branch: String, // فرع آل إبراهيم، آل عبدالله، آل خالد...
    val role: String, // عميد الأسرة، رئيس المجلس، عضو، أمين الصندوق
    val generation: Int = 2,
    val phone: String = ""
)
