import { createWorker } from "tesseract.js";
export async function converter(url) {
  try {
    const worker = await createWorker("eng");
    const res = await worker.recognize(url);
    await worker.terminate();
    return res.data.text;
  } catch (error) {
    console.log(error);
    return null;
  }
}
