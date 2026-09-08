package com.alsaif.familyhub.data.db

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Update
import com.alsaif.familyhub.data.model.*
import kotlinx.coroutines.flow.Flow

@Dao
interface AlsaifDao {

    // Posts
    @Query("SELECT * FROM posts ORDER BY id DESC")
    fun getAllPosts(): Flow<List<FamilyPost>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertPost(post: FamilyPost): Long

    @Update
    suspend fun updatePost(post: FamilyPost)

    @Query("DELETE FROM posts WHERE id = :id")
    suspend fun deletePost(id: Long)

    // Meetings
    @Query("SELECT * FROM meetings ORDER BY date ASC")
    fun getAllMeetings(): Flow<List<Meeting>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertMeeting(meeting: Meeting): Long

    @Update
    suspend fun updateMeeting(meeting: Meeting)

    @Query("UPDATE meetings SET isAttending = :isAttending, attendeeCount = attendeeCount + (CASE WHEN :isAttending THEN 1 ELSE -1 END) WHERE id = :id")
    suspend fun toggleMeetingRsvp(id: Long, isAttending: Boolean)

    // Trips
    @Query("SELECT * FROM trips ORDER BY id DESC")
    fun getAllTrips(): Flow<List<Trip>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertTrip(trip: Trip): Long

    @Update
    suspend fun updateTrip(trip: Trip)

    @Query("UPDATE trips SET isRegistered = :isRegistered, currentParticipants = currentParticipants + (CASE WHEN :isRegistered THEN 1 ELSE -1 END) WHERE id = :id")
    suspend fun toggleTripRegistration(id: Long, isRegistered: Boolean)

    // Finance Records
    @Query("SELECT * FROM finance_records ORDER BY id DESC")
    fun getAllFinanceRecords(): Flow<List<FinanceRecord>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertFinanceRecord(record: FinanceRecord): Long

    // Tasks
    @Query("SELECT * FROM tasks ORDER BY isCompleted ASC, id DESC")
    fun getAllTasks(): Flow<List<FamilyTask>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertTask(task: FamilyTask): Long

    @Update
    suspend fun updateTask(task: FamilyTask)

    @Query("UPDATE tasks SET isCompleted = :completed WHERE id = :id")
    suspend fun setTaskCompleted(id: Long, completed: Boolean)

    // Occasions
    @Query("SELECT * FROM occasions ORDER BY id DESC")
    fun getAllOccasions(): Flow<List<Occasion>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertOccasion(occasion: Occasion): Long

    // Members
    @Query("SELECT * FROM family_members ORDER BY generation ASC, id ASC")
    fun getAllMembers(): Flow<List<FamilyMember>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertMembers(members: List<FamilyMember>)
}
