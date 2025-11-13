// models/PunchIn.js
import mongoose from "mongoose";

const punchInSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    userCode: {
      type: String,
      required: true,
      index: true,
    },
    latitude: {
      type: Number,
      required: true,
    },
    longitude: {
      type: Number,
      required: true,
    },
    photoUrl: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

// Optional: custom collection name
// export default mongoose.model("PunchIn", punchInSchema, "SurveyPunchIns");
export default mongoose.model("PunchIn", punchInSchema);
