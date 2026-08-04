import mongoose from "mongoose";

async function main() {
  const sourceUri = process.env.MIGRATE_SOURCE_MONGODB_URI;
  const targetUri = process.env.MIGRATE_TARGET_MONGODB_URI;

  if (!sourceUri || !targetUri) {
    throw new Error(
      "Set MIGRATE_SOURCE_MONGODB_URI and MIGRATE_TARGET_MONGODB_URI in .env.local before running this script."
    );
  }

  const sourceConn = await mongoose.createConnection(sourceUri).asPromise();
  const targetConn = await mongoose.createConnection(targetUri).asPromise();

  const sourceUsers = sourceConn.db!.collection("users");
  const targetUsers = targetConn.db!.collection("users");

  const users = await sourceUsers.find({}).toArray();
  console.log(`Found ${users.length} users in the source database.`);

  let inserted = 0;
  let updated = 0;

  for (const user of users) {
    const { _id, ...fields } = user;
    const result = await targetUsers.updateOne(
      { email: fields.email },
      { $set: fields, $setOnInsert: { _id } },
      { upsert: true }
    );
    if (result.upsertedCount > 0) {
      inserted += 1;
    } else if (result.modifiedCount > 0) {
      updated += 1;
    }
  }

  console.log(`Migrated ${users.length} users to the target database (${inserted} inserted, ${updated} updated).`);

  await sourceConn.close();
  await targetConn.close();
  process.exit(0);
}

main().catch((error) => {
  console.error("Failed to migrate users:", error);
  process.exit(1);
});
