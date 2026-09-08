package com.alsaif.familyhub.ui

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.alsaif.familyhub.data.db.AlsaifDatabase
import com.alsaif.familyhub.data.model.*
import com.alsaif.familyhub.data.repository.AlsaifRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

class AlsaifViewModel(application: Application) : AndroidViewModel(application) {

    private val repository: AlsaifRepository

    init {
        val db = AlsaifDatabase.getDatabase(application, viewModelScope)
        repository = AlsaifRepository(db.alsaifDao())
    }

    val posts: StateFlow<List<FamilyPost>> = repository.allPosts
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val meetings: StateFlow<List<Meeting>> = repository.allMeetings
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val trips: StateFlow<List<Trip>> = repository.allTrips
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val financeRecords: StateFlow<List<FinanceRecord>> = repository.allFinanceRecords
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val tasks: StateFlow<List<FamilyTask>> = repository.allTasks
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val occasions: StateFlow<List<Occasion>> = repository.allOccasions
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val members: StateFlow<List<FamilyMember>> = repository.allMembers
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    // Filter states
    private val _selectedPostCategory = MutableStateFlow("الكل")
    val selectedPostCategory: StateFlow<String> = _selectedPostCategory.asStateFlow()

    fun selectPostCategory(category: String) {
        _selectedPostCategory.value = category
    }

    // CRUD Actions
    fun createPost(title: String, content: String, author: String, category: String) {
        viewModelScope.launch {
            val post = FamilyPost(
                title = title,
                content = content,
                authorName = author.ifBlank { "فرد من العائلة" },
                category = category,
                date = "اليوم"
            )
            repository.addPost(post)
        }
    }

    fun togglePostLike(post: FamilyPost) {
        viewModelScope.launch {
            val updated = post.copy(
                isLiked = !post.isLiked,
                likesCount = if (post.isLiked) (post.likesCount - 1).coerceAtLeast(0) else post.likesCount + 1
            )
            repository.updatePost(updated)
        }
    }

    fun toggleMeetingAttendance(meeting: Meeting) {
        viewModelScope.launch {
            repository.toggleMeetingRsvp(meeting.id, !meeting.isAttending)
        }
    }

    fun createMeeting(title: String, date: String, time: String, location: String, description: String) {
        viewModelScope.launch {
            val meeting = Meeting(
                title = title,
                date = date,
                time = time,
                location = location,
                description = description,
                attendeeCount = 1,
                isAttending = true
            )
            repository.addMeeting(meeting)
        }
    }

    fun toggleTripRegistration(trip: Trip) {
        viewModelScope.launch {
            repository.toggleTripRegistration(trip.id, !trip.isRegistered)
        }
    }

    fun createTrip(title: String, destination: String, startDate: String, endDate: String, desc: String, maxPart: Int) {
        viewModelScope.launch {
            val trip = Trip(
                title = title,
                destination = destination,
                startDate = startDate,
                endDate = endDate,
                description = desc,
                maxParticipants = maxPart,
                currentParticipants = 1,
                isRegistered = true
            )
            repository.addTrip(trip)
        }
    }

    fun addTransaction(title: String, amount: Double, type: String, category: String, notes: String) {
        viewModelScope.launch {
            val record = FinanceRecord(
                title = title,
                amount = amount,
                type = type,
                category = category,
                date = "١٤٤٧ هـ",
                notes = notes
            )
            repository.addFinanceRecord(record)
        }
    }

    fun toggleTask(task: FamilyTask) {
        viewModelScope.launch {
            repository.toggleTaskCompleted(task.id, !task.isCompleted)
        }
    }

    fun createTask(title: String, description: String, assignedTo: String, dueDate: String, priority: String) {
        viewModelScope.launch {
            val task = FamilyTask(
                title = title,
                description = description,
                assignedTo = assignedTo,
                dueDate = dueDate,
                priority = priority,
                isCompleted = false
            )
            repository.addTask(task)
        }
    }

    fun createOccasion(type: String, title: String, person: String, date: String, location: String, blessing: String) {
        viewModelScope.launch {
            val occasion = Occasion(
                type = type,
                title = title,
                personName = person,
                date = date,
                location = location,
                blessingText = blessing
            )
            repository.addOccasion(occasion)
        }
    }
}
