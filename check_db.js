import mongoose from "mongoose";

const MONGO_URI = "mongodb://localhost:27017/survey";

async function run() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("Successfully connected to database:", MONGO_URI);

    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    console.log("Available collections:", collections.map(c => c.name));

    // Get count of survey responses
    const responsesCol = db.collection("surveyresponses");
    const count = await responsesCol.countDocuments();
    console.log("Total survey responses:", count);

    // Find duplicates by clientSubmissionId (where clientSubmissionId is not null/empty)
    const duplicatesById = await responsesCol.aggregate([
      { $match: { clientSubmissionId: { $ne: null } } },
      { $group: { _id: "$clientSubmissionId", count: { $sum: 1 }, docs: { $push: { id: "$_id", createdAt: "$createdAt", userCode: "$userCode" } } } },
      { $match: { count: { $gt: 1 } } }
    ]).toArray();

    console.log("\n--- Duplicate entries by clientSubmissionId (Idempotency Key) ---");
    console.log("Count of duplicate groups:", duplicatesById.length);
    let totalDuplicatesById = 0;
    duplicatesById.forEach(g => {
      console.log(`clientSubmissionId: ${g._id}, Count: ${g.count}`);
      g.docs.forEach(d => {
        console.log(`  - Doc ID: ${d.id}, User: ${d.userCode}, CreatedAt: ${d.createdAt}`);
      });
      totalDuplicatesById += (g.count - 1);
    });
    console.log("Total redundant duplicate records by clientSubmissionId:", totalDuplicatesById);

    // Let's do a group by userCode, survey, answers count/content, and audioUrl or similar to see if there are duplicates with no clientSubmissionId
    const potentialDuplicates = await responsesCol.aggregate([
      {
        $group: {
          _id: {
            userCode: "$userCode",
            survey: "$survey",
            audioUrl: "$audioUrl"
          },
          count: { $sum: 1 },
          docs: { $push: { id: "$_id", clientSubmissionId: "$clientSubmissionId", createdAt: "$createdAt" } }
        }
      },
      { $match: { count: { $gt: 1 } } }
    ]).toArray();

    console.log("\n--- Potential duplicate entries by (userCode, survey, audioUrl) ---");
    console.log("Count of duplicate groups:", potentialDuplicates.length);
    let totalPotentialDuplicates = 0;
    potentialDuplicates.forEach(g => {
      if (g._id.audioUrl) {
        console.log(`User: ${g._id.userCode}, Survey: ${g._id.survey}, AudioUrl: ${g._id.audioUrl}, Count: ${g.count}`);
        g.docs.forEach(d => {
          console.log(`  - Doc ID: ${d.id}, clientSubmissionId: ${d.clientSubmissionId}, CreatedAt: ${d.createdAt}`);
        });
        totalPotentialDuplicates += (g.count - 1);
      }
    });
    console.log("Total potential duplicate records by User/Survey/AudioUrl:", totalPotentialDuplicates);

  } catch (err) {
    console.error("Error during check:", err);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from DB");
  }
}

run();
