package com.alsaif.familyhub.data.repository

import com.alsaif.familyhub.data.db.AlsaifDao
import com.alsaif.familyhub.data.model.*
import kotlinx.coroutines.flow.Flow

class AlsaifRepository(private val dao: AlsaifDao) {

    // Posts
    val allPosts: Flow<List<FamilyPost>> = dao.getAllPosts()

    suspend fun addPost(post: FamilyPost): Long = dao.insertPost(post)
    suspend fun updatePost(post: FamilyPost) = dao.updatePost(post)
    suspend fun deletePost(id: Long) = dao.deletePost(id)

    // Meetings
    val allMeetings: Flow<List<Meeting>> = dao.getAllMeetings()

    suspend fun addMeeting(meeting: Meeting): Long = dao.insertMeeting(meeting)
    suspend fun toggleMeetingRsvp(id: Long, isAttending: Boolean) = dao.toggleMeetingRsvp(id, isAttending)

    // Trips
    val allTrips: Flow<List<Trip>> = dao.getAllTrips()

    suspend fun addTrip(trip: Trip): Long = dao.insertTrip(trip)
    suspend fun toggleTripRegistration(id: Long, isRegistered: Boolean) = dao.toggleTripRegistration(id, isRegistered)

    // Finance
    val allFinanceRecords: Flow<List<FinanceRecord>> = dao.getAllFinanceRecords()

    suspend fun addFinanceRecord(record: FinanceRecord): Long = dao.insertFinanceRecord(record)

    // Tasks
    val allTasks: Flow<List<FamilyTask>> = dao.getAllTasks()

    suspend fun addTask(task: FamilyTask): Long = dao.insertTask(task)
    suspend fun toggleTaskCompleted(id: Long, completed: Boolean) = dao.setTaskCompleted(id, completed)

    // Occasions
    val allOccasions: Flow<List<Occasion>> = dao.getAllOccasions()

    suspend fun addOccasion(occasion: Occasion): Long = dao.insertOccasion(occasion)

    // Members
    val allMembers: Flow<List<FamilyMember>> = dao.getAllMembers()
}
