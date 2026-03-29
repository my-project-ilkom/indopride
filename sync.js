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
    console.log("Mengambil data dari MySQL...");
    const [rows] = await connection.execute(
      'SELECT username, kills, money, coins FROM player_stats ORDER BY kills DESC LIMIT 10'
    );

    console.log("Mengirim data ke Firebase...");
    // Menyimpan data ke node 'leaderboard' di Firebase
    await db.ref('leaderboard').set(rows);
    
    console.log("Sinkronisasi Berhasil!");
  } catch (error) {
    console.error("Waduh, ada error:", error);
    process.exit(1);
  } finally {
    await connection.end();
    process.exit(0);
  }
}

runSync();
