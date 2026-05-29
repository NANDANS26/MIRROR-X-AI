import multer from "multer";

import path from "path";

const storage = multer.diskStorage({
  destination: (
    _req,
    _file,
    cb
  ) => {
    cb(null, "src/uploads");
  },

  filename: (
    _req,
    file,
    cb
  ) => {
    cb(
      null,
      `${Date.now()}-${file.originalname}`
    );
  },
});

const fileFilter = (
  _req: any,
  file: any,
  cb: any
) => {
  const allowedTypes = [
    "image/png",
    "image/jpeg",
    "image/webp",
  ];

  if (
    allowedTypes.includes(
      file.mimetype
    )
  ) {
    cb(null, true);
  } else {
    cb(
      new Error(
        "Unsupported file format"
      )
    );
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});