import axios from "axios";
import app from "./app.js";
import fs from "fs/promises";
import path from "path";
import { redisClient } from "./redis.js";
import BlurryDetector from "./sharp.js";
//use multer to upload images on uploads folder using url
import multer from "multer";
import { converter } from "./converter.js";
import { checkReadability } from "./readability-checker.js";
import { processSingleImage, processSingleImageLocally } from "./process.js";
const upload = multer({ dest: "uploads/" });

//this will directly pull the images and process the data at the same time and then send response
app.get("/", async (req, res) => {
  const response = await axios.get(
    "https://be.platform.simplifii.com/api/v1/custom/claim_images"
  );
  const data = response.data.response.data;
  const batchSize = 10;
  const batches = [];
  for (let i = 0; i < data.length; i += batchSize) {
    batches.push(data.slice(i, i + batchSize));
  }
  const promises = batches.map(async (batch) => {
    try {
      await Promise.all(
        batch.map(async (data) => {
          const txt = await converter(data.url);
          const score = await checkReadability(txt);
          console.log(data.url, score);
          const newFolder = score > 30 ? "clear_images" : "blur_images";
          const newPath = path.join(newFolder, data.url.split("/").pop());

          try {
            await fs.access(newFolder);
          } catch {
            await fs.mkdir(newFolder);
          }

          // Download the image and save it to the new path
          const response = await axios.get(data.url, {
            responseType: "arraybuffer",
          });
          await fs.writeFile(newPath, response.data);
        })
      );
    } catch (error) {
      console.log(error);
    }
  });
  await Promise.all(promises);
  res.send("success");
});

// This will load all the images to an in memory database like redis for faster data retrieval and reduce my local pc resources.
app.get("/upload-redis", async (req, res) => {
  const response = await axios.get(
    "https://be.platform.simplifii.com/api/v1/custom/claim_images"
  );
  const data = response.data.response.data;
  const imageData = "IMAGES";
  const batchSize = 10;
  const batches = [];
  for (let i = 0; i < data.length; i += batchSize) {
    batches.push(data.slice(i, i + batchSize));
  }
  //Now I have arrray of 10 10 urls in batches array
  //Now I want to process each batch and save it to redis

  for (const batch of batches) {
    const pipeline = redisClient.pipeline();

    for (const item of batch) {
      pipeline.rpush(imageData, JSON.stringify(item));
      console.log(item);
    }

    await pipeline.exec();
    res.write(`data: Batch ${batches.indexOf(batch) + 1} loaded\n\n`);
  }

  res.end();
  res.send(batches);
});

app.post("/upload-single-cloud", async (req, res) => {
  const { url } = req.body;
  await processSingleImage(url);
  res.send("success");
});

app.post("/upload-single-local", upload.single("file"), async (req, res) => {
  const { url } = req.body;
  console.log(url);
  // await processSingleImageLocally(url);
  const response = await axios.get(url, { responseType: "arraybuffer" });
  const imageData = Buffer.from(response.data, "binary");
  const detector = new BlurryDetector();
  const isBlurry = await detector.isImageBlurry(imageData);
  if (isBlurry) {
    console.log("🔍 Given image seems blurry!");
  } else {
    console.log("🔍 Given image seems focused!");
  }
  const newFolder = isBlurry ? "BLUR_LOCAL" : "CLEAR_LOCAL";
  const newPath = path.join(newFolder, url.split("/").pop());

  try {
    await fs.access(newFolder);
  } catch {
    await fs.mkdir(newFolder);
  }

  // Download the image and save it to the new path
  const ress = await axios.get(url, {
    responseType: "arraybuffer",
  });
  await fs.writeFile(newPath, ress.data);
  res.send("Why");
});

//this will upload a single file
app.post("/upload", upload.single("file"), async (req, res) => {
  const fileData = {
    path: req.file.path,
    originalName: req.file.originalname,
  };
  const txt = await converter(req.file.path);
  const score = await checkReadability(txt);
  console.log(score);
  console.log(fileData);
  const pipeline = redisClient.pipeline();
  if (score > 30) pipeline.rpush("CLEAR", JSON.stringify(fileData.url));
  else pipeline.rpush("BLUR", JSON.stringify(fileData.url));
  await pipeline.exec();
  const newFolder = score > 30 ? "clear_imgs_local" : "blur_imgs_local";
  const newPath = path.join(newFolder, req.file.originalname);
  try {
    await fs.access(newFolder);
  } catch {
    await fs.mkdir(newFolder);
  }
  await fs.rename(req.file.path, newPath);
  fileData.path = newPath;
  res.send({ file: fileData, score: score });
});

app.listen(8000, () => {
  console.log("Server is running on port 8000");
});
