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
    
    // Mengambil data lengkap: UUID, Username, Kills, Money, Coins, dan Last Online
    const [rows] = await pool.execute(
      'SELECT uuid, username, kills, money, coins, last_online FROM player_stats'
    );

    const usersObj = {};

    rows.forEach(row => {
      const isBedrock = row.username.startsWith('.');
      const platformName = isBedrock ? "Bedrock" : "Java";

      // Menyimpan data ke objek dengan UUID sebagai Key agar tidak duplikat
      usersObj[row.uuid] = {
        name: row.username,
        platform: platformName,
        last_seen: row.last_online,
        stats: {
          kills: row.kills,
          money: row.money,
          coins: row.coins
        }
      };
    });

    // Menghapus batasan .slice(0, 10) agar seluruh data masuk ke array leaderboard
    const fullLeaderboardArray = [...rows]
      .sort((a, b) => b.kills - a.kills);

    console.log(`Mengirim data ${rows.length} pemain ke Firebase...`);

    // Update node 'users' dengan data lengkap
    await db.ref('users').update(usersObj);
    
    // Set node 'leaderboard' dengan array lengkap (bisa diurutkan ulang di website)
    await db.ref('leaderboard').set(fullLeaderboardArray);
    
    console.log("Sinkronisasi Berhasil!");
  } catch (error) {
    console.error("Terjadi kesalahan saat sinkronisasi:", error);
    process.exit(1);
  } finally {
    // Menutup koneksi database dengan aman
    console.log("Menutup koneksi database...");
    await pool.end();
    process.exit(0);
  }
}

runSync();
