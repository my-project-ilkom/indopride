const mysql = require('mysql2/promise');
const admin = require('firebase-admin');

// Inisialisasi Firebase menggunakan Secret dari GitHub
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DATABASE_URL
});

const db = admin.database();

// MEMBUAT SISTEM ANTREAN (CONNECTION POOL)
// Membatasi maksimal hanya 2 koneksi yang terbuka agar aman dari limit Clever Cloud (max 5)
const pool = mysql.createPool({
  host: 'bmty4m8lyhszrdjfvfyb-mysql.services.clever-cloud.com',
  user: 'uttwy17t74dgqcxm',
  password: process.env.MYSQL_PASSWORD,
  database: 'bmty4m8lyhszrdjfvfyb',
  waitForConnections: true, // Jika penuh, disuruh antre (tidak langsung error)
  connectionLimit: 2,       // Batas maksimal koneksi dalam satu waktu
  queueLimit: 0             // 0 = Antrean tidak terbatas
});

async function runSync() {
  try {
    console.log("Mengambil semua data pemain dari MySQL...");
    
    // Menggunakan pool.execute (Koneksi otomatis diambil dari antrean dan dikembalikan setelah selesai)
    const [rows] = await pool.execute(
      'SELECT uuid, username, kills, money, coins, last_online FROM player_stats'
    );

    const usersObj = {};

    rows.forEach(row => {
      const isBedrock = row.username.startsWith('.');
      const platformName = isBedrock ? "Bedrock" : "Java";

      usersObj[row.uuid] = {
        name: row.username,
        platform: platformName,
        last_seen: row.last_online
      };
    });

    const leaderboardArray = [...rows]
      .sort((a, b) => b.kills - a.kills)
      .slice(0, 10);

    console.log("Mengirim data ke Firebase...");

    await db.ref('users').update(usersObj);
    await db.ref('leaderboard').set(leaderboardArray);
    
    console.log("Sinkronisasi Berhasil!");
  } catch (error) {
    console.error("Terjadi kesalahan saat sinkronisasi:", error);
    process.exit(1);
  } finally {
    // WAJIB: Selalu tutup pintu dan bubarkan antrean sebelum robot selesai bertugas
    console.log("Menutup koneksi database...");
    await pool.end();
    process.exit(0);
  }
}

runSync();
