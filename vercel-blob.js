import { put } from "@vercel/blob";

const { url } = await put("articles/blob.txt", "Hello World!", {
  access: "public",
});

console.log(process.env.JAMI);
