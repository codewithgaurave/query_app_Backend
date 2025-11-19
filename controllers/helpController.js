// controllers/helpController.js
import Help from "../models/Help.js";
import Admin from "../models/Admin.js";

// PUBLIC → Return help page data
export const getHelpAndSupport = async (_req, res) => {
  try {
    const doc = await Help.getSingleton();
    return res.json(doc);
  } catch (err) {
    console.error("getHelpAndSupport error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ADMIN → Update help page data
export const updateHelpAndSupport = async (req, res) => {
  try {
    const adminId = req.user?.sub;
    if (!adminId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const adminExists = await Admin.findById(adminId);
    if (!adminExists) {
      return res.status(403).json({ message: "Admin not found" });
    }

    const doc = await Help.getSingleton();

    const allowedFields = [
      "supportEmail",
      "supportPhone",
      "whatsappNumber",
      "officeAddress",
      "officeHours",
      "socialLinks",
      "faqs",
    ];

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        doc[field] = req.body[field];
      }
    });

    doc.updatedByAdmin = adminId;

    await doc.save();

    return res.json({
      message: "Help & Support updated successfully",
      help: doc,
    });
  } catch (err) {
    console.error("updateHelpAndSupport error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};
