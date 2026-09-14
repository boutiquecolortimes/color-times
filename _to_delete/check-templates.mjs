import { MongoClient } from "mongodb";
import fs from "fs";

const envContent = fs.readFileSync(".env.local", "utf8");
const match = envContent.match(/MONGODB_URI="?([^"\n]+)"?/);
const uri = match[1];

const client = new MongoClient(uri);
await client.connect();
const db = client.db();
const count = await db.collection("whatsapptemplates").countDocuments();
console.log("Total WhatsAppTemplate docs:", count);
const docs = await db.collection("whatsapptemplates").find().limit(20).toArray();
for (const d of docs) {
  console.log(JSON.stringify({
    _id: d._id,
    name: d.name,
    triggerEvent: d.triggerEvent,
    brevoTemplateId: d.brevoTemplateId,
    metaTemplateName: d.metaTemplateName,
    isActive: d.isActive,
  }));
}
await client.close();
