const { MongoClient } = require('mongodb');
require('dotenv').config();

const uri = process.env.MONGODB_URI;
const dbName = process.env.DB_NAME || 'socialEventsDB';

if (!uri) {
  console.error('❌ MONGODB_URI is not set in .env. Cannot seed data.');
  process.exit(1);
}

const sampleEvents = [
  {
    title: 'Winter Clothes & Warm Blanket Distribution',
    description: 'Providing heavy blankets, sweaters, and thermal garments for 500+ underprivileged families living near the Mirpur 10 roundabout ahead of the severe winter cold.',
    eventType: 'Donation',
    thumbnail: 'https://images.unsplash.com/photo-1593113598332-cd288d649433?auto=format&fit=crop&w=800&q=80',
    location: 'Mirpur 10 Roundabout, Dhaka',
    eventDate: '2026-11-20',
    creatorEmail: 'organizer.dhaka@gmail.com',
    creatorName: 'Shafin Ahmed (Volunteer Lead)',
    createdAt: new Date().toISOString(),
  },
  {
    title: 'Dhanmondi Lake Ecosystem Cleanup Drive',
    description: 'A community-led sanitation and waste management initiative to collect single-use plastics and clean the walking trails around Dhanmondi Lake Amphitheater.',
    eventType: 'Cleanup',
    thumbnail: 'https://images.unsplash.com/photo-1618477461853-cf6ed80faba5?auto=format&fit=crop&w=800&q=80',
    location: 'Dhanmondi Lake Amphitheater, Dhaka',
    eventDate: '2026-11-24',
    creatorEmail: 'organizer.dhaka@gmail.com',
    creatorName: 'Shafin Ahmed (Volunteer Lead)',
    createdAt: new Date().toISOString(),
  },
  {
    title: 'Urban Greenery & 500 Fruit Tree Plantation',
    description: 'Targeting urban heat island mitigation by planting native fruit and shade saplings across public playgrounds and residential walkways in Uttara Sector 7.',
    eventType: 'Plantation',
    thumbnail: 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&w=800&q=80',
    location: 'Uttara Sector 7 Park, Dhaka',
    eventDate: '2026-11-28',
    creatorEmail: 'tariq.greendhaka@org.bd',
    creatorName: 'Tariqul Islam',
    createdAt: new Date().toISOString(),
  },
  {
    title: 'Free Healthcare & Blood Donation Camp',
    description: 'Free consultations by licensed physicians, basic medicine distribution, diabetes screening, and voluntary blood donation drive for daily wage earners.',
    eventType: 'Healthcare',
    thumbnail: 'https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?auto=format&fit=crop&w=800&q=80',
    location: 'Mohammadpur Town Hall Grounds, Dhaka',
    eventDate: '2026-12-05',
    creatorEmail: 'dr.nawshin@healthaid.bd',
    creatorName: 'Dr. Nawshin Jahan',
    createdAt: new Date().toISOString(),
  },
  {
    title: 'Slum Children Primary Education & Book Giving',
    description: 'Distributing illustrated storybooks, math workbooks, school bags, and stationery sets to 250 informal school students in Korail Slum.',
    eventType: 'Education',
    thumbnail: 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&w=800&q=80',
    location: 'Korail Slum Community Center, Banani, Dhaka',
    eventDate: '2026-12-12',
    creatorEmail: 'educationforall@ngo.bd',
    creatorName: 'Ayesha Siddiqua',
    createdAt: new Date().toISOString(),
  },
  {
    title: 'Emergency Food Basket & Grocery Relief Distribution',
    description: 'Supplying emergency grocery kits containing rice, lentils, oil, and flour to families affected by economic hardship along the Kamrangirchar embankment.',
    eventType: 'Relief',
    thumbnail: 'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?auto=format&fit=crop&w=800&q=80',
    location: 'Kamrangirchar Embankment, Old Dhaka',
    eventDate: '2026-12-18',
    creatorEmail: 'reliefteam@bangladesh.org',
    creatorName: 'Kazi Mahbub',
    createdAt: new Date().toISOString(),
  },
  {
    title: 'Buriganga Riverbank Plastic Waste Awareness Drive',
    description: 'Engaging river commuters and local vendors in clean river awareness while deploying student volunteers to remove non-biodegradable debris along Sadarghat.',
    eventType: 'Cleanup',
    thumbnail: 'https://images.unsplash.com/photo-1530587191325-3db32d826c18?auto=format&fit=crop&w=800&q=80',
    location: 'Sadarghat Riverfront, Old Dhaka',
    eventDate: '2026-12-25',
    creatorEmail: 'organizer.dhaka@gmail.com',
    creatorName: 'Shafin Ahmed (Volunteer Lead)',
    createdAt: new Date().toISOString(),
  },
  {
    title: 'Rooftop Gardening & Organic Seedling Workshop',
    description: 'Empowering urban citizens to grow their own chemical-free vegetables and medicinal herbs on building rooftops with free composting kits and seeds.',
    eventType: 'Plantation',
    thumbnail: 'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?auto=format&fit=crop&w=800&q=80',
    location: 'Lalmatia Block D Community Center, Dhaka',
    eventDate: '2027-01-05',
    creatorEmail: 'tariq.greendhaka@org.bd',
    creatorName: 'Tariqul Islam',
    createdAt: new Date().toISOString(),
  },
];

async function seedDatabase() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log(`🔌 Connected to MongoDB Atlas (${dbName})`);

    const db = client.db(dbName);
    const eventsCollection = db.collection('events');

    // Clear existing events to prevent unwanted duplicates
    const deleteResult = await eventsCollection.deleteMany({});
    console.log(`🗑️ Cleared ${deleteResult.deletedCount} existing sample events.`);

    // Insert fresh realistic events
    const insertResult = await eventsCollection.insertMany(sampleEvents);
    console.log(`✅ Successfully seeded ${insertResult.insertedCount} authentic Bangladeshi social events!`);
    console.log('✨ All events are scheduled for future dates (late 2026 - early 2027).');

    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

seedDatabase();

