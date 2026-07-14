import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';
dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

async function testUpload() {
  console.log('Testing Cloudinary Direct Upload...');
  try {
    const result = await cloudinary.uploader.upload('dummy.jpg', {
      folder: 'survey_punchins'
    });
    console.log('✅ Success! Upload Result:', result.secure_url);
  } catch (error) {
    console.log('❌ Error! Cloudinary Upload Failed:', error);
  }
}

testUpload();
