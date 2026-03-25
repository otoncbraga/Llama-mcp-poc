import { MongoClient } from "mongodb";

let client: MongoClient | null = null;

export async function getDb() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is not set");
  }

  if (!client) {
    client = new MongoClient(uri);
    await client.connect();
  }

  return client.db();
}
