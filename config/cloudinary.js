// // config/cloudinary.js
// import { v2 as cloudinary } from "cloudinary";
// import { CloudinaryStorage } from "multer-storage-cloudinary";
// import multer from "multer";
// import dotenv from "dotenv";

// dotenv.config();

// // Cloudinary configuration
// if (
//   !process.env.CLOUDINARY_CLOUD_NAME ||
//   !process.env.CLOUDINARY_API_KEY ||
//   !process.env.CLOUDINARY_API_SECRET
// ) {
//   console.error("❌ Cloudinary environment variables are missing!");
// }

// cloudinary.config({
//   cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
//   api_key: process.env.CLOUDINARY_API_KEY,
//   api_secret: process.env.CLOUDINARY_API_SECRET,
// });

// // ✅ LOTS CONFIG (as-is)
// const lotStorage = new CloudinaryStorage({
//   cloudinary: cloudinary,
//   params: {
//     folder: "auction_lots",
//     allowed_formats: ["jpg", "jpeg", "png", "webp", "pdf"],
//     resource_type: "auto",
//   },
// });

// const uploadLotFiles = multer({
//   storage: lotStorage,
//   limits: {
//     fileSize: 10 * 1024 * 1024, // 10MB
//   },
//   fileFilter: (req, file, cb) => {
//     const allowedMimeTypes = [
//       "image/jpeg",
//       "image/jpg",
//       "image/png",
//       "image/webp",
//       "application/pdf",
//     ];

//     if (allowedMimeTypes.includes(file.mimetype)) {
//       cb(null, true);
//     } else {
//       cb(
//         new Error("Invalid file type. Only images and PDFs are allowed."),
//         false
//       );
//     }
//   },
// });

// // ✅ USER CONFIG – ONLY PROFILE PHOTO
// const userStorage = new CloudinaryStorage({
//   cloudinary: cloudinary,
//   params: {
//     folder: "auction_users",
//     allowed_formats: ["jpg", "jpeg", "png", "webp"],
//     resource_type: "image",
//   },
// });

// const uploadUserFiles = multer({
//   storage: userStorage,
//   limits: {
//     fileSize: 10 * 1024 * 1024, // 10MB
//   },
//   fileFilter: (req, file, cb) => {
//     const allowedMimeTypes = [
//       "image/jpeg",
//       "image/jpg",
//       "image/png",
//       "image/webp",
//     ];

//     if (allowedMimeTypes.includes(file.mimetype)) {
//       cb(null, true);
//     } else {
//       cb(
//         new Error("Invalid file type. Only image files are allowed."),
//         false
//       );
//     }
//   },
// });

// // ✅ SINGLE FIELD: profilePhoto
// const uploadUserFields = uploadUserFiles.single("profilePhoto");

// // ✅ PUNCH-IN CONFIG – image only
// const punchinStorage = new CloudinaryStorage({
//   cloudinary: cloudinary,
//   params: {
//     folder: "survey_punchins",
//     allowed_formats: ["jpg", "jpeg", "png", "webp"],
//     resource_type: "image",
//   },
// });

// const uploadPunchinPhotoMulter = multer({
//   storage: punchinStorage,
//   limits: {
//     fileSize: 10 * 1024 * 1024, // 10MB
//   },
//   fileFilter: (req, file, cb) => {
//     const allowedMimeTypes = [
//       "image/jpeg",
//       "image/jpg",
//       "image/png",
//       "image/webp",
//     ];

//     if (allowedMimeTypes.includes(file.mimetype)) {
//       cb(null, true);
//     } else {
//       cb(
//         new Error("Invalid file type. Only image files are allowed."),
//         false
//       );
//     }
//   },
// });

// // SINGLE: photo
// const uploadPunchinPhoto = uploadPunchinPhotoMulter.single("photo");

// export { cloudinary, uploadLotFiles, uploadUserFields, uploadPunchinPhoto };

// config/cloudinary.js
import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import multer from "multer";
import dotenv from "dotenv";

dotenv.config();

// Cloudinary configuration
if (
  !process.env.CLOUDINARY_CLOUD_NAME ||
  !process.env.CLOUDINARY_API_KEY ||
  !process.env.CLOUDINARY_API_SECRET
) {
  console.error("❌ Cloudinary environment variables are missing!");
}

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ✅ LOTS CONFIG (agar tum use nahi kar rahe to hata bhi sakte ho)
const lotStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "auction_lots",
    allowed_formats: ["jpg", "jpeg", "png", "webp", "pdf"],
    resource_type: "auto",
  },
});

const uploadLotFiles = multer({
  storage: lotStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
      "application/pdf",
    ];
    if (allowed.includes(file.mimetype)) return cb(null, true);
    return cb(
      new Error("Invalid file type. Only images and PDFs are allowed."),
      false
    );
  },
});

// ✅ USER PROFILE PHOTO
const userStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "auction_users",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    resource_type: "image",
  },
});

const uploadUserFiles = multer({
  storage: userStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (allowed.includes(file.mimetype)) return cb(null, true);
    return cb(
      new Error("Invalid file type. Only image files are allowed."),
      false
    );
  },
});

// single: profilePhoto
const uploadUserFields = uploadUserFiles.single("profilePhoto");

// ✅ PUNCH-IN PHOTO
const punchinStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "survey_punchins",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    resource_type: "image",
  },
});

const punchinMulter = multer({
  storage: punchinStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (allowed.includes(file.mimetype)) return cb(null, true);
    return cb(
      new Error("Invalid file type. Only image files are allowed."),
      false
    );
  },
});

// single: photo
const uploadPunchinPhoto = punchinMulter.single("photo");

// ✅ SURVEY AUDIO (नई config)
const surveyAudioStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "survey_audio",
    allowed_formats: ["mp3", "wav", "m4a", "aac", "ogg"],
    resource_type: "auto", // audio/video auto handle
  },
});

const surveyAudioMulter = multer({
  storage: surveyAudioStorage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (req, file, cb) => {
    const allowed = [
      "audio/mpeg",
      "audio/mp3",
      "audio/wav",
      "audio/x-wav",
      "audio/aac",
      "audio/ogg",
      "audio/x-m4a",
      "audio/mp4",
    ];
    if (allowed.includes(file.mimetype)) return cb(null, true);
    return cb(
      new Error("Invalid file type. Only audio files are allowed."),
      false
    );
  },
});

// single: audio
const uploadSurveyAudio = surveyAudioMulter.single("audio");

export {
  cloudinary,
  uploadLotFiles,
  uploadUserFields,
  uploadPunchinPhoto,
  uploadSurveyAudio,
};
