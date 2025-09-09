// scripts/setupDatabase.js
require('dotenv').config();
const { Pool } = require('pg');

// Connection without database name to create the database
const setupPool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function setupDatabase() {
  const client = await setupPool.connect();
  
  try {
    console.log('🏗️  Setting up database...');
    
    // Check if database exists
    const dbExists = await client.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [process.env.DB_NAME]
    );
    
    if (dbExists.rows.length === 0) {
      // Create database
      console.log(`📦 Creating database: ${process.env.DB_NAME}`);
      await client.query(`CREATE DATABASE ${process.env.DB_NAME}`);
      console.log('✅ Database created successfully!');
    } else {
      console.log('📦 Database already exists.');
    }
    
    // Now connect to the actual database
    const dbPool = new Pool({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
    });
    
    const dbClient = await dbPool.connect();
    
    try {
      // Enable UUID extension
      console.log('🔧 Installing UUID extension...');
      await dbClient.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
      console.log('✅ UUID extension installed!');
      
      console.log('🎉 Database setup completed successfully!');
      
    } finally {
      dbClient.release();
      await dbPool.end();
    }
    
  } catch (error) {
    console.error('❌ Database setup failed:', error);
    throw error;
  } finally {
    client.release();
    await setupPool.end();
  }
}

// Run setup
if (require.main === module) {
  setupDatabase()
    .then(() => {
      console.log('✅ Database setup completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Setup failed:', error);
      process.exit(1);
    });
}

module.exports = setupDatabase;