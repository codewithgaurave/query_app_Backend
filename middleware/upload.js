import multer from "multer";
import multerS3 from "multer-s3";
import { v4 as uuidv4 } from "uuid";
import s3 from "../config/s3.js";

const upload = multer({
  storage: multerS3({
    s3,
    bucket: process.env.AWS_BUCKET_NAME || "query-app-storage",
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: (req, file, cb) => {
      const ext = file.originalname.split(".").pop();
      let folder = "files";

      if (file.mimetype.startsWith("image/")) {
        folder = "images";
      } else if (file.mimetype.startsWith("audio/")) {
        folder = "audio";
      }

      cb(null, `${folder}/${uuidv4()}.${ext}`);
    },
  }),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50 MB
  },
});

// Helper single field middlewares for matching existing routes
export const uploadUserFields = upload.single("profilePhoto");
export const uploadPunchinPhoto = upload.single("photo");
export const uploadSurveyAudio = upload.single("audio");

export default upload;
