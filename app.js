import express from "express";
import bodyParser from "body-parser";
import axios from "axios";
import fs from "fs/promises";
import path from "path";
import { redisClient } from "./redis.js";
// import BlurryDetector from "./sharp.js";
import dotenv from "dotenv";
//use multer to upload images on uploads folder using url
import multer from "multer";
import { converter } from "./converter.js";
import { checkReadability } from "./readability-checker.js";
import { processSingleImage, redisWorker } from "./process.js";
import { put } from "@vercel/blob";
dotenv.config();
const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "./uploads");
  },
  filename: function (req, file, cb) {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});
const upload = multer({ storage });
console.log(process.env.JAMI);

app.get("/", (req, res) => {
  res.send("API is Working");
});

//this will directly pull the images and process the data at the same time and then send response

app.post("/vercel", upload.single("file"), async (req, res) => {
  const fileData = {
    path: req.file.path,
    originalName: req.file.originalname,
  };
  // const { url } = await put(`articles/blob.txt`, "Hello World!", {
  //   access: "public",
  // });
  const blob = await put(`images/${fileData.path}`, req.file, {
    access: "public",
  });
  const body = req.file;
  res.send(blob);
});

//This will load all the images to an in memory database like redis for faster data retrieval and reduce my local pc resources.
app.post("/upload-redis", async (req, res) => {
  const { url } = req.body;
  console.log(url);
  const response = await axios.get(url);
  const data = response.data.response.data;
  const imageData = "IMAGES";
  const batchSize = 10;
  const batches = [];
  for (let i = 0; i < data.length; i += batchSize) {
    batches.push(data.slice(i, i + batchSize));
  }

  // Set headers for SSE
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

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
});

//GET route to start the worker process
app.post("/start-worker", async (req, res) => {
  try {
    await redisWorker(true);
    res.send("Worker started");
  } catch (error) {
    console.error(error);
    res.status(500).send("Failed to start worker");
  }
});

app.post("/stop-worker", async (req, res) => {
  try {
    await redisWorker(false);
    console.log("Worker stopped");
    res.send("Worker stopped");
  } catch (error) {
    console.error(error);
    res.status(500).send("Failed to stop worker");
  }
});
//POST roue to process single image by url
app.post("/process-single-cloud", async (req, res) => {
  const { url } = req.body;
  const result = await processSingleImage(url);
  res.send(result);
});

//GET route for getting clear images
app.get("/clear", async (req, res) => {
  const imageQueue = "CLEAR";
  console.log("redisWorker start");

  const queueLength = await redisClient.llen(imageQueue);
  console.log(`Queue length: ${queueLength}`);

  if (queueLength === 0) {
    console.log("No images in the queue, waiting...");
    res.json({ message: "No images in the queue" });
    return;
  }

  const allImages = await redisClient.lrange(imageQueue, 0, -1);
  console.log(allImages);

  res.json(allImages);
});

//GET route for getting blur images
app.get("/blur", async (req, res) => {
  const imageQueue = "BLUR";
  console.log("redisWorker start");

  const queueLength = await redisClient.llen(imageQueue);
  console.log(`Queue length: ${queueLength}`);

  if (queueLength === 0) {
    console.log("No images in the queue, waiting...");
    res.json({ message: "No images in the queue" });
    return;
  }

  const allImages = await redisClient.lrange(imageQueue, 0, -1);
  console.log(allImages);

  res.json(allImages);
});

// app.get("/process-all-local", async (req, res) => {
//   const response = await axios.get(
//     "https://be.platform.simplifii.com/api/v1/custom/claim_images"
//   );
//   const data = response.data.response.data;
//   const batchSize = 10;
//   const batches = [];
//   for (let i = 0; i < data.length; i += batchSize) {
//     batches.push(data.slice(i, i + batchSize));
//   }
//   const promises = batches.map(async (batch) => {
//     try {
//       await Promise.all(
//         batch.map(async (data) => {
//           const txt = await converter(data.url);
//           const score = await checkReadability(txt);
//           console.log(data.url, score);
//           const newFolder = score > 30 ? "clear_images" : "blur_images";
//           const newPath = path.join(newFolder, data.url.split("/").pop());

//           try {
//             await fs.access(newFolder);
//           } catch {
//             await fs.mkdir(newFolder);
//           }

//           const response = await axios.get(data.url, {
//             responseType: "arraybuffer",
//           });
//           await fs.writeFile(newPath, response.data);
//         })
//       );
//     } catch (error) {
//       console.log(error);
//     }
//   });
//   await Promise.all(promises);
//   res.send("success");
// });

// app.post("/upload-single-local", upload.single("file"), async (req, res) => {
//   const { url } = req.body;
//   console.log(url);
//   // await processSingleImageLocally(url);
//   const response = await axios.get(url, { responseType: "arraybuffer" });
//   const imageData = Buffer.from(response.data, "binary");
//   const detector = new BlurryDetector();
//   const isBlurry = await detector.isImageBlurry(imageData);
//   if (isBlurry) {
//     console.log("🔍 Given image seems blurry!");
//   } else {
//     console.log("🔍 Given image seems focused!");
//   }
//   const newFolder = isBlurry ? "BLUR_LOCAL" : "CLEAR_LOCAL";
//   const newPath = path.join(newFolder, url.split("/").pop());

//   try {
//     await fs.access(newFolder);
//   } catch {
//     await fs.mkdir(newFolder);
//   }

//   // Download the image and save it to the new path
//   const ress = await axios.get(url, {
//     responseType: "arraybuffer",
//   });
//   await fs.writeFile(newPath, ress.data);
//   res.send("Why");
// });

//this will upload a single file
// app.post("/upload", upload.single("file"), async (req, res) => {
//   const fileData = {
//     path: req.file.path,
//     originalName: req.file.originalname,
//   };
//   const txt = await converter(req.file.path);
//   const score = await checkReadability(txt);
//   console.log(score);
//   console.log(fileData);
//   const pipeline = redisClient.pipeline();
//   if (score > 30) pipeline.rpush("CLEAR", JSON.stringify(fileData.url));
//   else pipeline.rpush("BLUR", JSON.stringify(fileData.url));
//   await pipeline.exec();
//   // const newFolder = score > 30 ? "clear_imgs_local" : "blur_imgs_local";
//   // const newPath = path.join(newFolder, req.file.originalname);
//   // try {
//   //   await fs.access(newFolder);
//   // } catch {
//   //   await fs.mkdir(newFolder);
//   // }
//   // await fs.rename(req.file.path, newPath);
//   fileData.path = newPath;
//   res.send({ file: fileData, score: score });
// });

// app.get("/clear", async (req, res) => {
//   const imageQueue = "CLEAR";
//   const batchSize = 10;
//   console.log("redisWorker start");
//   let batches = [];
//   while (true) {
//     const queueLength = await redisClient.llen(imageQueue);
//     console.log(`Queue length: ${queueLength}`);
//     const batch = await redisClient.lrange(imageQueue, 0, batchSize - 1);
//     if (batch.length === 0) {
//       console.log("No images in the queue, waiting...");

//       await new Promise((resolve) => setTimeout(resolve, 5000));
//       break;
//     }
//     console.log(batch);
//     console.log(`Dequeued batch of ${batch.length}  images`);
//     batches.push(batch);
//   }
//   res.send(batches);
// });

export default app;
