package com.alsaif.familyhub.data.db

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.sqlite.db.SupportSQLiteDatabase
import com.alsaif.familyhub.data.model.*
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

@Database(
    entities = [
        FamilyPost::class,
        Meeting::class,
        Trip::class,
        FinanceRecord::class,
        FamilyTask::class,
        Occasion::class,
        FamilyMember::class
    ],
    version = 1,
    exportSchema = false
)
abstract class AlsaifDatabase : RoomDatabase() {

    abstract fun alsaifDao(): AlsaifDao

    companion object {
        @Volatile
        private var INSTANCE: AlsaifDatabase? = null

        fun getDatabase(context: Context, scope: CoroutineScope): AlsaifDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    AlsaifDatabase::class.java,
                    "alsaif_family_hub.db"
                )
                    .addCallback(AlsaifDatabaseCallback(scope))
                    .build()
                INSTANCE = instance
                instance
            }
        }

        private class AlsaifDatabaseCallback(
            private val scope: CoroutineScope
        ) : RoomDatabase.Callback() {
            override fun onCreate(db: SupportSQLiteDatabase) {
                super.onCreate(db)
                INSTANCE?.let { database ->
                    scope.launch(Dispatchers.IO) {
                        populateInitialData(database.alsaifDao())
                    }
                }
            }
        }

        private suspend fun populateInitialData(dao: AlsaifDao) {
            // Initial Posts in Majlis
            dao.insertPost(
                FamilyPost(
                    title = "افتتاح ديوانية عائلة السيف المباركة",
                    content = "الحمد لله الذي بنعمته تتم الصالحات. نرحب بكم جميعاً في المنصة الرقمية الموحدة لمجلس عائلة السيف لتوثيق تاريخنا ومناسباتنا وتنسيق لقاءاتنا.",
                    authorName = "الشيخ فهد بن إبراهيم السيف",
                    authorRole = "عميد الأسرة",
                    category = "عام",
                    date = "١٤٤٧/٠٩/١٥ هـ",
                    likesCount = 28
                )
            )
            dao.insertPost(
                FamilyPost(
                    title = "بشارة: حصول الدكتور تركي السيف على البورد السعودي",
                    content = "نبارك لابن العم الغالي الدكتور تركي بن عبدالعزيز بمناسبة اجتيازه بنجاح ونيله البورد في جراحة القلب. سائلين الله له دوام التوفيق والرفعة.",
                    authorName = "عبدالرحمن بن خالد السيف",
                    authorRole = "أمين المجلس",
                    category = "بشارة",
                    date = "١٤٤٧/٠٩/١٢ هـ",
                    likesCount = 42
                )
            )
            dao.insertPost(
                FamilyPost(
                    title = "مشاورة: مقترحات وجهة الرحلة الربيعية القادمة",
                    content = "الإخوة والأبناء الكرام، نرجو إبداء آرائكم حول اختيار وجهة الرحلة السنوية بين روضة التنهات أو مخيم العلا التاريخي.",
                    authorName = "ماجد بن فيصل السيف",
                    authorRole = "مسؤول الأنشطة",
                    category = "استشارة",
                    date = "١٤٤٧/٠٩/١٠ هـ",
                    likesCount = 19
                )
            )

            // Initial Meetings
            dao.insertMeeting(
                Meeting(
                    title = "اللقاء العائلي الدوري (الجمعة الأولى)",
                    date = "١٤٤٧/٠٩/٢٥ هـ",
                    time = "٠٨:٣٠ مساءً",
                    location = "ديوانية السيف الكبرى - الدرعية",
                    description = "الاجتماع الشهري لمناقشة مبادرات صندوق الأسرة ومتابعة استعدادات عيد الفطر المبارك وتكريم المتفوقين.",
                    attendeeCount = 34,
                    isAttending = true
                )
            )
            dao.insertMeeting(
                Meeting(
                    title = "جلسة الشورى والمجلس التنفيذي",
                    date = "١٤٤٧/١٠/٠٤ هـ",
                    time = "٠٦:٠٠ مساءً",
                    location = "قاعة الاجتماعات - مقر الصندوق",
                    description = "مناقشة التقرير المالي الربع سنوي واعتماد الميزانية التقديرية للأنشطة الصيفية.",
                    attendeeCount = 8,
                    isAttending = false
                )
            )

            // Initial Trips
            dao.insertTrip(
                Trip(
                    title = "رحلة العلا التراثية واستكشاف الديرة",
                    destination = "العلا - مدائن صالح",
                    startDate = "١٤٤٧/١٠/١٥ هـ",
                    endDate = "١٤٤٧/١٠/١٨ هـ",
                    description = "برنامج عائلي يشمل زيارة البلدة القديمة، جبل الفيل، مسار الواحة، وجلسات سمر نجدية في المخيم الصحراوي.",
                    maxParticipants = 45,
                    currentParticipants = 29,
                    isRegistered = true,
                    status = "متاحة للتسجيل"
                )
            )
            dao.insertTrip(
                Trip(
                    title = "مخيم الصمان وربيع نجد",
                    destination = "الصمان - الفياض الشمالية",
                    startDate = "١٤٤٧/١١/٠٢ هـ",
                    endDate = "١٤٤٧/١١/٠٥ هـ",
                    description = "كشتة ربيعية مميزة مخصصة للشباب والآباء لقضاء أيام في البر مع الطهي التقليدي والمسابقات التراثية.",
                    maxParticipants = 35,
                    currentParticipants = 20,
                    isRegistered = false,
                    status = "متاحة للتسجيل"
                )
            )

            // Initial Finance Records
            dao.insertFinanceRecord(
                FinanceRecord(
                    title = "مساهمة الشيخ إبراهيم السيف السنوية",
                    amount = 25000.0,
                    type = "INCOME",
                    category = "دعم الصندوق",
                    date = "١٤٤٧/٠٩/٠١ هـ",
                    notes = "دعم وقف العائلة السنوي"
                )
            )
            dao.insertFinanceRecord(
                FinanceRecord(
                    title = "رسوم صيانة وضيافة ديوانية السيف",
                    amount = 4800.0,
                    type = "EXPENSE",
                    category = "ضيافة وصيانة",
                    date = "١٤٤٧/٠٩/٠٥ هـ",
                    notes = "تجهيز قهوة وشاي وتمور فاخرة وصيانة التكييف"
                )
            )
            dao.insertFinanceRecord(
                FinanceRecord(
                    title = "الاشتراكات الشهرية - شهر رمضان",
                    amount = 14500.0,
                    type = "INCOME",
                    category = "اشتراكات الأعضاء",
                    date = "١٤٤٧/٠٩/٠٨ هـ",
                    notes = "اشتراكات ٢٩ فرداً من أفراد العائلة"
                )
            )
            dao.insertFinanceRecord(
                FinanceRecord(
                    title = "عربون حجز مخيم رحلة العلا",
                    amount = 7500.0,
                    type = "EXPENSE",
                    category = "أنشطة ورحلات",
                    date = "١٤٤7/٠٩/١١ هـ",
                    notes = "حجز المخيم والنزل التراثي"
                )
            )

            // Initial Tasks
            dao.insertTask(
                FamilyTask(
                    title = "تحديث وتوثيق مشجّر العائلة الرقمي",
                    description = "إضافة المواليد الجدد لعام ١٤٤٦هـ ومراجعة أسماء الفروع مع كبار السن.",
                    assignedTo = "م. خالد بن ناصر",
                    dueDate = "١٤٤٧/١٠/٠١ هـ",
                    priority = "عاجلة",
                    isCompleted = false
                )
            )
            dao.insertTask(
                FamilyTask(
                    title = "تنسيق ضيافة اللقاء العائلي القادم",
                    description = "طلب القهوة النجدية والتمور وتجهيز العشاء في مقر الديوانية.",
                    assignedTo = "عبدالله بن فهد",
                    dueDate = "١٤٤٧/٠٩/٢٤ هـ",
                    priority = "عالية",
                    isCompleted = true
                )
            )
            dao.insertTask(
                FamilyTask(
                    title = "طباعة بطاقات معايدة عيد الفطر المبارك",
                    description = "تصميم وإرسال بطاقات التهاني الرسمية لكافة العائلات والأعيان.",
                    assignedTo = "سلطان بن عبدالعزيز",
                    dueDate = "١٤٤٧/٠٩/٢٨ هـ",
                    priority = "متوسطة",
                    isCompleted = false
                )
            )

            // Initial Occasions
            dao.insertOccasion(
                Occasion(
                    type = "wedding",
                    title = "دعوة زواج كريمة الأخ سلطان السيف",
                    personName = "عبدالرحمن وريم",
                    date = "١٤٤٧/١٠/١٢ هـ",
                    location = "قاعة الرياض الكبرى للاحتفالات",
                    blessingText = "بارك الله لهما وبارك عليهما وجمع بينهما في خير. يتشرف سلطان بن إبراهيم السيف بدعوتكم لحضور حفل زفاف نجلته."
                )
            )
            dao.insertOccasion(
                Occasion(
                    type = "newborn",
                    title = "بشارة قدوم المولود (سعود)",
                    personName = "سعود بن فهد السيف",
                    date = "١٤٤٧/٠٩/١٤ هـ",
                    location = "منزل فهد بن ناصر السيف",
                    blessingText = "الحمد لله الواهب الكريم، رزق فهد بن ناصر بمولود أسماه (سعود)، جعله الله قرة عين لوالديه ومن حفظة كتابه."
                )
            )
            dao.insertOccasion(
                Occasion(
                    type = "graduation",
                    title = "تهنئة تخرج المهندسة نورة السيف",
                    personName = "نورة بنت بدر السيف",
                    date = "١٤٤٧/٠٩/٠٥ هـ",
                    location = "جامعة الملك سعود",
                    blessingText = "نبارك لابنة العم نورة بدر تخرجها مع مرتبة الشرف الأولى في هندسة الحاسب والذكاء الاصطناعي."
                )
            )

            // Family Members
            dao.insertMembers(
                listOf(
                    FamilyMember(name = "الشيخ فهد بن إبراهيم السيف", branch = "فرع آل إبراهيم", role = "عميد الأسرة", generation = 1, phone = "0501112233"),
                    FamilyMember(name = "عبدالرحمن بن خالد السيف", branch = "فرع آل خالد", role = "أمين المجلس", generation = 2, phone = "0502223344"),
                    FamilyMember(name = "ماجد بن فيصل السيف", branch = "فرع آل فيصل", role = "مسؤول الأنشطة والرحلات", generation = 2, phone = "0503334455"),
                    FamilyMember(name = "خالد بن ناصر السيف", branch = "فرع آل ناصر", role = "أمين صندوق العائلة", generation = 2, phone = "0504445566"),
                    FamilyMember(name = "د. تركي بن عبدالعزيز السيف", branch = "فرع آل عبدالعزيز", role = "عضو المجلس", generation = 3, phone = "0505556677"),
                    FamilyMember(name = "سلطان بن فهد السيف", branch = "فرع آل إبراهيم", role = "لجنة الشباب والتطوير", generation = 3, phone = "0506667788"),
                    FamilyMember(name = "سارة بنت منصور السيف", branch = "فرع آل منصور", role = "اللجنة النسائية والتطوعية", generation = 3, phone = "0507778899")
                )
            )
        }
    }
}
