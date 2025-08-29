import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import multer from "multer";
import xlsx from "xlsx";
import adminRoutes from "./src/routes/admin.js";  
import buildTreeFromExcel from "./src/utils/buildTreeFromExcel.js"; 
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Kết nối MongoDB
mongoose.connect("mongodb://localhost:27017/treeDB")
  .then(() => console.log("✅ MongoDB connected"))
  .catch(err => console.error("❌ MongoDB connection error:", err));

// Schema & model
const ItemSchema = new mongoose.Schema({
  index: { type: String, required: true },   // index duy nhất để tree
  isFolder: { type: Boolean, default: false }, // nếu là folder hay leaf
  children: { type: [String], default: [] }, // list index con
  data: { type: String, required: true },   // tên hiển thị
});
const Item = mongoose.model("Item", ItemSchema);

// Routes
app.use("/admin", adminRoutes);

// API lấy tree
app.get("/api/tree", async (req, res) => {
  const items = await Item.find();
  const dbData = {};
  items.forEach((item) => {
    dbData[item.index] = {
      index: item.index,
      isFolder: item.isFolder,
      children: item.children,
      data: item.data,
    };
  });
  
  res.json(dbData);
});

// Multer config
const upload = multer({ dest: "uploads/" });

// API upload excel
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    const workbook = xlsx.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], {
      header: ["C1", "C2", "C3", "C4"],
      range: 1,
    });

    const items = buildTreeFromExcel(rows);

    // Xóa dữ liệu cũ nếu muốn
    await Item.deleteMany({});
    await Item.insertMany(items);

    res.json({ success: true, message: "Excel uploaded & inserted to DB" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Upload failed" });
  }
});

// Start server
app.listen(4000, () => {
  console.log("🚀 Server running on port 4000");
});
