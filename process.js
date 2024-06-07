import { redisClient } from "./redis.js";
import { converter } from "./converter.js";
import { checkReadability } from "./readability-checker.js";
import { produce } from "./kafka.js";
import fs from "fs";
import path from "path";
import BlurryDetector from "./sharp.js";
import axios from "axios";
import { workerData } from "worker_threads";

export async function processImageBatch(batch) {
  try {
    const clear_list = "CLEAR";
    const blur_list = "BLUR";
    console.log(batch, "started");
    await Promise.all(
      batch.map(async (image) => {
        const data = JSON.parse(image);
        // const txt = await converter(data.url);
        // const score = await checkReadability(txt);
        // if (score > 30) {
        //   await produce(clear_list, data.url);
        // } else await produce(blur_list, data.url);

        console.log(data.url);
        const response = await axios.get(data.url, {
          responseType: "arraybuffer",
        });
        const imageData = Buffer.from(response.data, "binary");
        const detector = new BlurryDetector();
        const isBlurry = await detector.isImageBlurry(imageData);
        if (isBlurry) {
          console.log("🔍 Given image seems blurry!");
        } else {
          console.log("🔍 Given image seems focused!");
        }
        const newFolder = isBlurry ? "BLUR_LOCAL" : "CLEAR_LOCAL";
        const newPath = path.join(newFolder, data.url.split("/").pop());

        try {
          console.log(newFolder);
          await fs.promises.access(newFolder);
        } catch {
          await fs.promises.mkdir(newFolder);
        }

        // Download the image and save it to the new path
        const ress = await axios.get(data.url, {
          responseType: "arraybuffer",
        });
        await fs.promises.writeFile(newPath, ress.data);
      })
    );
  } catch (error) {
    console.log(error);
  }
}
export async function processSingleImageLocally(url) {
  try {
    // const txt = await converter(url);
    // const score = await checkReadability(txt);
    // const folder = score > 30 ? "CLEAR_LOCAL" : "BLUR_LOCAL";
    // upload the image their
    console.log(url);
    const response = await axios.get(url, { responseType: "arraybuffer" });
    const imageData = Buffer.from(response.data, "binary");
    const detector = new BlurryDetector();
    const isBlurry = await detector.isImageBlurry(imageData);
    if (isBlurry) {
      console.log("🔍 Given image seems blurry!");
    } else {
      console.log("🔍 Given image seems focused!");
    }
    const folder = isBlurry ? "BLUR_LOCAL" : "CLEAR_LOCAL";
    const res = await axios.get(url, {
      responseType: "arraybuffer",
    });
    console.log(folder, res.data);
    const newPath = path.join(folder, url.split("/").pop());
    await fs.writeFile(newPath, res.data);

    try {
      await fs.access(folder);
    } catch {
      await fs.mkdir(folder);
    }

    await fs.writeFile(newPath, response);
    return true;
  } catch (error) {
    console.log(error);
  }
}

export async function processSingleImage(url) {
  try {
    const clear_list = "CLEAR";
    const blur_list = "BLUR";
    console.log(url, "started");

    const txt = await converter(url);
    const score = await checkReadability(txt);
    if (score > 30) {
      const res = await produce(clear_list, url);
      console.log(res, "clear");
    } else await produce(blur_list, url);

    console.log(url, score);
  } catch (error) {
    console.log(error);
  }
}

export async function redisWorker() {
  const imageQueue = "IMAGES";
  const batchSize = 10;
  console.log("redisWorker start");
  while (true) {
    const queueLength = await redisClient.llen(imageQueue);
    console.log(`Queue length: ${queueLength}`);
    const batch = await redisClient.lrange(imageQueue, 0, batchSize - 1);
    if (batch.length === 0) {
      console.log("No images in the queue, waiting...");

      await new Promise((resolve) => setTimeout(resolve, 5000));
      break;
    }
    console.log(batch);
    console.log(`Dequeued batch of ${batch.length}  images`);

    // Remove the processed batch from the queue
    const pipeline = redisClient.pipeline();
    batch.forEach((imageData) => pipeline.lrem(imageQueue, 0, imageData));
    await pipeline.exec();

    // Process the batch of images
    await processImageBatch(batch);
  }
  return "Images has been processed";
}

await redisWorker();
