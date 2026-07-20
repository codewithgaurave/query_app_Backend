import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import Survey from "./models/Survey.js";
import SurveyQuestion from "./models/SurveyQuestion.js";
import User from "./models/User.js";

const MONGO_URI = "mongodb://localhost:27017/survey";

async function runTest() {
  await mongoose.connect(MONGO_URI);
  console.log("Connected to DB");

  // 1. Create a User
  let user = await User.findOne({ userCode: "TEST_USER_99" });
  if (!user) {
    user = new User({
      fullName: "Test User",
      email: "testuser99@example.com",
      password: "password123",
      mobile: "8888888899",
      role: "SURVEY_USER",
      userCode: "TEST_USER_99",
      isActive: true,
      uniqueId: "UNIQUE_99",
      createdByAdmin: new mongoose.Types.ObjectId()
    });
    await user.save();
  }
  console.log("User ready:", user.userCode);

  // 2. Create a Survey
  let survey = await Survey.findOne({ surveyCode: "SRV_TEST_99" });
  if (!survey) {
    survey = new Survey({
      surveyCode: "SRV_TEST_99",
      name: "Test Survey",
      title: "Test Survey",
      description: "Testing Offline Sync",
      isActive: true,
      assignedUsers: [user._id],
      createdByAdmin: new mongoose.Types.ObjectId()
    });
    await survey.save();
  }
  console.log("Survey ready:", survey.surveyCode);

  // 3. Create Questions
  await SurveyQuestion.deleteMany({ survey: survey._id });
  
  const q1 = new SurveyQuestion({
    survey: survey._id,
    questionText: "What is your name?",
    type: "OPEN_ENDED",
    isActive: true,
    required: true,
  });
  await q1.save();

  const q2 = new SurveyQuestion({
    survey: survey._id,
    questionText: "Choose a fruit",
    type: "MCQ_SINGLE",
    options: ["Apple", "Banana", "Orange"],
    isActive: true,
    required: true,
  });
  await q2.save();

  const q3 = new SurveyQuestion({
    survey: survey._id,
    questionText: "Select your hobbies",
    type: "CHECKBOX",
    options: ["Reading", "Sports", "Music"],
    isActive: true,
    required: true,
  });
  await q3.save();
  
  console.log("Questions created.");

  // 4. Simulate Flutter App sending the API request (Online/Offline same format)
  const answers = [
    { questionId: q1._id.toString(), answerText: "Vivek" },
    { questionId: q2._id.toString(), selectedOption: "Banana" },
    { questionId: q3._id.toString(), selectedOptions: ["Reading", "Music"] }
  ];

  console.log("Answers Payload:", JSON.stringify(answers, null, 2));

  // Create a dummy audio file
  const dummyAudioPath = path.join(process.cwd(), "dummy_audio.mp3");
  fs.writeFileSync(dummyAudioPath, "dummy audio content");

  // Send multipart/form-data request
  const formData = new FormData();
  formData.append("userCode", user.userCode);
  formData.append("latitude", "28.6139");
  formData.append("longitude", "77.2090");
  formData.append("answers", JSON.stringify(answers));
  
  const audioBlob = new Blob([fs.readFileSync(dummyAudioPath)], { type: "audio/mpeg" });
  formData.append("audio", audioBlob, "dummy_audio.mp3");

  try {
    const res = await fetch(`http://localhost:5000/api/survey/${survey._id}/respond`, {
      method: "POST",
      body: formData
    });
    
    const data = await res.json();
    console.log("API Status:", res.status);
    console.log("API Response:", data);
  } catch(e) {
    console.error("Fetch error:", e);
  }

  // Cleanup
  if (fs.existsSync(dummyAudioPath)) fs.unlinkSync(dummyAudioPath);
  mongoose.connection.close();
}

runTest();
