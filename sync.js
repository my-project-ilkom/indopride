const mysql = require('mysql2/promise');
const admin = require('firebase-admin');

// Inisialisasi Firebase menggunakan Secret dari GitHub
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DATABASE_URL
});

const db = admin.database();

async function runSync() {
  const connection = await mysql.createConnection({
    host: 'bmty4m8lyhszrdjfvfyb-mysql.services.clever-cloud.com',
    user: 'uttwy17t74dgqcxm',
    password: process.env.MYSQL_PASSWORD,
    database: 'bmty4m8lyhszrdjfvfyb'
  });

  try {
    console.log("Mengambil semua data pemain dari MySQL...");
    // Mengambil semua kolom untuk kebutuhan 'users' dan 'leaderboard'
    const [rows] = await connection.execute(
      'SELECT uuid, username, kills, money, coins, last_online FROM player_stats'
    );

    const usersObj = {};

    rows.forEach(row => {
      // Deteksi Platform: Bedrock ditandai dengan awalan titik (.) pada username
      const isBedrock = row.username.startsWith('.');
      const platformName = isBedrock ? "Bedrock" : "Java";

      // Struktur data sesuai rencana Tahap 1: UUID sebagai Key
      usersObj[row.uuid] = {
        name: row.username,
        platform: platformName,
        last_seen: row.last_online
      };
    });

    // Menyiapkan data Top 10 Leaderboard (diurutkan berdasarkan kills terbanyak)
    const leaderboardArray = [...rows]
      .sort((a, b) => b.kills - a.kills)
      .slice(0, 10);

    console.log("Mengirim data ke Firebase...");

    // TAHAP 1: Update node 'users' tanpa menghapus data yang sudah ada
    await db.ref('users').update(usersObj);

    // TAHAP 1: Update node 'leaderboard' untuk tampilan utama website
    await db.ref('leaderboard').set(leaderboardArray);
    
    console.log("Sinkronisasi Berhasil!");
  } catch (error) {
    console.error("Terjadi kesalahan saat sinkronisasi:", error);
    process.exit(1);
  } finally {
    await connection.end();
    process.exit(0);
  }
}

runSync();
